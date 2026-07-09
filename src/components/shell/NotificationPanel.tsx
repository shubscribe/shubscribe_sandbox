"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  clearNotifications,
} from "@/actions/notifications";

interface Notification {
  id: string;
  title: string;
  message: string;
  linkUrl: string | null;
  read: boolean;
  createdAt: Date | null;
}

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
}

function formatRelativeTime(date: Date | null): string {
  if (!date) return "";
  const now = Date.now();
  const then = date.getTime();
  const diffSeconds = Math.floor((now - then) / 1000);

  if (diffSeconds < 60) return "just now";

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return `${diffWeeks}w ago`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;

  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears}y ago`;
}

export default function NotificationPanel({
  open,
  onClose,
}: NotificationPanelProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNotifications();
      setNotifications(data);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open, fetchNotifications]);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
      );
    }
    if (notification.linkUrl) {
      onClose();
      router.push(notification.linkUrl);
    }
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleClearAll = async () => {
    await clearNotifications();
    setNotifications([]);
  };

  if (!open) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop overlay */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        className="drawer-in glass-raised relative z-10 flex h-full w-full max-w-md flex-col border-l border-white/10 shadow-2xl"
        role="dialog"
        aria-label="Notifications"
      >
        {/* Header */}
        <header className="flex items-center justify-between shrink-0 border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="text-ink-faint hover:text-ink -ml-2 rounded-lg p-1.5 transition-colors"
              aria-label="Back"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6"/>
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <h2 className="text-ink text-lg font-semibold">Notifications</h2>
              {unreadCount > 0 && (
                <span className="bg-accent-soft text-accent rounded-full px-2 py-0.5 text-xs font-medium">
                  {unreadCount}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0}
            className="text-accent hover:text-accent/80 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          >
            Mark all read
          </button>
        </header>

        {/* Notification list */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {loading && notifications.length === 0 ? (
            <div className="text-ink-faint flex items-center justify-center py-16 text-sm">
              Loading…
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-ink-faint flex flex-col items-center justify-center gap-2 py-16">
              <svg
                className="h-10 w-10 opacity-30"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
                />
              </svg>
              <span className="text-sm">No notifications</span>
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <button
                    onClick={() => handleNotificationClick(notification)}
                    className={`flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors ${
                      notification.linkUrl
                        ? "hover:bg-white/5 cursor-pointer"
                        : "cursor-default"
                    } ${!notification.read ? "bg-accent-soft/30" : ""}`}
                  >
                    {/* Unread dot indicator */}
                    <div className="flex shrink-0 pt-1.5">
                      <span
                        className={`block h-2 w-2 rounded-full transition-opacity ${
                          notification.read
                            ? "opacity-0"
                            : "bg-accent opacity-100"
                        }`}
                      />
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span
                          className={`text-ink truncate text-sm ${
                            notification.read ? "font-normal" : "font-semibold"
                          }`}
                        >
                          {notification.title}
                        </span>
                        <span className="text-ink-faint shrink-0 text-xs">
                          {formatRelativeTime(notification.createdAt)}
                        </span>
                      </div>
                      <p className="text-ink-dim mt-0.5 line-clamp-2 text-sm leading-relaxed">
                        {notification.message}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <footer className="shrink-0 border-t border-white/10 p-4">
            <button
              onClick={handleClearAll}
              className="text-ink hover:text-ink-dim bg-white/5 hover:bg-white/10 w-full rounded-xl py-3 text-sm font-medium transition-colors"
            >
              Clear all notifications
            </button>
          </footer>
        )}
      </aside>
    </div>
  );
}
