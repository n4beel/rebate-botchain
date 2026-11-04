"use client";

import React from "react";
import Link from "next/link";
import { formatEther } from "viem";
import { Listing, Change, refundDue, windowProgress, lowestPriceInWindow } from "@/lib/rebate";
import PriceStepChart from "@/components/receipt/PriceStepChart";
import Button from "@/components/ui/Button";

interface ReceiptStripProps {
  id: bigint;
  listing: Listing;
  changes?: Change[];
  boughtAt?: bigint;
  paid?: bigint;
  settled?: boolean;
  onBuy?: () => void;
  buying?: boolean;
  compact?: boolean;
}

/**
 * Long thermal-receipt strip component with monospace details,
 * dashed rules, price step chart, protection window progress, and torn bottom edge.
 */
export default function ReceiptStrip({
  id,
  listing,
  changes = [],
  boughtAt,
  paid,
  settled,
  onBuy,
  buying = false,
  compact = false,
}: ReceiptStripProps) {
  const windowDays = Number(listing.windowSecs) / 86400;
  const isSoldOut = listing.stock === 0;

  // If purchase details provided, compute refund metrics
  const isBuyer = boughtAt !== undefined && paid !== undefined;
  const refund = isBuyer && changes.length > 0 ? refundDue(paid, boughtAt, listing.windowSecs, changes) : 0n;
  const lowest = isBuyer && changes.length > 0 ? lowestPriceInWindow(boughtAt, listing.windowSecs, changes) : listing.price;
  const progress = isBuyer ? windowProgress(boughtAt, listing.windowSecs) : 0;
  const endsAt = isBuyer ? Number(boughtAt + listing.windowSecs) : 0;
  const isEnded = isBuyer ? Date.now() / 1000 >= endsAt : false;

  return (
    <article
      className="receipt-strip relative flex flex-col bg-white border border-[var(--border-default)] shadow-sm hover:shadow-md transition-shadow font-mono text-sm torn-edge pb-10"
      style={{
        maxWidth: compact ? "380px" : "100%",
        width: "100%",
        color: "var(--text-primary)",
      }}
    >
      {/* Top Header of Receipt */}
      <div className="p-5 pb-3 border-b border-dashed border-[var(--border-default)] text-center space-y-1">
        <div className="text-[10px] tracking-widest text-[var(--text-muted)] uppercase">
          BOTCHAIN PRICE PROTECTION RECEIPT
        </div>
        <div className="text-xs text-[var(--text-muted)]">
          ITEM REF #{id.toString().padStart(4, "0")}
        </div>
        <h2 className="text-xl font-bold font-sans tracking-tight pt-1 text-[var(--text-primary)]">
          {listing.name}
        </h2>
      </div>

      {/* Main Details Body */}
      <div className="p-5 space-y-4 flex-1">
        {/* Listing Stats Row */}
        <div className="grid grid-cols-2 gap-2 text-xs border-b border-dashed border-[var(--border-subtle)] pb-3">
          <div>
            <span className="text-[var(--text-muted)] block text-[10px]">CURRENT PRICE</span>
            <span className="text-base font-bold text-[var(--text-primary)]">
              {formatEther(listing.price)} BOT
            </span>
          </div>
          <div className="text-right">
            <span className="text-[var(--text-muted)] block text-[10px]">PROTECTION</span>
            <span className="font-semibold text-[var(--accent)]">
              {windowDays.toFixed(windowDays % 1 === 0 ? 0 : 1)} DAYS
            </span>
          </div>
          <div>
            <span className="text-[var(--text-muted)] block text-[10px]">REMAINING STOCK</span>
            <span className={isSoldOut ? "text-[var(--danger)] font-bold" : "font-semibold"}>
              {listing.stock} units
            </span>
          </div>
          <div className="text-right">
            <span className="text-[var(--text-muted)] block text-[10px]">SELLER</span>
            <span className="text-[11px] text-[var(--text-muted)]">
              {listing.seller.slice(0, 6)}...{listing.seller.slice(-4)}
            </span>
          </div>
        </div>

        {/* Stepped Price History Chart (expanded view) */}
        {!compact && changes.length > 0 && (
          <div className="py-2">
            <PriceStepChart
              changes={changes}
              currentPrice={listing.price}
              windowSecs={listing.windowSecs}
              boughtAt={boughtAt}
            />
          </div>
        )}

        {/* Buyer Specific Refund Meter & Progress */}
        {isBuyer && (
          <div className="bg-[#F2F59B]/25 p-3 border border-[var(--border-subtle)] space-y-2 text-xs">
            <div className="flex justify-between font-bold">
              <span>REFUND METER</span>
              <span className={refund > 0n ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}>
                {changes.length === 0 ? "—" : `${formatEther(refund)} BOT DUE`}
              </span>
            </div>

            <div className="text-[11px] space-y-0.5 text-[var(--text-muted)]">
              <div className="flex justify-between">
                <span>You paid:</span>
                <span className="text-[var(--text-primary)] font-semibold">{formatEther(paid)} BOT</span>
              </div>
              <div className="flex justify-between">
                <span>Lowest seen in window:</span>
                <span className="text-[var(--text-primary)] font-semibold">{formatEther(lowest)} BOT</span>
              </div>
            </div>

            {/* Protection window countdown & bar */}
            <div className="pt-2">
              <div className="flex justify-between text-[10px] text-[var(--text-muted)] mb-1">
                <span>WINDOW PROGRESS</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-[var(--border-subtle)] h-1.5 overflow-hidden">
                <div
                  className="bg-[var(--accent)] h-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="text-[10px] text-right mt-1 text-[var(--text-muted)]">
                {isEnded ? "Protection window ended" : `Ends: ${new Date(endsAt * 1000).toLocaleString()}`}
              </div>
            </div>
          </div>
        )}

        {/* Protection Terms Note */}
        <div className="text-[11px] text-[var(--text-muted)] leading-relaxed border-t border-dashed border-[var(--border-subtle)] pt-3">
          Protects against this seller's price cuts on this listing for {windowDays} days.
        </div>
      </div>

      {/* Action Area / Stamped Buy Block */}
      <div className="px-5 pb-5">
        {onBuy && (
          <Button
            variant="stamp"
            size="lg"
            className="w-full text-center"
            disabled={isSoldOut || buying}
            loading={buying}
            onClick={onBuy}
          >
            {isSoldOut ? "SOLD OUT" : `BUY — PROTECTED FOR ${windowDays} DAYS`}
          </Button>
        )}

        {compact && (
          <Link
            href={`/item/${id}`}
            className="block text-center text-xs font-sans font-semibold text-[var(--accent)] hover:underline pt-2"
          >
            VIEW DETAILS &amp; HISTORY &rarr;
          </Link>
        )}
      </div>
    </article>
  );
}
