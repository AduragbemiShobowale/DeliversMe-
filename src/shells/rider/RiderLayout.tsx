import { NavLink, Outlet } from "react-router-dom";
import { NotificationBell } from "../../features/notifications/components/NotificationBell";

const navItems = [
  { to: "/rider/jobs", label: "Jobs" },
  { to: "/rider/history", label: "History" },
];

/**
 * Rider shell (Stage 6 IA). Bottom tab bar, 2 items max, thumb-reachable
 * — deliberately minimal, per the mid-range-Android/sunlight/mobile-data
 * persona (Stage 2). This shell must NEVER import anything from
 * features/performance or any Owner-only feature — that's what keeps
 * the Rider bundle light per Stage 14's code-splitting rationale.
 */
export function RiderLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-end border-b border-[var(--color-border)] bg-white px-4 py-2">
        <NotificationBell />
      </header>
      <main className="flex-1 bg-[var(--color-bg)] p-4 pb-20">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 flex border-t border-[var(--color-border)] bg-white">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex-1 py-3 text-center text-sm ${
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
  );
}
