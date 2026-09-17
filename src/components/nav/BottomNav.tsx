import { Link, useLocation } from "react-router-dom";
import { Compass, Home, Library } from "lucide-react";

const items = [
  { to: "/", label: "Start", icon: Home },
  { to: "/account", label: "My reads", icon: Library },
  { to: "/explore", label: "Explore", icon: Compass },
];

/**
 * Bottom navigation for browsing screens (home, explore, account).
 * Deliberately not rendered on focused input or checkout screens, where a
 * single primary action owns the bottom of the screen.
 */
export const BottomNav = () => {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-btln-line bg-btln-paper/95 px-2 pt-2 backdrop-blur md:static md:mx-auto md:mb-8 md:max-w-2xl md:rounded-[20px] md:border md:p-2"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {items.map(({ to, label, icon: Icon }) => {
          const active = pathname === to;
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-[14px] px-2 py-2 text-[12px] ${
                  active ? "bg-btln-mint text-btln-ink font-semibold" : "text-muted-foreground hover:bg-btln-mint/50"
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
