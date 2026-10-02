import Link from "next/link";

export default function ApplicationsPlaceholder() {
  return (
    <div className="max-w-3xl mx-auto space-y-6 py-8">
      <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm text-center">
        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        </div>
        <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 mb-3">
          Planned for Phase 2: Application Tracker
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Application State Tracker</h1>
        <p className="text-sm text-slate-600 max-w-lg mx-auto mt-2">
          Track stage-by-stage progress across state, central, and private scholarship applications: Drafted &rarr; Verified &rarr; Submitted &rarr; Awarded.
        </p>

        <div className="mt-8">
          <Link
            href="/"
            className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors inline-block"
          >
            &larr; Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
