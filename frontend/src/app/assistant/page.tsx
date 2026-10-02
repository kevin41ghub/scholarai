import Link from "next/link";

export default function AssistantPlaceholder() {
  return (
    <div className="max-w-3xl mx-auto space-y-6 py-8">
      <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm text-center">
        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 mb-3">
          Planned for Phase 3: AI Assistant & Decision Support
        </div>
        <h1 className="text-2xl font-bold text-slate-900">SCHOLARAi Assistant</h1>
        <p className="text-sm text-slate-600 max-w-lg mx-auto mt-2">
          AI assistant for eligibility interpretation, next-action guidance, and essay structuring.
        </p>

        <div className="mt-8 p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-500 max-w-md mx-auto text-left space-y-1.5">
          <p className="font-semibold text-slate-700 uppercase tracking-wider text-[11px]">Trust Principle</p>
          <p className="italic">&ldquo;AI assists. Official sources decide. Student approves.&rdquo;</p>
          <p className="text-slate-400">AI provides advisory assistance only. All submission decisions require explicit student review and approval.</p>
        </div>

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
