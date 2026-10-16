"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

interface NavItem {
  name: string;
  href: string;
  icon: (active: boolean) => React.ReactNode;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    name: "Dashboard",
    href: "/",
    icon: (active) => (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    name: "Discover",
    href: "/discover",
    icon: (active) => (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    name: "Applications",
    href: "/applications",
    icon: (active) => (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    name: "Documents",
    href: "/documents",
    icon: (active) => (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    name: "Evidence Bank",
    href: "/evidence",
    icon: (active) => (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    name: "Goal Planner",
    href: "/goal",
    icon: (active) => (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
      </svg>
    ),
  },
  {
    name: "AI Assistant",
    href: "/assistant",
    icon: (active) => (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    badge: "AI",
  },
  {
    name: "Settings",
    href: "/settings",
    icon: (active) => (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export default function Navigation() {
  const pathname = usePathname();
  const { displayName, displayEmail, initials } = useAuth();

  return (
    <aside className="w-64 bg-slate-900 dark:bg-[#0D131F] text-slate-100 flex-shrink-0 flex flex-col justify-between border-r border-slate-800 dark:border-slate-800/80 hidden md:flex transition-colors">
      <div>
        {/* Brand Header */}
        <div className="h-16 flex items-center px-5 border-b border-slate-800 dark:border-slate-800/80">
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center font-bold text-white shadow-md shadow-blue-900/30 ring-1 ring-white/20 group-hover:from-blue-500 group-hover:to-indigo-600 transition-all">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
              </svg>
            </div>
            <div>
              <span className="font-bold tracking-tight text-base text-white">
                SCHOLAR<span className="text-sky-400">Ai</span>
              </span>
              <span className="block text-[10px] text-slate-400 tracking-wider uppercase font-medium">
                Funding Intelligence
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation Section */}
        <nav className="p-3 space-y-1">
          <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Workspace
          </div>
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                    : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className={isActive ? "text-white" : "text-slate-400 group-hover:text-slate-200"}>
                    {item.icon(isActive)}
                  </span>
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      isActive
                        ? "bg-blue-700 text-white"
                        : "bg-slate-800 text-sky-400 border border-sky-400/20"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User Profile Card */}
      <div className="p-3 border-t border-slate-800 dark:border-slate-800/80 space-y-2">
        <Link
          href="/profile"
          className={`flex items-center space-x-3 p-2 rounded-lg transition-colors ${
            pathname === "/profile"
              ? "bg-slate-800 text-white"
              : "hover:bg-slate-800/60 text-slate-300"
          }`}
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-700 to-indigo-600 text-white font-semibold flex items-center justify-center text-xs shadow-xs ring-1 ring-white/20">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate text-white">{displayName}</p>
            <p className="text-[11px] text-slate-400 truncate">{displayEmail || "Student Profile"}</p>
          </div>
        </Link>

        {/* Trust badge */}
        <div className="px-2.5 py-1.5 bg-slate-800/60 dark:bg-slate-900/60 rounded-md text-[10px] text-slate-400 flex items-center justify-between border border-slate-700/50">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>Grounded Engine</span>
          </span>
          <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400">v1.2</span>
        </div>
      </div>
    </aside>
  );
}
