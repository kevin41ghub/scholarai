import { formatINR } from "@/lib/api";

interface FundingProgressBarProps {
  annualCost: number;
  existingSupport: number;
  fundingGap: number;
  percentage: number;
}

export default function FundingProgressBar({
  annualCost,
  existingSupport,
  fundingGap,
  percentage,
}: FundingProgressBarProps) {
  const safePercentage = Math.min(100, Math.max(0, percentage));
  const isHealthy = safePercentage >= 75;
  const isModerate = safePercentage >= 40 && safePercentage < 75;

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
        <div className="sm:text-right flex sm:flex-col items-baseline sm:items-end justify-between gap-2">
          <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-red-600 dark:text-red-400 font-mono">
            {safePercentage.toFixed(1)}%
          </span>
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Funding Secured
          </span>
        </div>
      </div>

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
            {formatINR(existingSupport)}
          </span>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
            Active awards & assistance
          </span>
        </div>

        <div className="flex flex-col">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Uncovered Funding Gap
          </span>
          <span className="text-base font-bold text-amber-600 dark:text-amber-400 mt-0.5 font-mono">
            {formatINR(fundingGap)}
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
            {formatINR(annualCost)}
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
            Tuition, boarding & fees
          </span>
        </div>
      </div>
    </div>
  );
}
