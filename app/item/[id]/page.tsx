"use client";

import { useEffect, useState, use } from "react";
import { assertActiveChain, checkedWrite, waitSuccess } from "@/lib/useChainWrite";
import { formatEther, parseEther } from "viem";
import { useAccount, useWalletClient, usePublicClient } from "wagmi";
import PageShell from "@/components/layout/PageShell";
import ReceiptStrip from "@/components/receipt/ReceiptStrip";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Panel from "@/components/ui/Panel";
import { BOTCHAIN_ABI } from "@/lib/botchain/abi";
import { activeBotChain } from "@/lib/botchain/chain";
import { getDeployment } from "@/lib/botchain/deployment";
import { formatRebateError } from "@/lib/errors";
import { Listing, Change } from "@/lib/rebate";

export default function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const id = BigInt(resolvedParams.id);

  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient({ chainId: activeBotChain.id });
  const deployment = getDeployment(activeBotChain.id);

  const [listing, setListing] = useState<Listing | null>(null);
  const [changes, setChanges] = useState<Change[]>([]);
  const [loading, setLoading] = useState(true);

  const [buying, setBuying] = useState(false);
  const [newPriceStr, setNewPriceStr] = useState("");
  const [updatingPrice, setUpdatingPrice] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const isSeller = address && listing && address.toLowerCase() === listing.seller.toLowerCase();

  // Load listing and changes
  async function loadData() {
    if (!publicClient || !deployment?.address) return;
    try {
      const l = (await publicClient.readContract({
        address: deployment.address,
        abi: BOTCHAIN_ABI,
        functionName: "listingOf",
        args: [id],
      })) as { seller: `0x${string}`; windowSecs: bigint; stock: number; price: bigint; name: string };

      const ch = (await publicClient.readContract({
        address: deployment.address,
        abi: BOTCHAIN_ABI,
        functionName: "changesOf",
        args: [id],
      })) as { at: bigint; price: bigint }[];

      setListing({
        seller: l.seller,
        windowSecs: l.windowSecs,
        stock: l.stock,
        price: l.price,
        name: l.name,
      });
      setChanges(ch);
    } catch (err) {
      console.error("Failed to load item:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, [deployment?.address, id]);

  // Handle Buy action
  async function handleBuy() {
    if (!isConnected || !walletClient) {
      setMessage({ type: "error", text: "Please connect your wallet first." });
      return;
    }
    if (!publicClient || !deployment?.address || !listing) return;

    try {
      setBuying(true);
      setMessage(null);

      // Re-read price right before sending to protect user against frontrunning
      const latestListing = (await publicClient.readContract({
        address: deployment.address,
        abi: BOTCHAIN_ABI,
        functionName: "listingOf",
        args: [id],
      })) as { seller: `0x${string}`; windowSecs: bigint; stock: number; price: bigint; name: string };

      if (latestListing.price !== listing.price) {
        setListing(latestListing);
        setMessage({
          type: "error",
          text: `The price is now ${formatEther(latestListing.price)} BOT. Review and try again.`,
        });
        setBuying(false);
        return;
      }

      await assertActiveChain(walletClient);

      const hash = await checkedWrite(walletClient, publicClient, {
        address: deployment.address,
        abi: BOTCHAIN_ABI,
        functionName: "buy",
        args: [id],
        value: latestListing.price,
      });

      await waitSuccess(publicClient, hash);
      setMessage({ type: "success", text: "Purchase successful! Your price protection is now active." });
      await loadData();
    } catch (err) {
      setMessage({ type: "error", text: formatRebateError(err) });
    } finally {
      setBuying(false);
    }
  }

  // Handle Seller Price Change
  async function handlePriceChange(e: React.FormEvent) {
    e.preventDefault();
    if (!isSeller || !walletClient || !publicClient || !deployment?.address) return;

    try {
      setUpdatingPrice(true);
      setMessage(null);

      const parsed = parseEther(newPriceStr);
      await assertActiveChain(walletClient);
      const hash = await checkedWrite(walletClient, publicClient, {
        address: deployment.address,
        abi: BOTCHAIN_ABI,
        functionName: "setPrice",
        args: [id, parsed],
      });

      await waitSuccess(publicClient, hash);
      setMessage({ type: "success", text: `Price successfully updated to ${newPriceStr} BOT.` });
      setNewPriceStr("");
      await loadData();
    } catch (err) {
      setMessage({ type: "error", text: formatRebateError(err) });
    } finally {
      setUpdatingPrice(false);
    }
  }

  return (
    <PageShell
      nav={[
        { href: "/", label: "Rack" },
        { href: "/new", label: "List Item" },
        { href: "/me", label: "My Activity" },
      ]}
      title={`Item #${id.toString()}`}
      description="Inspect item details, price history, and buy with automatic rebate protection."
    >
      <div className="max-w-2xl mx-auto space-y-6">
        {message && (
          <div
            className={`p-4 border text-xs font-mono ${
              message.type === "success"
                ? "bg-emerald-50 border-[var(--success)] text-[var(--success)]"
                : "bg-red-50 border-[var(--danger)] text-[var(--danger)]"
            }`}
          >
            {message.text}
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center text-sm font-mono text-[var(--text-muted)]">
            FETCHING RECEIPT #{id.toString()}...
          </div>
        ) : !listing ? (
          <div className="py-16 text-center border-2 border-dashed border-[var(--border-default)] p-8">
            <div className="font-mono text-sm text-[var(--danger)]">
              ITEM NOT FOUND OR INVALID ID
            </div>
          </div>
        ) : (
          <>
            {/* The Main Receipt Strip */}
            <ReceiptStrip
              id={id}
              listing={listing}
              changes={changes}
              onBuy={isSeller ? undefined : handleBuy}
              buying={buying}
            />

            {/* Explanation card */}
            <div className="p-4 bg-white/70 border border-[var(--border-subtle)] text-xs font-mono space-y-1">
              <span className="font-bold text-[var(--text-primary)]">PRICE GUARANTEE TERMS:</span>
              <p className="text-[var(--text-muted)]">
                You pay {formatEther(listing.price)} BOT now. If the price falls before the protection window ends, you get the difference back.
              </p>
            </div>

            {/* Seller Management Panel */}
            {isSeller && (
              <Panel dashed className="bg-white">
                <div className="space-y-4 font-mono text-xs">
                  <div className="flex items-center justify-between border-b border-dashed border-[var(--border-subtle)] pb-2 font-bold">
                    <span>SELLER CONTROLS</span>
                    <span className="text-[var(--accent)]">YOU OWN THIS LISTING</span>
                  </div>

                  <form onSubmit={handlePriceChange} className="space-y-3">
                    <div>
                      <label className="block font-semibold mb-1">
                        ADJUST PRICE (EDITION {changes.length + 1} OF 24)
                      </label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          step="any"
                          required
                          min="0.001"
                          max="1000000"
                          value={newPriceStr}
                          onChange={(e) => setNewPriceStr(e.target.value)}
                          placeholder="e.g. 0.45"
                          className="flex-1 font-mono text-sm"
                        />
                        <Button
                          variant="secondary"
                          type="submit"
                          disabled={updatingPrice || changes.length >= 24}
                          loading={updatingPrice}
                        >
                          SET NEW PRICE
                        </Button>
                      </div>
                      <p className="text-[10px] text-[var(--text-muted)] mt-1">
                        Lowering price creates automatic refund eligibility for active buyers in their window.
                      </p>
                    </div>
                  </form>
                </div>
              </Panel>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}
