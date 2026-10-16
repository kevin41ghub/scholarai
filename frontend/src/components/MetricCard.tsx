import React from "react";

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  badge?: {
    text: string;
    variant: "neutral" | "warning" | "success" | "info" | "danger";
  };
  icon?: React.ReactNode;
}

export default function MetricCard({
  title,
  value,
  subtitle,
  badge,
  icon,
}: MetricCardProps) {
  const badgeClasses = {
    neutral: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700",
    warning: "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    success: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    info: "bg-blue-50 text-blue-800 dark:bg-sky-950/60 dark:text-sky-300 border-blue-200 dark:border-sky-800",
    danger: "bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800",
  };

  return (
    <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {title}
          </span>
          {icon && (
            <div className="w-7 h-7 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400">
              {icon}
            </div>
          )}
        </div>
        <div className="mt-2.5 flex items-baseline justify-between gap-2 flex-wrap">
          <span className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 font-mono">
            {value}
          </span>
          {badge && (
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${badgeClasses[badge.variant]}`}
            >
              {badge.text}
            </span>
          )}
        </div>
      </div>
      {subtitle && (
        <p className="mt-2.5 text-xs text-slate-500 dark:text-slate-400 leading-normal">
          {subtitle}
        </p>
      )}
    </div>
  );
}
