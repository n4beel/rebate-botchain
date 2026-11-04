"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePublicClient } from "wagmi";
import PageShell from "@/components/layout/PageShell";
import ReceiptStrip from "@/components/receipt/ReceiptStrip";
import Button from "@/components/ui/Button";
import { BOTCHAIN_ABI } from "@/lib/botchain/abi";
import { activeBotChain } from "@/lib/botchain/chain";
import { getDeployment } from "@/lib/botchain/deployment";
import { Listing, Change } from "@/lib/rebate";

export default function HomePage() {
  const publicClient = usePublicClient({ chainId: activeBotChain.id });
  const deployment = getDeployment(activeBotChain.id);

  const [listings, setListings] = useState<{ id: bigint; listing: Listing; changes: Change[] }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!publicClient || !deployment?.address) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const count = (await publicClient.readContract({
          address: deployment.address,
          abi: BOTCHAIN_ABI,
          functionName: "listingCount",
        })) as bigint;

        if (count === 0n) {
          setListings([]);
          setLoading(false);
          return;
        }

        // Fetch latest listings up to 50
        const result = (await publicClient.readContract({
          address: deployment.address,
          abi: BOTCHAIN_ABI,
          functionName: "latest",
          args: [0n, count > 50n ? 50n : count],
        })) as [bigint[], { seller: `0x${string}`; windowSecs: bigint; stock: number; price: bigint; name: string }[], bigint];

        const [ids, rawListings] = result;

        // Fetch changes for each listing
        const withChanges = await Promise.all(
          ids.map(async (id, idx) => {
            const ch = (await publicClient.readContract({
              address: deployment.address,
              abi: BOTCHAIN_ABI,
              functionName: "changesOf",
              args: [id],
            })) as { at: bigint; price: bigint }[];
            return {
              id,
              listing: {
                seller: rawListings[idx].seller,
                windowSecs: rawListings[idx].windowSecs,
                stock: rawListings[idx].stock,
                price: rawListings[idx].price,
                name: rawListings[idx].name,
              },
              changes: ch,
            };
          })
        );

        setListings(withChanges);
      } catch (err) {
        console.error("Failed to load listings:", err);
      } finally {
        setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [deployment?.address]);

  return (
    <PageShell
      nav={[
        { href: "/", label: "Rack" },
        { href: "/new", label: "List Item" },
        { href: "/me", label: "My Activity" },
      ]}
      title="The Receipt Rack"
      description="Buy with guaranteed price protection. If the seller cuts the price during your window, you get the difference."
    >
      {/* What is protected notice banner */}
      <div className="mb-8 p-4 bg-white border border-[var(--border-default)] text-xs font-mono space-y-2">
        <div className="font-bold uppercase tracking-wider text-[var(--text-primary)] border-b border-dashed border-[var(--border-subtle)] pb-1">
          What is protected
        </div>
        <ul className="list-disc list-inside space-y-1 text-[var(--text-muted)]">
          <li>Only this seller's price cuts on this listing.</li>
          <li>The seller is paid after the window. Your money waits until then.</li>
          <li>This moves money. It doesn't deliver anything or take returns.</li>
        </ul>
      </div>

      {/* Main rack view */}
      {loading ? (
        <div className="py-16 text-center text-sm font-mono text-[var(--text-muted)]">
          PULLING RECEIPTS FROM THE RACK...
        </div>
      ) : listings.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed border-[var(--border-default)] bg-white/50 p-8">
          <div className="font-mono text-sm mb-3 text-[var(--text-muted)]">
            THE RACK IS EMPTY. NO ACTIVE LISTINGS YET.
          </div>
          <Link href="/new">
            <Button variant="primary">List the First Item</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
          {listings.map((item) => (
            <ReceiptStrip
              key={item.id.toString()}
              id={item.id}
              listing={item.listing}
              changes={item.changes}
              compact
            />
          ))}
        </div>
      )}
    </PageShell>
  );
}
