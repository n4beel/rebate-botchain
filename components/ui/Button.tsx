"use client";

import { ButtonHTMLAttributes, CSSProperties, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "stamp";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantInlineStyles: Record<Variant, CSSProperties> = {
  primary: { background: "var(--accent)", color: "var(--accent-ink)", border: "1px solid var(--accent)" },
  secondary: { background: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border-default)" },
  ghost: { background: "transparent", color: "var(--text-primary)", border: "1px dashed var(--border-default)" },
  danger: { background: "transparent", border: "1px solid var(--danger)", color: "var(--danger)" },
  stamp: {
    background: "var(--accent)",
    color: "var(--accent-ink)",
    border: "2px solid #1E2200",
    boxShadow: "3px 3px 0px #1E2200",
    letterSpacing: "0.05em",
  },
};

const sizeStyles: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs font-semibold",
  md: "px-5 py-2.5 text-sm font-semibold",
  lg: "px-6 py-3.5 text-base font-bold",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, disabled, children, className = "", style, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={[
          "inline-flex items-center justify-center gap-2 rounded-none transition-all active:translate-y-0.5",
          "cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none select-none",
          variant === "stamp" ? "uppercase font-mono" : "",
          sizeStyles[size],
          className,
        ].join(" ")}
        style={{ ...variantInlineStyles[variant], ...style }}
        {...props}
      >
        {loading ? (
          <>
            <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span>{children}</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;
