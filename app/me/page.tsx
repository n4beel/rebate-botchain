"use client";

import { useEffect, useState } from "react";
import { assertActiveChain, checkedWrite, waitSuccess } from "@/lib/useChainWrite";
import Link from "next/link";
import { formatEther } from "viem";
import { useAccount, useWalletClient, usePublicClient } from "wagmi";
import PageShell from "@/components/layout/PageShell";
import ReceiptStrip from "@/components/receipt/ReceiptStrip";
import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";
import { BOTCHAIN_ABI } from "@/lib/botchain/abi";
import { activeBotChain } from "@/lib/botchain/chain";
import { getDeployment } from "@/lib/botchain/deployment";
import { formatRebateError } from "@/lib/errors";
import { Listing, Change, Purchase } from "@/lib/rebate";

interface PurchaseWithDetails {
  id: bigint;
  purchase: Purchase;
  listing: Listing;
  changes: Change[];
}

export default function MyActivityPage() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient({ chainId: activeBotChain.id });
  const deployment = getDeployment(activeBotChain.id);

  const [purchases, setPurchases] = useState<PurchaseWithDetails[]>([]);
  const [pendingBalance, setPendingBalance] = useState<bigint>(0n);
  const [loading, setLoading] = useState(true);

  const [settlingId, setSettlingId] = useState<bigint | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function loadData() {
    if (!publicClient || !deployment?.address || !address) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);

      // Read pending balance
      const p = (await publicClient.readContract({
        address: deployment.address,
        abi: BOTCHAIN_ABI,
        functionName: "pending",
        args: [address],
      })) as bigint;
      setPendingBalance(p);

      // Read buyer purchases
      const [ids, rawPurchases] = (await publicClient.readContract({
        address: deployment.address,
        abi: BOTCHAIN_ABI,
        functionName: "purchasesBy",
        args: [address, 0n, 50n],
      })) as [bigint[], { listingId: bigint; buyer: `0x${string}`; boughtAt: bigint; paid: bigint; settled: boolean }[], bigint];

      // For each purchase, fetch the listing and changes
      const full = await Promise.all(
        ids.map(async (pid, idx) => {
          const rawP = rawPurchases[idx];
          const l = (await publicClient.readContract({
            address: deployment.address,
            abi: BOTCHAIN_ABI,
            functionName: "listingOf",
            args: [rawP.listingId],
          })) as { seller: `0x${string}`; windowSecs: bigint; stock: number; price: bigint; name: string };

          const ch = (await publicClient.readContract({
            address: deployment.address,
            abi: BOTCHAIN_ABI,
            functionName: "changesOf",
            args: [rawP.listingId],
          })) as { at: bigint; price: bigint }[];

          return {
            id: pid,
            purchase: {
              listingId: rawP.listingId,
              buyer: rawP.buyer,
              boughtAt: rawP.boughtAt,
              paid: rawP.paid,
              settled: rawP.settled,
            },
            listing: {
              seller: l.seller,
              windowSecs: l.windowSecs,
              stock: l.stock,
              price: l.price,
              name: l.name,
            },
            changes: ch,
          };
        })
      );

      setPurchases(full);
    } catch (err) {
      console.error("Failed to load activity:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, [deployment?.address, address]);

  // Handle Settle
  async function handleSettle(pid: bigint) {
    if (!walletClient || !publicClient || !deployment?.address) return;
    try {
      setSettlingId(pid);
      setMessage(null);

      await assertActiveChain(walletClient);

      const hash = await checkedWrite(walletClient, publicClient, {
        address: deployment.address,
        abi: BOTCHAIN_ABI,
        functionName: "settle",
        args: [pid],
      });

      await waitSuccess(publicClient, hash);
      setMessage({ type: "success", text: `Purchase #${pid.toString()} settled successfully! Funds moved to pending balances.` });
      await loadData();
    } catch (err) {
      setMessage({ type: "error", text: formatRebateError(err) });
    } finally {
      setSettlingId(null);
    }
  }

  // Handle Withdraw
  async function handleWithdraw() {
    if (!walletClient || !publicClient || !deployment?.address) return;
    try {
      setWithdrawing(true);
      setMessage(null);

      await assertActiveChain(walletClient);

      const hash = await checkedWrite(walletClient, publicClient, {
        address: deployment.address,
        abi: BOTCHAIN_ABI,
        functionName: "withdraw",
        args: [],
      });

      await waitSuccess(publicClient, hash);
      setMessage({ type: "success", text: "Successfully withdrew pending funds to your wallet!" });
      await loadData();
    } catch (err) {
      setMessage({ type: "error", text: formatRebateError(err) });
    } finally {
      setWithdrawing(false);
    }
  }

  return (
    <PageShell
      nav={[
        { href: "/", label: "Rack" },
        { href: "/new", label: "List Item" },
        { href: "/me", label: "My Activity" },
      ]}
      title="My Protected Receipts"
      description="Track your purchases, active protection windows, live refunds, and pending withdrawals."
    >
      <div className="space-y-6">
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

        {/* Pending balance banner */}
        <Panel tornEdge className="bg-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono text-xs">
            <div>
              <span className="text-[10px] tracking-widest text-[var(--text-muted)] uppercase block">
                AVAILABLE PENDING BALANCE
              </span>
              <span className="text-2xl font-bold font-sans text-[var(--text-primary)]">
                {formatEther(pendingBalance)} BOT
              </span>
              <p className="text-[11px] text-[var(--text-muted)] mt-1">
                Accumulated refunds or sales proceeds released after settlement.
              </p>
            </div>

            <Button
              variant="stamp"
              size="md"
              disabled={withdrawing || pendingBalance === 0n || !isConnected}
              loading={withdrawing}
              onClick={handleWithdraw}
            >
              WITHDRAW ALL TO WALLET
            </Button>
          </div>
        </Panel>

        {/* Purchases section */}
        <div>
          <h2 className="text-lg font-bold font-sans mb-4 text-[var(--text-primary)]">
            Purchases &amp; Active Guarantees
          </h2>

          {!isConnected ? (
            <div className="p-8 text-center border-2 border-dashed border-[var(--border-default)] bg-white/50 font-mono text-xs text-[var(--text-muted)]">
              CONNECT WALLET TO VIEW YOUR PROTECTED PURCHASES
            </div>
          ) : loading ? (
            <div className="py-12 text-center font-mono text-xs text-[var(--text-muted)]">
              LOADING YOUR RECEIPTS...
            </div>
          ) : purchases.length === 0 ? (
            <div className="p-8 text-center border-2 border-dashed border-[var(--border-default)] bg-white/50 space-y-3">
              <div className="font-mono text-xs text-[var(--text-muted)]">
                YOU HAVE NOT BOUGHT ANY ITEMS UNDER PRICE PROTECTION YET.
              </div>
              <Link href="/">
                <Button variant="secondary" size="sm">
                  Browse the Rack
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {purchases.map(({ id: pid, purchase, listing, changes }) => {
                const endsAt = Number(purchase.boughtAt + listing.windowSecs);
                const isOver = Math.floor(Date.now() / 1000) >= endsAt;

                return (
                  <div key={pid.toString()} className="space-y-2">
                    <ReceiptStrip
                      id={purchase.listingId}
                      listing={listing}
                      changes={changes}
                      boughtAt={purchase.boughtAt}
                      paid={purchase.paid}
                      settled={purchase.settled}
                    />

                    {/* Settle Action Bar */}
                    <div className="bg-white p-3 border border-[var(--border-subtle)] flex items-center justify-between font-mono text-xs">
                      <div>
                        <span className="block text-[10px] text-[var(--text-muted)]">STATUS</span>
                        <span className="font-bold">
                          {purchase.settled
                            ? "SETTLED"
                            : isOver
                            ? "WINDOW EXPIRED"
                            : "PROTECTION ACTIVE"}
                        </span>
                      </div>

                      {!purchase.settled && (
                        <Button
                          variant={isOver ? "primary" : "secondary"}
                          size="sm"
                          disabled={!isOver || settlingId === pid}
                          loading={settlingId === pid}
                          onClick={() => handleSettle(pid)}
                        >
                          {isOver ? "SETTLE NOW" : "LOCKED IN WINDOW"}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
