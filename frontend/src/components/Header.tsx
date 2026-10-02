"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const links = [
    { name: "Dashboard", href: "/" },
    { name: "Discover", href: "/discover" },
    { name: "My Goal", href: "/goal" },
    { name: "Applications", href: "/applications" },
    { name: "Documents", href: "/documents" },
    { name: "AI Assistant", href: "/assistant" },
    { name: "Profile", href: "/profile" },
  ];

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
          <span className="capitalize">{pathname === "/" ? "Dashboard" : pathname.replace("/", "")}</span>
        </div>

        {/* Right side items */}
        <div className="flex items-center space-x-4">
          <div className="hidden sm:flex items-center space-x-2 px-3 py-1 bg-slate-100 rounded-full text-xs font-medium text-slate-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Backend Connected</span>
          </div>

          <Link
            href="/profile"
            className="flex items-center space-x-2 text-sm text-slate-700 hover:text-indigo-600 transition-colors py-1 px-2 rounded-md hover:bg-slate-50"
          >
            <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-semibold flex items-center justify-center text-xs">
              AK
            </div>
            <span className="hidden sm:inline font-medium">Arjun Kumar</span>
          </Link>

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
        </div>
      )}
    </header>
  );
}
