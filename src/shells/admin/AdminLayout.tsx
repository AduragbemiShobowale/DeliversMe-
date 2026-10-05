import { NavLink, Outlet } from "react-router-dom";
import { supabase } from "../../shared/lib/supabase";

const navItems = [
  { to: "/admin/businesses", label: "Businesses" },
  { to: "/admin/riders", label: "Riders" },
];

/**
 * Admin shell — deliberately minimal top nav, two items. Per Stage 2/10's
 * repeated finding: Admin has no framework-pillar backing, so this shell
 * gets no design investment beyond functional. Desktop-only per Stage 13.
 */
export function AdminLayout() {
  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="flex items-center justify-between border-b border-[var(--color-border)] bg-white px-6 py-3">
        <div className="flex items-center gap-6">
          <span className="text-sm font-medium text-primary">
            DeliverSME admin
          </span>
          <nav className="flex gap-4">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `text-sm ${
                    isActive
                      ? "font-medium text-primary"
                      : "text-[var(--color-text-secondary)]"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <button
          onClick={handleSignOut}
          className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          Sign out
        </button>
      </header>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}
