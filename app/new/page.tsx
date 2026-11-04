"use client";

import { useState } from "react";
import { assertActiveChain, checkedWrite, waitSuccess } from "@/lib/useChainWrite";
import { useRouter } from "next/navigation";
import { parseEther } from "viem";
import { useAccount, useWalletClient, usePublicClient } from "wagmi";
import PageShell from "@/components/layout/PageShell";
import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { BOTCHAIN_ABI } from "@/lib/botchain/abi";
import { activeBotChain } from "@/lib/botchain/chain";
import { getDeployment } from "@/lib/botchain/deployment";
import { formatRebateError } from "@/lib/errors";
import { MIN_PRICE, MAX_PRICE, MAX_STOCK, MAX_NAME_BYTES } from "@/lib/rebate";

export default function NewListingPage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient({ chainId: activeBotChain.id });
  const deployment = getDeployment(activeBotChain.id);

  const [name, setName] = useState("");
  const [priceStr, setPriceStr] = useState("");
  const [windowDays, setWindowDays] = useState("14");
  const [stockStr, setStockStr] = useState("10");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isConnected || !walletClient) {
      setError("Please connect your wallet first.");
      return;
    }
    if (!deployment?.address) {
      setError("Contract not deployed on this network.");
      return;
    }

    // Validations
    const trimmed = name.trim();
    if (trimmed.length === 0 || new TextEncoder().encode(trimmed).length > MAX_NAME_BYTES) {
      setError(`Item name must be between 1 and ${MAX_NAME_BYTES} bytes.`);
      return;
    }

    let parsedPrice: bigint;
    try {
      parsedPrice = parseEther(priceStr);
      if (parsedPrice < MIN_PRICE || parsedPrice > MAX_PRICE) {
        setError("Price must be between 0.001 BOT and 1,000,000 BOT.");
        return;
      }
    } catch {
      setError("Please enter a valid price in BOT.");
      return;
    }

    const days = Number(windowDays);
    if (isNaN(days) || days < 1 || days > 30) {
      setError("Protection window must be between 1 and 30 days.");
      return;
    }
    const windowSecs = BigInt(Math.round(days * 86400));

    const stock = Number(stockStr);
    if (isNaN(stock) || stock < 1 || stock > MAX_STOCK || !Number.isInteger(stock)) {
      setError(`Stock must be an integer between 1 and ${MAX_STOCK}.`);
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      await assertActiveChain(walletClient);

      const hash = await checkedWrite(walletClient, publicClient, {
        address: deployment.address,
        abi: BOTCHAIN_ABI,
        functionName: "list",
        args: [trimmed, parsedPrice, windowSecs, stock],
      });

      if (publicClient) {
        await waitSuccess(publicClient, hash);
      }

      router.push("/");
    } catch (err: unknown) {
      setError(formatRebateError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageShell
      nav={[
        { href: "/", label: "Rack" },
        { href: "/new", label: "List Item" },
        { href: "/me", label: "My Activity" },
      ]}
      title="Print New Receipt"
      description="List an item with an automatic price-protection guarantee."
    >
      <div className="max-w-xl mx-auto">
        <Panel tornEdge className="bg-white">
          <form onSubmit={handleSubmit} className="space-y-5 font-mono text-sm">
            <div className="text-center pb-3 border-b border-dashed border-[var(--border-default)]">
              <span className="text-[10px] text-[var(--text-muted)] tracking-widest uppercase">
                NEW ITEM LISTING TICKET
              </span>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-[var(--danger)] text-[var(--danger)] text-xs">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold mb-1 text-[var(--text-primary)]">
                ITEM NAME (MAX 48 BYTES)
              </label>
              <Input
                type="text"
                required
                maxLength={48}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Mechanical Keyboard"
                className="w-full font-mono text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold mb-1 text-[var(--text-primary)]">
                  OPENING PRICE (BOT)
                </label>
                <Input
                  type="number"
                  step="any"
                  required
                  min="0.001"
                  max="1000000"
                  value={priceStr}
                  onChange={(e) => setPriceStr(e.target.value)}
                  placeholder="0.5"
                  className="w-full font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 text-[var(--text-primary)]">
                  STOCK QUANTITY (1–1000)
                </label>
                <Input
                  type="number"
                  step="any"
                  required
                  min="1"
                  max="1000"
                  value={stockStr}
                  onChange={(e) => setStockStr(e.target.value)}
                  placeholder="10"
                  className="w-full font-mono text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1 text-[var(--text-primary)]">
                PROTECTION WINDOW (1–30 DAYS)
              </label>
              <Input
                type="number"
                step="any"
                required
                min="1"
                max="30"
                value={windowDays}
                onChange={(e) => setWindowDays(e.target.value)}
                placeholder="14"
                className="w-full font-mono text-sm"
              />
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                Buyers are protected against any price drops for this many days from purchase.
              </p>
            </div>

            <div className="pt-4 border-t border-dashed border-[var(--border-default)]">
              <Button
                variant="stamp"
                size="lg"
                type="submit"
                disabled={submitting}
                loading={submitting}
                className="w-full"
              >
                PRINT LISTING TO RACK
              </Button>
            </div>
          </form>
        </Panel>
      </div>
    </PageShell>
  );
}
