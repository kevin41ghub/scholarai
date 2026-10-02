import React from "react";

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  badge?: {
    text: string;
    variant: "neutral" | "warning" | "success" | "info";
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
    neutral: "bg-slate-100 text-slate-700 border-slate-200",
    warning: "bg-amber-50 text-amber-800 border-amber-200",
    success: "bg-emerald-50 text-emerald-800 border-emerald-200",
    info: "bg-indigo-50 text-indigo-800 border-indigo-200",
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</span>
        {icon && <span className="text-slate-400">{icon}</span>}
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span className="text-2xl font-bold tracking-tight text-slate-900">{value}</span>
        {badge && (
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium border ${badgeClasses[badge.variant]}`}
          >
            {badge.text}
          </span>
        )}
      </div>
      {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
    </div>
  );
}
