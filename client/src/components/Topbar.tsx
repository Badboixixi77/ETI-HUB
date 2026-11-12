import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, Bell, Moon, Sun, LogOut, User as UserIcon } from "lucide-react";
import { useStore } from "../lib/store";
import { trpc } from "../lib/trpc";
import { disconnectSocket } from "../lib/socket";
import { Avatar } from "./Avatar";
import { toast } from "./Toast";
import { formatRelative } from "../lib/utils";
import { cn } from "../lib/utils";

export default function Topbar() {
  const navigate = useNavigate();
  const { user, darkMode, toggleDarkMode, toggleSidebar } = useStore();
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const utils = trpc.useUtils();
  const { data: notifications } = trpc.notifications.list.useQuery(undefined, {
    refetchInterval: 30000,
  });
  const unreadCount = notifications?.filter((n) => !n.isRead).length ?? 0;

  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => utils.notifications.list.invalidate(),
  });

  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => {
      disconnectSocket();
      useStore.getState().setUser(null);
      navigate("/login");
      toast.info("You have been logged out");
    },
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node))
        setNotifOpen(false);
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      )
        setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header className="flex h-14 items-center justify-between border-b border-ink-200 bg-white px-3 dark:border-ink-800 dark:bg-ink-900 sm:h-16 sm:px-4">
      {/* Mobile hamburger */}
      <button
        onClick={toggleSidebar}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100 lg:hidden dark:hover:bg-ink-800"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex-1" />

      <div className="flex items-center gap-1 sm:gap-2">
        {/* Dark mode */}
        <button
          onClick={toggleDarkMode}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100 dark:text-ink-400 dark:hover:bg-ink-800"
          aria-label={darkMode ? "Light mode" : "Dark mode"}
        >
          {darkMode ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </button>

        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative flex h-10 w-10 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100 dark:text-ink-400 dark:hover:bg-ink-800"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] max-w-xs rounded-xl border border-ink-200 bg-white shadow-lg dark:border-ink-800 dark:bg-ink-900 sm:w-80">
              <div className="flex items-center justify-between border-b border-ink-200 px-4 py-3 dark:border-ink-800">
                <h3 className="text-sm font-semibold">Notifications</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllRead.mutate()}
                    className="text-xs text-brand-600 hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto sm:max-h-96">
                {notifications && notifications.length > 0 ? (
                  notifications.map((n) => (
                    <a
                      key={n.id}
                      href={n.link || "#"}
                      onClick={() => setNotifOpen(false)}
                      className={cn(
                        "flex gap-3 border-b border-ink-100 px-4 py-3 last:border-0 dark:border-ink-800",
                        !n.isRead && "bg-brand-50/50 dark:bg-brand-900/10",
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium">
                          {n.title}
                        </p>
                        {n.body && (
                          <p className="truncate text-xs text-ink-500">
                            {n.body}
                          </p>
                        )}
                        <p className="mt-0.5 text-xs text-ink-400">
                          {formatRelative(n.createdAt)}
                        </p>
                      </div>
                      {!n.isRead && (
                        <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-brand-500" />
                      )}
                    </a>
                  ))
                ) : (
                  <div className="px-4 py-8 text-center text-sm text-ink-400">
                    No notifications
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* User menu */}
        <div ref={userMenuRef} className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800"
            aria-label="User menu"
          >
            <Avatar name={user?.name || "?"} size="sm" />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-ink-200 bg-white shadow-lg dark:border-ink-800 dark:bg-ink-900">
              <div className="border-b border-ink-200 px-4 py-3 dark:border-ink-800">
                <p className="truncate text-sm font-semibold">{user?.name}</p>
                <p className="truncate text-xs text-ink-400">{user?.email}</p>
                <p className="mt-1 text-xs capitalize text-brand-600">
                  {user?.role}
                </p>
              </div>
              <div className="p-1">
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    navigate("/settings");
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800"
                >
                  <UserIcon className="h-4 w-4" /> Settings
                </button>
                <button
                  onClick={() => logout.mutate()}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
