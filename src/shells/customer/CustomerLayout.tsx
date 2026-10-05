import { Outlet } from "react-router-dom";
import { supabase } from "../../shared/lib/supabase";
import { NotificationBell } from "../../features/notifications/components/NotificationBell";

/** Minimal shell -- a customer's only real task is viewing their own delivery history across SMEs. */
export function CustomerLayout() {
  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="flex items-center justify-between border-b border-[var(--color-border)] bg-white px-4 py-3">
        <span className="text-sm font-medium text-primary">DeliverSME</span>
        <div className="flex items-center gap-3">
          <NotificationBell />
          <button onClick={handleSignOut} className="text-sm text-[var(--color-text-secondary)]">
            Sign out
          </button>
        </div>
      </header>
      <main className="p-4">
        <Outlet />
      </main>
    </div>
  );
}
