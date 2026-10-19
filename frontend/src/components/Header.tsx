"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { getNotifications, markNotificationRead, markAllNotificationsRead } from "@/lib/api";
import { NotificationItem } from "@/types/student";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifsOpen, setNotifsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const pathname = usePathname();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { displayName, displayEmail, initials, logout } = useAuth();

  const notifsRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  const navLinks = [
    { name: "Dashboard", href: "/" },
    { name: "Discover", href: "/discover" },
    { name: "Applications", href: "/applications" },
    { name: "Documents", href: "/documents" },
    { name: "Evidence Bank", href: "/evidence" },
    { name: "Goal Planner", href: "/goal" },
    { name: "AI Assistant", href: "/assistant" },
    { name: "Settings", href: "/settings" },
    { name: "Student Profile", href: "/profile" },
  ];

  const fetchNotifs = useCallback(async () => {
    try {
      const data = await getNotifications();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch {
      // Ignored if unauthenticated
    }
  }, []);

  useEffect(() => {
    // Avoid synchronous setState during render by scheduling in microtask/async
    const timer = setTimeout(() => {
      fetchNotifs();
    }, 0);
    const interval = setInterval(fetchNotifs, 20000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [fetchNotifs]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (notifsRef.current && !notifsRef.current.contains(target)) {
        setNotifsOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setUserMenuOpen(false);
      }
      if (themeMenuRef.current && !themeMenuRef.current.contains(target)) {
        setThemeMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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

  const getPageTitle = () => {
    if (pathname === "/") return "Executive Overview";
    if (pathname.startsWith("/discover/")) return "Scholarship Dossier";
    if (pathname === "/discover") return "Scholarship Discovery";
    if (pathname === "/applications") return "Application Tracker";
    if (pathname === "/documents") return "Document Readiness Vault";
    if (pathname === "/evidence") return "Evidence Bank";
    if (pathname === "/goal") return "Funding Goal Planner";
    if (pathname === "/assistant") return "AI Scholarship Assistant";
    if (pathname === "/settings") return "Settings & Preferences";
    if (pathname === "/profile") return "Student Profile";
    return pathname.replace("/", "").replace(/-/g, " ");
  };

  return (
    <header className="bg-white/80 dark:bg-[#111827]/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 sticky top-0 z-30 transition-colors">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
        {/* Left: Mobile Brand & Desktop Breadcrumbs */}
        <div className="flex items-center space-x-3">
          <Link href="/" className="md:hidden flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center font-bold text-white shadow-xs">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
              </svg>
            </div>
            <span className="font-bold text-base text-slate-900 dark:text-white">
              SCHOLAR<span className="text-blue-600 dark:text-sky-400">Ai</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center space-x-2 text-xs text-stone-500 dark:text-stone-400">
            <span className="font-serif font-bold text-stone-900 dark:text-stone-100">SCHOLARAi</span>
            <span className="text-stone-300 dark:text-stone-700">/</span>
            <span className="capitalize font-medium text-stone-700 dark:text-stone-300">
              {getPageTitle()}
            </span>
          </div>
        </div>

        {/* Right side items */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Intelligence Connected status pill */}
          <div className="hidden lg:flex items-center space-x-2 px-2.5 py-1 bg-stone-100 dark:bg-stone-800/80 rounded-full text-[11px] font-medium text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-serif italic">Tamil Nadu Autonomous Colleges Edition</span>
          </div>

          {/* Theme Selector Popover */}
          <div className="relative" ref={themeMenuRef}>
            <button
              onClick={() => {
                setThemeMenuOpen(!themeMenuOpen);
                setNotifsOpen(false);
                setUserMenuOpen(false);
              }}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={`Theme: ${theme} (${resolvedTheme})`}
              aria-label="Toggle theme menu"
            >
              {resolvedTheme === "dark" ? (
                <svg className="w-4 h-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              )}
            </button>

            {themeMenuOpen && (
              <div className="absolute right-0 mt-2 w-36 bg-white dark:bg-[#162032] border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 py-1 text-xs">
                <button
                  onClick={() => {
                    setTheme("light");
                    setThemeMenuOpen(false);
                  }}
                  className={`w-full flex items-center space-x-2 px-3 py-2 text-left font-medium transition-colors ${
                    theme === "light"
                      ? "text-blue-600 dark:text-sky-400 bg-blue-50 dark:bg-sky-950/40"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <span>Light</span>
                </button>
                <button
                  onClick={() => {
                    setTheme("dark");
                    setThemeMenuOpen(false);
                  }}
                  className={`w-full flex items-center space-x-2 px-3 py-2 text-left font-medium transition-colors ${
                    theme === "dark"
                      ? "text-blue-600 dark:text-sky-400 bg-blue-50 dark:bg-sky-950/40"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  <svg className="w-4 h-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                  <span>Dark</span>
                </button>
                <button
                  onClick={() => {
                    setTheme("system");
                    setThemeMenuOpen(false);
                  }}
                  className={`w-full flex items-center space-x-2 px-3 py-2 text-left font-medium transition-colors ${
                    theme === "system"
                      ? "text-blue-600 dark:text-sky-400 bg-blue-50 dark:bg-sky-950/40"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span>System</span>
                </button>
              </div>
            )}
          </div>

          {/* Notifications Dropdown */}
          <div className="relative" ref={notifsRef}>
            <button
              onClick={() => {
                setNotifsOpen(!notifsOpen);
                setUserMenuOpen(false);
                setThemeMenuOpen(false);
              }}
              className="relative p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Notifications"
              aria-label="View notifications"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white dark:ring-[#111827]">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {notifsOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-[#162032] border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 text-xs overflow-hidden">
                <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-900 dark:text-white">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.2 bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 rounded font-semibold text-[10px]">
                        {unreadCount} unread
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[11px] text-blue-600 dark:text-sky-400 hover:underline font-medium"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-slate-400">
                      <p className="text-xs">No notifications right now.</p>
                      <p className="text-[11px] text-slate-400 mt-1">Approaching deadlines and document blockers will show here.</p>
                    </div>
                  ) : (
                    notifications.map((n) => {
                      const isUrgent = n.severity === "URGENT";
                      const isHigh = n.severity === "HIGH";
                      return (
                        <div
                          key={n.id}
                          onClick={() => !n.read && handleMarkRead(n.id)}
                          className={`p-3 transition-colors cursor-pointer ${
                            n.read
                              ? "bg-white dark:bg-[#162032] hover:bg-slate-50 dark:hover:bg-slate-800/40 opacity-75"
                              : "bg-blue-50/40 dark:bg-slate-800/50 hover:bg-blue-50/80 dark:hover:bg-slate-800/80"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span
                              className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                isUrgent
                                  ? "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                                  : isHigh
                                  ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                              }`}
                            >
                              {n.type}
                            </span>
                            {!n.read && (
                              <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-sky-400 flex-shrink-0 mt-1"></span>
                            )}
                          </div>
                          <p className="font-semibold text-slate-900 dark:text-white mt-1 text-xs">{n.title}</p>
                          <p className="text-slate-600 dark:text-slate-300 text-[11px] mt-0.5 leading-relaxed">{n.message}</p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Account Menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => {
                setUserMenuOpen(!userMenuOpen);
                setNotifsOpen(false);
                setThemeMenuOpen(false);
              }}
              className="flex items-center space-x-2 text-sm text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-sky-400 py-1 px-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="User profile menu"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-700 to-indigo-600 text-white font-semibold flex items-center justify-center text-xs shadow-xs ring-1 ring-white/20">
                {initials}
              </div>
              <span className="hidden sm:inline font-medium text-xs max-w-[120px] truncate text-slate-900 dark:text-slate-100">
                {displayName}
              </span>
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#162032] border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 py-1 text-xs">
                <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800/80">
                  <p className="font-bold text-slate-900 dark:text-white truncate">{displayName}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {displayEmail || "Authenticated User"}
                  </p>
                </div>
                <Link
                  href="/profile"
                  onClick={() => setUserMenuOpen(false)}
                  className="block px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Student Profile
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setUserMenuOpen(false)}
                  className="block px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Settings & Preferences
                </Link>
                <Link
                  href="/evidence"
                  onClick={() => setUserMenuOpen(false)}
                  className="block px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Evidence Bank
                </Link>
                <div className="border-t border-slate-100 dark:border-slate-800/80 my-1"></div>
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    logout();
                  }}
                  className="w-full text-left px-4 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-medium"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>

          {/* Mobile hamburger menu toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Toggle navigation drawer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] px-4 py-3 space-y-1 shadow-2xl">
          <div className="pb-2 mb-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{displayName}</span>
            <span className="text-[10px] text-slate-400">{displayEmail}</span>
          </div>
          {navLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                pathname === link.href
                  ? "bg-blue-600 text-white"
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {link.name}
            </Link>
          ))}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                logout();
              }}
              className="block w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
