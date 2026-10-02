"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getNotifications, markNotificationRead, markAllNotificationsRead, logoutUser } from "@/lib/api";
import { NotificationItem } from "@/types/student";

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifsOpen, setNotifsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const pathname = usePathname();
  const router = useRouter();

  const links = [
    { name: "Dashboard", href: "/" },
    { name: "Discover", href: "/discover" },
    { name: "My Goal", href: "/goal" },
    { name: "Applications", href: "/applications" },
    { name: "Documents", href: "/documents" },
    { name: "Evidence", href: "/evidence" },
    { name: "AI Assistant", href: "/assistant" },
    { name: "Profile", href: "/profile" },
  ];

  const fetchNotifs = async () => {
    try {
      const data = await getNotifications();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch {
      // Graceful fallback if unauthenticated
    }
  };

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkRead = async (id: number) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      router.push("/login");
    } catch {
      router.push("/login");
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="flex items-center justify-between h-16 px-4 md:px-8">
        <div className="flex items-center space-x-3 md:hidden">
          <Link href="/" className="font-bold text-lg text-slate-900 flex items-center space-x-2">
            <span className="w-8 h-8 rounded bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">S</span>
            <span>SCHOLARAi</span>
          </Link>
        </div>

        {/* Desktop title / context */}
        <div className="hidden md:flex items-center space-x-3 text-sm text-slate-600">
          <span className="font-medium text-slate-900">Student Portal</span>
          <span className="text-slate-300">/</span>
          <span className="capitalize">{pathname === "/" ? "Dashboard" : pathname.replace("/", "").replace("-", " ")}</span>
        </div>

        {/* Right side items */}
        <div className="flex items-center space-x-4">
          <div className="hidden sm:flex items-center space-x-2 px-3 py-1 bg-slate-100 rounded-full text-xs font-medium text-slate-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Intelligence Connected</span>
          </div>

          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setNotifsOpen(!notifsOpen);
                setUserMenuOpen(false);
              }}
              className="p-2 rounded-full text-slate-600 hover:text-indigo-600 hover:bg-slate-100 transition-colors relative"
              aria-label="Notifications"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-rose-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center animate-pulse">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {notifsOpen && (
              <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-sm text-slate-900">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-100 text-rose-700">
                        {unreadCount} unread
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                      No notifications yet.
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-3 text-xs transition-colors ${
                          n.read ? "bg-white opacity-70" : "bg-indigo-50/40"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              n.severity === "URGENT"
                                ? "bg-rose-100 text-rose-800"
                                : n.severity === "HIGH"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-indigo-100 text-indigo-800"
                            }`}
                          >
                            {n.type}
                          </span>
                          {!n.read && (
                            <button
                              onClick={() => handleMarkRead(n.id)}
                              className="text-[11px] text-indigo-600 hover:underline"
                            >
                              Mark read
                            </button>
                          )}
                        </div>
                        <p className="font-semibold text-slate-900 mt-1">{n.title}</p>
                        <p className="text-slate-600 mt-0.5 leading-relaxed">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Account Menu */}
          <div className="relative">
            <button
              onClick={() => {
                setUserMenuOpen(!userMenuOpen);
                setNotifsOpen(false);
              }}
              className="flex items-center space-x-2 text-sm text-slate-700 hover:text-indigo-600 transition-colors py-1 px-2 rounded-md hover:bg-slate-50"
            >
              <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-semibold flex items-center justify-center text-xs">
                AK
              </div>
              <span className="hidden sm:inline font-medium">Arjun Kumar</span>
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1 text-sm">
                <div className="px-4 py-2 border-b border-slate-100">
                  <p className="font-semibold text-slate-900">Arjun Kumar</p>
                  <p className="text-xs text-slate-500">demo@scholarai.local</p>
                </div>
                <Link
                  href="/profile"
                  onClick={() => setUserMenuOpen(false)}
                  className="block px-4 py-2 text-slate-700 hover:bg-slate-50"
                >
                  Student Profile
                </Link>
                <Link
                  href="/evidence"
                  onClick={() => setUserMenuOpen(false)}
                  className="block px-4 py-2 text-slate-700 hover:bg-slate-50"
                >
                  Evidence Bank
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-rose-600 hover:bg-rose-50 border-t border-slate-100 font-medium"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>

          {/* Mobile hamburger button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-md text-slate-600 hover:bg-slate-100"
            aria-label="Toggle navigation menu"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile navigation drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1 shadow-lg">
          {links.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-3 py-2 rounded-md text-sm font-medium ${
                pathname === link.href
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              {link.name}
            </Link>
          ))}
          <button
            onClick={handleLogout}
            className="block w-full text-left px-3 py-2 rounded-md text-sm font-medium text-rose-600 hover:bg-rose-50"
          >
            Sign Out
          </button>
        </div>
      )}
    </header>
  );
}
