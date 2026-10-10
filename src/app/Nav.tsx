"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; icon: React.ReactNode };

const I = {
  home: <path d="M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" />,
  list: <path d="M4 6h16M4 12h16M4 18h10" />,
  upload: <path d="M12 16V4m0 0l-4 4m4-4l4 4M4 20h16" />,
  chart: <path d="M4 20V10m6 10V4m6 16v-7m4 7H2" />,
  rules: <path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4zM5 17l.9 2.1L8 20l-2.1.9L5 23l-.9-2.1L2 20l2.1-.9z" />,
  target: <path d="M12 21a9 9 0 100-18 9 9 0 000 18zm0-4a5 5 0 100-10 5 5 0 000 10zm0-4a1 1 0 100-2 1 1 0 000 2z" />,
  card: <path d="M2 7a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2zm0 3h20M6 15h4" />,
  bank: <path d="M3 10h18M5 10v8m4-8v8m6-8v8m4-8v8M2 21h20M12 3l10 6H2z" />,
};

const items: Item[] = [
  { href: "/", label: "Home", icon: I.home },
  { href: "/plan", label: "Plan", icon: I.target },
  { href: "/transactions", label: "Txns", icon: I.list },
  { href: "/upload", label: "Upload", icon: I.upload },
  { href: "/cards", label: "Cards", icon: I.card },
  { href: "/investments", label: "Invest", icon: I.chart },
  { href: "/rules", label: "Rules", icon: I.rules },
  { href: "/accounts", label: "Accounts", icon: I.bank },
];

const Icon = ({ d }: { d: React.ReactNode }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d}
  </svg>
);

export function Nav() {
  const path = usePathname();
  if (path.startsWith("/login")) return null;
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <>
      {/* Desktop top bar */}
      <header className="sticky top-0 z-10 hidden border-b border-line bg-surface/80 backdrop-blur sm:block">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-1 px-6">
          <Link href="/" className="mr-4 text-base font-semibold tracking-tight">
            Paisa
          </Link>
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                active(it.href) ? "bg-ink text-white" : "text-muted hover:bg-bg hover:text-ink"
              }`}
            >
              {it.label}
            </Link>
          ))}
        </div>
      </header>

      {/* Phone bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
        <div className="grid grid-cols-8">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
                active(it.href) ? "text-ink" : "text-muted"
              }`}
            >
              <Icon d={it.icon} />
              {it.label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
