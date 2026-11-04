"use client";

import React from "react";
import { formatEther } from "viem";
import { Change, stepSeries, StepPoint } from "@/lib/rebate";

interface PriceStepChartProps {
  changes: Change[];
  currentPrice: bigint;
  windowSecs?: bigint;
  boughtAt?: bigint;
  className?: string;
}

/**
 * Step chart SVG with accessible data table alternative for price history.
 */
export default function PriceStepChart({
  changes,
  currentPrice,
  windowSecs,
  boughtAt,
  className = "",
}: PriceStepChartProps) {
  if (!changes || changes.length === 0) {
    return (
      <div className="py-4 text-center text-xs font-mono text-[var(--text-muted)] border border-dashed border-[var(--border-default)]">
        No price changes recorded yet.
      </div>
    );
  }

  const series: StepPoint[] = stepSeries(changes);

  // Compute SVG dimensions and bounds
  const width = 400;
  const height = 140;
  const padLeft = 50;
  const padRight = 20;
  const padTop = 15;
  const padBottom = 25;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const minTime = Number(series[0].time);
  const maxTime = Math.max(
    Number(series[series.length - 1].time),
    boughtAt && windowSecs ? Number(boughtAt + windowSecs) : minTime + 1
  );
  const timeSpan = maxTime === minTime ? 1 : maxTime - minTime;

  let minP = Number(series[0].price);
  let maxP = Number(series[0].price);
  for (const pt of series) {
    const p = Number(pt.price);
    if (p < minP) minP = p;
    if (p > maxP) maxP = p;
  }
  const priceSpan = maxP === minP ? 1 : maxP - minP;

  const getX = (t: number) => padLeft + ((t - minTime) / timeSpan) * chartW;
  const getY = (p: number) => padTop + chartH - ((p - minP) / priceSpan) * chartH;

  // Build SVG path
  let pathD = "";
  for (let i = 0; i < series.length; i++) {
    const x = getX(Number(series[i].time));
    const y = getY(Number(series[i].price));
    if (i === 0) {
      pathD += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
    } else {
      const prevY = getY(Number(series[i - 1].price));
      pathD += ` L ${x.toFixed(1)} ${prevY.toFixed(1)} L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
  }

  // Draw extension to right edge
  const lastY = getY(Number(series[series.length - 1].price));
  pathD += ` L ${(padLeft + chartW).toFixed(1)} ${lastY.toFixed(1)}`;

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between text-xs font-mono text-[var(--text-muted)] border-b border-dashed border-[var(--border-subtle)] pb-1">
        <span>PRICE HISTORY (STEP CHART)</span>
        <span>{changes.length} / 24 EDITIONS</span>
      </div>

      {/* SVG Step Chart */}
      <div className="relative w-full overflow-hidden bg-white/60 p-2 border border-[var(--border-subtle)]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto block select-none"
          role="img"
          aria-label="Stepped price history chart"
        >
          {/* Horizontal grid lines */}
          <line
            x1={padLeft}
            y1={padTop}
            x2={padLeft + chartW}
            y2={padTop}
            stroke="#D4D785"
            strokeDasharray="2 2"
          />
          <line
            x1={padLeft}
            y1={padTop + chartH / 2}
            x2={padLeft + chartW}
            y2={padTop + chartH / 2}
            stroke="#D4D785"
            strokeDasharray="2 2"
          />
          <line
            x1={padLeft}
            y1={padTop + chartH}
            x2={padLeft + chartW}
            y2={padTop + chartH}
            stroke="#B7BA70"
          />

          {/* Vertical axis line */}
          <line
            x1={padLeft}
            y1={padTop}
            x2={padLeft}
            y2={padTop + chartH}
            stroke="#B7BA70"
          />

          {/* Price Labels */}
          <text
            x={padLeft - 6}
            y={padTop + 4}
            textAnchor="end"
            fontSize="9"
            fontFamily="monospace"
            fill="#6A6E38"
          >
            {formatEther(BigInt(Math.round(maxP)))}
          </text>
          <text
            x={padLeft - 6}
            y={padTop + chartH + 3}
            textAnchor="end"
            fontSize="9"
            fontFamily="monospace"
            fill="#6A6E38"
          >
            {formatEther(BigInt(Math.round(minP)))}
          </text>

          {/* Stepped line */}
          <path
            d={pathD}
            fill="none"
            stroke="#C2185B"
            strokeWidth="2.5"
            strokeLinejoin="miter"
          />

          {/* Data point dots */}
          {series.map((pt, i) => {
            const cx = getX(Number(pt.time));
            const cy = getY(Number(pt.price));
            return (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r="3"
                fill="#1E2200"
                stroke="#F2F59B"
                strokeWidth="1.5"
              />
            );
          })}
        </svg>
      </div>

      {/* Accessible data table for screen readers and verification */}
      <details className="text-xs">
        <summary className="cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          View price history table
        </summary>
        <div className="mt-2 max-h-40 overflow-y-auto border border-[var(--border-subtle)] bg-white text-xs font-mono">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[#F2F59B]/30 text-left">
                <th className="p-1.5">#</th>
                <th className="p-1.5">Recorded At</th>
                <th className="p-1.5 text-right">Price (BOT)</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((c, i) => (
                <tr key={i} className="border-b border-[var(--border-subtle)] last:border-0">
                  <td className="p-1.5">{i === 0 ? "Initial" : `Cut #${i}`}</td>
                  <td className="p-1.5">{new Date(Number(c.at) * 1000).toLocaleString()}</td>
                  <td className="p-1.5 text-right font-semibold">{formatEther(c.price)} BOT</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
