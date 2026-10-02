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

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Funding Progress</h3>
          <p className="text-xs text-slate-500">
            Portion of total annual education expenses covered by secured funds
          </p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-indigo-600">{safePercentage.toFixed(1)}%</span>
          <span className="text-xs text-slate-500 block">Covered</span>
        </div>
      </div>

      {/* Progress Track */}
      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
        <div
          className="bg-indigo-600 h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${safePercentage}%` }}
        />
      </div>

      {/* Legend / Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-5 pt-4 border-t border-slate-100 text-xs">
        <div>
          <span className="text-slate-500 block">Existing Support</span>
          <span className="text-sm font-semibold text-slate-800">{formatINR(existingSupport)}</span>
        </div>
        <div>
          <span className="text-slate-500 block">Calculated Gap</span>
          <span className="text-sm font-semibold text-amber-700">{formatINR(fundingGap)}</span>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <span className="text-slate-500 block">Total Annual Cost</span>
          <span className="text-sm font-semibold text-slate-900">{formatINR(annualCost)}</span>
        </div>
      </div>
    </div>
  );
}
