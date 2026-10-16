"use client";

import { useState, useEffect } from "react";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import { updateStudent, formatINR } from "@/lib/api";

type SettingsTab = "appearance" | "profile" | "funding" | "notifications" | "account";

export default function SettingsPage() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { student, user, displayEmail, refreshUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>("appearance");

  // Profile Form state
  const [profileForm, setProfileForm] = useState({
    name: "",
    phone: "",
    institution: "",
    course: "",
    year: "1st Year",
    cgpa: 0,
    annual_education_cost: 0,
    existing_support: 0,
    annual_family_income: 0,
  });

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingFunding, setSavingFunding] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [fundingSuccess, setFundingSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (student) {
      const timer = setTimeout(() => {
        setProfileForm({
          name: student.name || "",
          phone: student.phone || "",
          institution: student.profile?.institution || "",
          course: student.profile?.course || "",
          year: student.profile?.year || "1st Year",
          cgpa: student.profile?.cgpa || 0,
          annual_education_cost: student.funding_profile?.annual_education_cost || 0,
          existing_support: student.funding_profile?.existing_support || 0,
          annual_family_income: student.funding_profile?.annual_family_income || 0,
        });
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [student]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileSuccess(null);
    setFormError(null);

    try {
      await updateStudent({
        name: profileForm.name,
        phone: profileForm.phone,
        institution: profileForm.institution,
        course: profileForm.course,
        year: profileForm.year,
        cgpa: profileForm.cgpa,
      });
      await refreshUser();
      setProfileSuccess("Student profile updated successfully.");
      setTimeout(() => setProfileSuccess(null), 4000);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setFormError(err.message);
      } else {
        setFormError("Failed to update student profile.");
      }
    } finally {
      setSavingProfile(false);
    }
  };

  const handleFundingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingFunding(true);
    setFundingSuccess(null);
    setFormError(null);

    try {
      await updateStudent({
        annual_education_cost: profileForm.annual_education_cost,
        existing_support: profileForm.existing_support,
        annual_family_income: profileForm.annual_family_income,
      });
      await refreshUser();
      setFundingSuccess("Funding parameters updated. Gap recalculated.");
      setTimeout(() => setFundingSuccess(null), 4000);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setFormError(err.message);
      } else {
        setFormError("Failed to update funding parameters.");
      }
    } finally {
      setSavingFunding(false);
    }
  };

  const calculatedGap = Math.max(
    0,
    (profileForm.annual_education_cost || 0) - (profileForm.existing_support || 0)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Settings & Preferences
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Customize your visual theme, manage academic identity, and tune financial planning parameters
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-px">
        {[
          { id: "appearance", label: "Appearance", icon: "🎨" },
          { id: "profile", label: "Academic Profile", icon: "🎓" },
          { id: "funding", label: "Funding Preferences", icon: "💰" },
          { id: "notifications", label: "Alerts & Notifications", icon: "🔔" },
          { id: "account", label: "Account & Security", icon: "🔒" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as SettingsTab)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors whitespace-nowrap flex items-center space-x-2 border-b-2 -mb-px ${
              activeTab === tab.id
                ? "border-blue-600 dark:border-sky-400 text-blue-600 dark:text-sky-400 bg-white dark:bg-[#111827]"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {formError && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/80 text-rose-700 dark:text-rose-300 text-xs">
          {formError}
        </div>
      )}

      {/* Tab: Appearance */}
      {activeTab === "appearance" && (
        <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-xs space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Interface Theme</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Select your preferred appearance mode. Your choice is persisted across browser reloads.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Light Theme Card */}
            <div
              onClick={() => setTheme("light")}
              className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                theme === "light"
                  ? "border-blue-600 dark:border-sky-400 bg-blue-50/50 dark:bg-sky-950/20 shadow-xs"
                  : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <span>Light Mode</span>
                </span>
                <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                  theme === "light" ? "border-blue-600 bg-blue-600" : "border-slate-300 dark:border-slate-600"
                }`}>
                  {theme === "light" && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
                </span>
              </div>
              <div className="h-16 rounded-lg bg-white border border-slate-200 p-2 space-y-1.5 shadow-xs">
                <div className="h-2 w-12 bg-slate-200 rounded"></div>
                <div className="h-2 w-full bg-slate-100 rounded"></div>
                <div className="h-2 w-20 bg-blue-600 rounded"></div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2.5">
                Refined scholastic parchment with crisp contrast.
              </p>
            </div>

            {/* Dark Theme Card */}
            <div
              onClick={() => setTheme("dark")}
              className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                theme === "dark"
                  ? "border-blue-600 dark:border-sky-400 bg-blue-50/50 dark:bg-sky-950/20 shadow-xs"
                  : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                  <span>Dark Mode</span>
                </span>
                <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                  theme === "dark" ? "border-sky-400 bg-sky-400" : "border-slate-300 dark:border-slate-600"
                }`}>
                  {theme === "dark" && <span className="w-1.5 h-1.5 rounded-full bg-slate-900"></span>}
                </span>
              </div>
              <div className="h-16 rounded-lg bg-[#090D16] border border-slate-800 p-2 space-y-1.5 shadow-xs">
                <div className="h-2 w-12 bg-slate-700 rounded"></div>
                <div className="h-2 w-full bg-slate-800 rounded"></div>
                <div className="h-2 w-20 bg-sky-400 rounded"></div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2.5">
                Deep obsidian slate engineered for night studying.
              </p>
            </div>

            {/* System Theme Card */}
            <div
              onClick={() => setTheme("system")}
              className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                theme === "system"
                  ? "border-blue-600 dark:border-sky-400 bg-blue-50/50 dark:bg-sky-950/20 shadow-xs"
                  : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span>System Synced</span>
                </span>
                <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                  theme === "system" ? "border-blue-600 dark:border-sky-400 bg-blue-600 dark:bg-sky-400" : "border-slate-300 dark:border-slate-600"
                }`}>
                  {theme === "system" && <span className="w-1.5 h-1.5 rounded-full bg-white dark:bg-slate-900"></span>}
                </span>
              </div>
              <div className="h-16 rounded-lg bg-gradient-to-r from-white to-[#090D16] border border-slate-300 dark:border-slate-700 p-2 space-y-1.5 shadow-xs">
                <div className="h-2 w-12 bg-slate-400 rounded"></div>
                <div className="h-2 w-full bg-slate-400/50 rounded"></div>
                <div className="h-2 w-20 bg-blue-500 rounded"></div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2.5">
                Automatically synchronizes with your device settings (currently {resolvedTheme}).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Academic Profile */}
      {activeTab === "profile" && (
        <form onSubmit={handleProfileSubmit} className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Academic Details</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Used to compute transparent scholarship eligibility and academic criteria
              </p>
            </div>
            {profileSuccess && (
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                {profileSuccess}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={profileForm.phone}
                onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Institution
              </label>
              <input
                type="text"
                value={profileForm.institution}
                onChange={(e) => setProfileForm({ ...profileForm, institution: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Degree / Course
              </label>
              <input
                type="text"
                value={profileForm.course}
                onChange={(e) => setProfileForm({ ...profileForm, course: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Academic Year
              </label>
              <select
                value={profileForm.year}
                onChange={(e) => setProfileForm({ ...profileForm, year: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white"
              >
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
                <option value="4th Year">4th Year</option>
                <option value="Postgraduate">Postgraduate</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Cumulative CGPA (0 - 10)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="10"
                value={profileForm.cgpa}
                onChange={(e) => setProfileForm({ ...profileForm, cgpa: parseFloat(e.target.value) || 0 })}
                className="w-full px-3.5 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <button
              type="submit"
              disabled={savingProfile}
              className="py-2 px-5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
            >
              {savingProfile ? "Saving Profile..." : "Save Academic Profile"}
            </button>
          </div>
        </form>
      )}

      {/* Tab: Funding Preferences */}
      {activeTab === "funding" && (
        <form onSubmit={handleFundingSubmit} className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Funding Planning & Gap Calculation</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Calculates your annual funding shortfall and benchmarks scholarship coverage
              </p>
            </div>
            {fundingSuccess && (
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                {fundingSuccess}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Annual Education Cost (₹)
              </label>
              <input
                type="number"
                min="0"
                value={profileForm.annual_education_cost}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, annual_education_cost: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3.5 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Existing Secured Support (₹)
              </label>
              <input
                type="number"
                min="0"
                value={profileForm.existing_support}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, existing_support: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3.5 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Annual Family Income (₹)
              </label>
              <input
                type="number"
                min="0"
                value={profileForm.annual_family_income}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, annual_family_income: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3.5 py-2 bg-slate-50/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Dynamic Gap Preview */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Recalculated Gap Preview
              </span>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                Funding gap = Total Cost ({formatINR(profileForm.annual_education_cost)}) - Support ({formatINR(profileForm.existing_support)})
              </p>
            </div>
            <span className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">
              {formatINR(calculatedGap)}
            </span>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <button
              type="submit"
              disabled={savingFunding}
              className="py-2 px-5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors cursor-pointer"
            >
              {savingFunding ? "Saving..." : "Save Financial Parameters"}
            </button>
          </div>
        </form>
      )}

      {/* Tab: Notifications */}
      {activeTab === "notifications" && (
        <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Alert Preferences</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              How SCHOLARAi alerts you regarding application deadlines and document readiness
            </p>
          </div>

          <div className="space-y-3">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-900 dark:text-white">In-App Intelligence Alerts</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Real-time alerts for approaching scholarship deadlines (&lt;7 days) and shared document blockers.
                </p>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                ACTIVE
              </span>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4 opacity-75">
              <div>
                <p className="text-xs font-semibold text-slate-900 dark:text-white">Email Notification Dispatch</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Weekly application digest and urgent deadline warnings delivered to your inbox.
                </p>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                SCHEDULED (PHASE 2)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Account & Security */}
      {activeTab === "account" && (
        <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-xs space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Account Details</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Manage your authenticated session and security preferences
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Primary Account Email
              </span>
              <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm mt-1 block">
                {displayEmail || user?.email || "Authenticated User"}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Account Status
              </span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 text-sm mt-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Active & Verified
              </span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-900 dark:text-white">Sign Out</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">End your current session on this device</p>
            </div>
            <button
              onClick={logout}
              className="py-2 px-4 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
