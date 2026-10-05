import { useState } from "react";
import { useNotifications, useMarkNotificationRead } from "../hooks/useNotifications";

/** Notification bell + dropdown, shared between Owner and Rider shells. */
export function NotificationBell() {
  const { data: notifications } = useNotifications();
  const markRead = useMarkNotificationRead();
  const [open, setOpen] = useState(false);

  const unreadCount = (notifications ?? []).filter((n) => !n.is_read).length;

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="relative text-[var(--color-text-secondary)]" aria-label="Notifications">
        🔔
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-danger)] text-[10px] font-medium text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-2 w-72 rounded-[var(--radius-card)] bg-surface p-2 shadow-[var(--shadow-md)]">
          {(notifications ?? []).length === 0 && (
            <p className="p-2 text-xs text-[var(--color-text-muted)]">No notifications yet.</p>
          )}
          {(notifications ?? []).map((n) => (
            <button
              key={n.id}
              onClick={() => !n.is_read && markRead.mutate(n.id)}
              className={`block w-full rounded-[var(--radius-control)] p-2 text-left text-xs ${
                n.is_read ? "text-[var(--color-text-muted)]" : "bg-[#E6F1FB] text-[var(--color-text-primary)]"
              }`}
            >
              <div className="font-medium">{n.title}</div>
              <div>{n.message}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
