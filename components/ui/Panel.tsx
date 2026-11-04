import { HTMLAttributes, ReactNode } from "react";

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
  noPadding?: boolean;
  tornEdge?: boolean;
  dashed?: boolean;
  children?: ReactNode;
}

/**
 * Rebate panel styled with Archetype AW thermal receipt motif.
 */
export default function Panel({
  elevated,
  noPadding,
  tornEdge = false,
  dashed = false,
  children,
  className = "",
  style,
  ...props
}: PanelProps) {
  return (
    <div
      className={[
        "relative transition-shadow duration-150",
        noPadding ? "" : "p-5 md:p-6",
        dashed ? "border-dashed" : "border-solid",
        tornEdge ? "torn-edge pb-7" : "",
        className,
      ].join(" ")}
      style={{
        background: elevated ? "var(--bg-elevated, #FAFAFA)" : "var(--bg-surface)",
        borderWidth: "1px",
        borderColor: dashed ? "var(--border-default)" : "var(--border-subtle)",
        color: "var(--text-primary)",
        boxShadow: elevated ? "0 2px 8px rgba(30, 34, 0, 0.06)" : "none",
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
