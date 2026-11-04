"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ConnectButton from "@/components/ui/ConnectButton";
import NetworkBadge from "@/components/botchain/NetworkBadge";
import { footerLinks } from "@/lib/botchain/chain";
import BuiltOnBotChain from "@/components/botchain/BuiltOnBotChain";
import { app } from "@/lib/app-config";

export type NavItem = { href: string; label: string };

interface PageShellProps {
  children: React.ReactNode;
  nav?: NavItem[];
  title?: string;
  description?: string;
}

/**
 * PageShell for Rebate (Archetype AW · Receipt strip).
 * Features a top navigation banner and clean rack layout on warm yellow base.
 */
export default function PageShell({ children, nav = [], title, description }: PageShellProps) {
  const links = footerLinks();
  const pathname = usePathname();

  return (
    <div
      className="min-h-screen flex flex-col font-sans selection:bg-[#C2185B] selection:text-white"
      style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}
    >
      {/* Top Banner Header */}
      <header
        className="sticky top-0 z-30 flex-shrink-0"
        style={{
          borderBottom: "1px solid var(--border-default)",
          background: "var(--bg-surface)",
        }}
      >
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
          <div className="flex items-center justify-between gap-4 py-3">
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center gap-2.5 no-underline group">
                <span
                  className="w-3.5 h-3.5 rounded-none flex-shrink-0 transform rotate-45 transition-transform group-hover:scale-110"
                  style={{ background: "var(--accent)" }}
                />
                <span className="font-semibold text-lg tracking-tight" style={{ color: "var(--text-primary)" }}>
                  {app.name}
                </span>
              </Link>

              {nav.length > 0 && (
                <nav className="hidden sm:flex items-center gap-1 text-sm font-medium">
                  {nav.map((item) => {
                    const active = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={[
                          "px-3 py-1.5 transition-colors no-underline rounded-none",
                          active
                            ? "bg-[#1E2200] text-white"
                            : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[#F2F59B]/50",
                        ].join(" ")}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>
              )}
            </div>

            <div className="flex items-center gap-3">
              <NetworkBadge />
              <ConnectButton />
            </div>
          </div>

          {/* Mobile sub-nav */}
          {nav.length > 0 && (
            <div className="sm:hidden flex items-center gap-2 pb-2.5 overflow-x-auto text-xs font-medium border-t border-[var(--border-subtle)] pt-2">
              {nav.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      "px-2.5 py-1 transition-colors no-underline whitespace-nowrap",
                      active
                        ? "bg-[#1E2200] text-white"
                        : "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
                    ].join(" ")}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 md:py-8">
        {(title || description) && (
          <div className="mb-6 md:mb-8 border-b border-[var(--border-subtle)] pb-4">
            {title && (
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-1" style={{ color: "var(--text-primary)" }}>
                {title}
              </h1>
            )}
            {description && (
              <p className="text-sm md:text-base" style={{ color: "var(--text-muted)" }}>
                {description}
              </p>
            )}
          </div>
        )}

        {children}
      </main>

      {/* 3-Link Shared Footer */}
      <footer
        className="mt-auto border-t py-6 text-xs text-[var(--text-muted)] bg-[var(--bg-surface)]"
        style={{ borderColor: "var(--border-default)" }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <BuiltOnBotChain />
            <span>•</span>
            <span>{app.tagline}</span>
          </div>

          <div className="flex items-center gap-4">
            {links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="hover:underline transition-colors hover:text-[var(--text-primary)]"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
