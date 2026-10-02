"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCurrentStudent, formatINR } from "@/lib/api";
import { StudentDetail } from "@/types/student";
import MetricCard from "@/components/MetricCard";
import FundingProgressBar from "@/components/FundingProgressBar";

export default function Dashboard() {
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCurrentStudent();
      setStudent(data);
    } catch (err: any) {
      setError(err?.message || "Failed to connect to SCHOLARAi backend.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-slate-500 font-medium">Connecting to SCHOLARAi backend...</p>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="max-w-2xl mx-auto my-12 bg-white rounded-xl border border-red-200 p-8 shadow-sm text-center">
        <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-slate-900">Backend Communication Notice</h2>
        <p className="text-sm text-slate-600 mt-2">{error || "Could not retrieve student profile."}</p>
        <p className="text-xs text-slate-400 mt-1">Please ensure the backend FastAPI service is running on port 8000.</p>
        <button
          onClick={loadData}
          className="mt-6 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const { profile, funding_profile } = student;
  const annualCost = funding_profile?.annual_education_cost || 0;
  const existingSupport = funding_profile?.existing_support || 0;
  const fundingGap = funding_profile?.funding_gap || 0;
  const progressPct = funding_profile?.funding_progress_percentage || 0;
  const familyIncome = funding_profile?.annual_family_income || 0;

  return (
    <div className="space-y-8">
      {/* Top Banner / Welcome & Trust Principle */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold">
              <span>Phase 1 Foundation</span>
              <span>&bull;</span>
              <span>Active</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
              Welcome back, {student.name}
            </h1>
            <p className="text-sm text-slate-600 max-w-2xl">
              SCHOLARAi helps you coordinate funding needs, scholarship search rules, application deadlines, and evidence verification.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/profile"
              className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm"
            >
              Edit Profile
            </Link>
          </div>
        </div>

        {/* Core Trust Statement Box */}
        <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start space-x-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div className="text-xs space-y-1">
            <p className="font-semibold text-slate-900 uppercase tracking-wide">
              Trust Principle: &ldquo;AI assists. Official sources decide. Student approves.&rdquo;
            </p>
            <p className="text-slate-600">
              SCHOLARAi provides decision support and application coordination. We do not claim guaranteed eligibility or guaranteed scholarship awards. Final eligibility criteria and awards are established solely by official awarding bodies.
            </p>
          </div>
        </div>
      </div>

      {/* Student Summary Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
          <h2 className="text-base font-semibold text-slate-900">Student Summary</h2>
          <Link href="/profile" className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
            Update Academic Info &rarr;
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-xs text-slate-500 block">Student Name</span>
            <span className="font-medium text-slate-900">{student.name}</span>
          </div>
          <div>
            <span className="text-xs text-slate-500 block">Course</span>
            <span className="font-medium text-slate-900">{profile?.course}</span>
          </div>
          <div>
            <span className="text-xs text-slate-500 block">Academic Year</span>
            <span className="font-medium text-slate-900">{profile?.year}</span>
          </div>
          <div>
            <span className="text-xs text-slate-500 block">Institution</span>
            <span className="font-medium text-slate-900">{profile?.institution}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs mt-4 pt-4 border-t border-slate-100 text-slate-600">
          <div>
            <span className="text-slate-400 block">CGPA</span>
            <span className="font-semibold text-slate-800">{profile?.cgpa} / 10.0</span>
          </div>
          <div>
            <span className="text-slate-400 block">12th Percentage</span>
            <span className="font-semibold text-slate-800">{profile?.twelfth_percentage}%</span>
          </div>
          <div>
            <span className="text-slate-400 block">Category</span>
            <span className="font-semibold text-slate-800">{profile?.category}</span>
          </div>
          <div>
            <span className="text-slate-400 block">Domicile State</span>
            <span className="font-semibold text-slate-800">{profile?.state}</span>
          </div>
        </div>
      </div>

      {/* Funding Need Overview */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Funding Need Overview</h2>
            <p className="text-xs text-slate-500">Live breakdown of educational expenses, confirmed aid, and remaining funding gap</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Annual Education Cost"
            value={formatINR(annualCost)}
            subtitle="Tuition, academic fees & living expenses"
            badge={{ text: "Annual Target", variant: "neutral" }}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <MetricCard
            title="Existing Support"
            value={formatINR(existingSupport)}
            subtitle="Confirmed institutional aid & scholarships"
            badge={{ text: "Secured", variant: "success" }}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <MetricCard
            title="Remaining Funding Gap"
            value={formatINR(fundingGap)}
            subtitle="Calculated: max(0, Cost - Support)"
            badge={{ text: fundingGap > 0 ? "Action Required" : "Fully Funded", variant: fundingGap > 0 ? "warning" : "success" }}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <MetricCard
            title="Annual Family Income"
            value={formatINR(familyIncome)}
            subtitle="Used for means-tested scholarship criteria"
            badge={{ text: "Verified", variant: "info" }}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            }
          />
        </div>
      </div>

      {/* Visual Funding Progress Bar */}
      <FundingProgressBar
        annualCost={annualCost}
        existingSupport={existingSupport}
        fundingGap={fundingGap}
        percentage={progressPct}
      />

      {/* Quick Navigation / Next Steps for Student */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Profile & Domicile Details</h3>
            <p className="text-xs text-slate-500 mt-1">
              Keep academic grades, institution, and financial figures up to date for precise matching.
            </p>
          </div>
          <Link
            href="/profile"
            className="mt-4 text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1"
          >
            <span>Edit Profile Data</span>
            <span>&rarr;</span>
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Scholarship Discover</h3>
            <p className="text-xs text-slate-500 mt-1">
              Search verified schemes from central, state, and premier institutional sources.
            </p>
          </div>
          <Link
            href="/discover"
            className="mt-4 text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1"
          >
            <span>View Discover (Phase 2 Preview)</span>
            <span>&rarr;</span>
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Application Coordination</h3>
            <p className="text-xs text-slate-500 mt-1">
              Track deadlines, documents, and next steps for your funding applications.
            </p>
          </div>
          <Link
            href="/applications"
            className="mt-4 text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1"
          >
            <span>Track Applications</span>
            <span>&rarr;</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
