import { NavLink, Outlet } from "react-router-dom";
import { Avatar } from "../../shared/components";
import { supabase } from "../../shared/lib/supabase";
import { NotificationBell } from "../../features/notifications/components/NotificationBell";

const navItems = [
  { to: "/owner/dashboard", label: "Dashboard" },
  { to: "/owner/deliveries", label: "Deliveries" },
  { to: "/owner/customers", label: "Customers" },
  { to: "/owner/riders", label: "Riders" },
  { to: "/owner/settings", label: "Settings" },
];

/**
 * Owner shell (Stage 6 IA, Stage 14 folder structure). Persistent
 * sidebar nav — desktop-first, matches the Stripe/Linear reference
 * from the original design philosophy. This is the shell that pulls
 * in the heavier feature bundles (performance charts, etc.) per
 * Stage 14's route-based code-splitting rationale — the Rider shell
 * below never imports anything from here.
 */
export function OwnerLayout() {
  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 flex-col justify-between border-r border-[var(--color-border)] bg-white p-4">
        <div>
          <div className="mb-6 flex items-center gap-2 px-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary">
              <span className="text-xs font-medium text-white">D</span>
            </div>
            <span className="text-sm font-medium text-primary">
              DeliverSME
            </span>
          </div>
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-[var(--radius-control)] px-3 py-2 text-sm ${
                    isActive
                      ? "bg-[#E6F1FB] font-medium text-primary"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center justify-between px-3">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 py-2 text-left text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            <Avatar initials="?" size="sm" />
            Sign out
          </button>
          <NotificationBell />
        </div>
      </aside>
      <main className="flex-1 bg-[var(--color-bg)] p-6">
        <Outlet />
      </main>
    </div>
  );
}
