import Link from "next/link";

const TABS = [
  { href: "/", label: "Projects" },
  { href: "/versions", label: "Craft versions" },
] as const;

export function TopBar({
  current,
}: {
  current: (typeof TABS)[number]["href"];
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
    </header>
  );
}
