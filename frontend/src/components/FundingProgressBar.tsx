import Link from "next/link";
import { formatINR } from "@/lib/api";

interface FundingProgressBarProps {
  annualCost?: number | null;
  existingSupport?: number | null;
  fundingGap?: number | null;
  percentage?: number | null;
}

export default function FundingProgressBar({
  annualCost,
  existingSupport = 0,
  fundingGap,
  percentage,
}: FundingProgressBarProps) {
  const hasCost = annualCost != null && annualCost > 0;
  const safePercentage = hasCost ? Math.min(100, Math.max(0, percentage ?? 0)) : 0;
  const isHealthy = safePercentage >= 75;
  const isModerate = safePercentage >= 40 && safePercentage < 75;
  const safeExisting = existingSupport ?? 0;
  const safeGap = hasCost ? (fundingGap ?? Math.max(0, annualCost - safeExisting)) : 0;

  return (
    <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-xs transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-red-600 dark:bg-red-500"></span>
            <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white uppercase">
              Funding Coverage Analysis
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Portion of total annual educational expenses secured vs. remaining funding gap
          </p>
        </div>
        {hasCost ? (
          <div className="sm:text-right flex sm:flex-col items-baseline sm:items-end justify-between gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-red-600 dark:text-red-400 font-mono">
              {safePercentage.toFixed(1)}%
            </span>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Funding Secured
            </span>
          </div>
        ) : (
          <div className="sm:text-right flex sm:flex-col items-baseline sm:items-end justify-between gap-2">
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
              Not Configured
            </span>
          </div>
        )}
      </div>

      {hasCost ? (
        <>
          {/* Progress Track */}
          <div className="w-full h-3.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 flex">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out shadow-xs ${
                isHealthy
                  ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                  : isModerate
                  ? "bg-gradient-to-r from-red-600 to-rose-600"
                  : "bg-gradient-to-r from-amber-500 to-orange-500"
              }`}
              style={{ width: `${safePercentage}%` }}
            />
          </div>

          {/* Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80">
            <div className="flex flex-col">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Secured Support
              </span>
              <span className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5 font-mono">
                {formatINR(safeExisting)}
              </span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
                Active awards &amp; assistance
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Uncovered Funding Gap
              </span>
              <span className="text-base font-bold text-amber-600 dark:text-amber-400 mt-0.5 font-mono">
                {formatINR(safeGap)}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                Target to cover via scholarships
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Total Annual Obligation
              </span>
              <span className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5 font-mono">
                {formatINR(annualCost!)}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                Tuition, boarding &amp; fees
              </span>
            </div>
          </div>
        </>
      ) : (
        <div className="mt-2 p-4 rounded-xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
            Annual educational expenses have not been configured yet. Set your estimated college tuition and living costs in settings to calculate your funding shortfall.
          </p>
          <Link
            href="/settings?tab=funding"
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold whitespace-nowrap self-start sm:self-auto transition-colors"
          >
            Configure Expenses &rarr;
          </Link>
        </div>
      )}
    </div>
  );
}
