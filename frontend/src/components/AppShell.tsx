"use client";

import React from "react";
import { usePathname } from "next/navigation";
import Navigation from "@/components/Navigation";
import Header from "@/components/Header";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login" || pathname === "/register";

  if (isAuthPage) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#090D16] text-slate-900 dark:text-slate-100 flex flex-col justify-between transition-colors">
        <main className="flex-1 flex items-center justify-center p-4">
          {children}
        </main>
        <footer className="py-4 px-6 text-center text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200/80 dark:border-slate-800/80">
          SCHOLARAi &bull; Autonomous Student Funding & Scholarship Intelligence
        </footer>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-[#090D16] text-slate-900 dark:text-slate-100 transition-colors">
      <Navigation />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
        <footer className="border-t border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-[#111827]/70 backdrop-blur-md py-4 px-6 text-center text-xs text-slate-500 dark:text-slate-400">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-slate-800 dark:text-slate-200">SCHOLAR<span className="text-blue-600 dark:text-sky-400">Ai</span></span>
              <span>&bull;</span>
              <span>Student Funding Intelligence Platform</span>
            </div>
            <p className="text-slate-400 dark:text-slate-500 text-[11px]">
              Trust principle: &ldquo;AI assists. Official sources decide. Student approves.&rdquo;
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
