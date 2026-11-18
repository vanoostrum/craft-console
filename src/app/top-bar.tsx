import Link from "next/link";
import type { ReactNode } from "react";

const TABS = [
  { href: "/", label: "Projects" },
  { href: "/versions", label: "Craft versions" },
] as const;

export function TopBar({
  current,
  tools,
}: {
  current: (typeof TABS)[number]["href"];
  /** Controls at the right of the bar, such as the Shade by switch. */
  tools?: ReactNode;
}) {
  return (
    <header className="topbar">
      <div className="logo">craft://console</div>
      <nav className="tabs" aria-label="Main">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={tab.href === current ? "page" : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {tools && <div className="tools">{tools}</div>}
    </header>
  );
}
