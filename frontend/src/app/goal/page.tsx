import Link from "next/link";

export default function MyGoalPlaceholder() {
  return (
    <div className="max-w-3xl mx-auto space-y-6 py-8">
      <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm text-center">
        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 mb-3">
          Planned for Phase 2: Goal Strategy
        </div>
        <h1 className="text-2xl font-bold text-slate-900">My Goal & Strategy</h1>
        <p className="text-sm text-slate-600 max-w-lg mx-auto mt-2">
          Scholarship pursuit is a coordination and decision problem. In future phases, you can construct target portfolios, balance risk, and coordinate multi-scheme deadlines.
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
