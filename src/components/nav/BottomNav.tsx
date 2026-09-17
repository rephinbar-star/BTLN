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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-btln-line bg-background/95 backdrop-blur md:hidden"
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
                className={`flex min-h-[56px] flex-col items-center justify-center gap-1 px-2 py-2 text-[12px] ${
                  active ? "text-btln-forest font-medium" : "text-muted-foreground"
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
