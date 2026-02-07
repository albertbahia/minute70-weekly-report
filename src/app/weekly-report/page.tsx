"use client";

import { useState, useEffect, FormEvent } from "react";

interface ReportResponse {
  ok: boolean;
  source: "public" | "teammate";
  followupScheduled: boolean;
  statusLine: string;
  planBullets: string[];
  matchDayCue: string;
  reason?: string;
  daysRemaining?: number;
  error?: string;
}

const MATCH_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const WEEKLY_LOAD_OPTIONS = ["0", "1", "2", "3", "4", "5", "6", "7"];
const LEGS_OPTIONS = ["Fresh", "Medium", "Heavy", "Tweaky"] as const;
const TISSUE_FOCUS_OPTIONS = ["Quads", "Hamstrings", "Calves", "Glutes", "Hip Flexors", "Ankles"] as const;
const RECOVERY_MODE_OPTIONS = ["Walk", "Pool", "Yoga", "Foam Roll", "Contrast Shower", "Full Rest"] as const;

const LS_KEY = "minute70_recovery_mode";

function getStoredRecoveryMode(): string {
  if (typeof window === "undefined") return "Walk";
  try {
    return localStorage.getItem(LS_KEY) || "Walk";
  } catch {
    return "Walk";
  }
}

export default function WeeklyReportPage() {
  // Step state
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);

  // Step 2
  const [matchDay, setMatchDay] = useState("");
  const [weeklyLoad, setWeeklyLoad] = useState("");
  const [legsStatus, setLegsStatus] = useState("");
  const [tissueFocus, setTissueFocus] = useState("");
  const [includeSpeedExposure, setIncludeSpeedExposure] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState("Walk");
  const [teammateCode, setTeammateCode] = useState("");
  const [emailReminder, setEmailReminder] = useState(true);

  const [report, setReport] = useState<ReportResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const teammateValidated = teammateCode === "ELMPARC2FREE";

  // Load recovery_mode from localStorage on mount
  useEffect(() => {
    setRecoveryMode(getStoredRecoveryMode());
  }, []);

  // Persist recovery_mode to localStorage on change
  function handleRecoveryModeChange(value: string) {
    setRecoveryMode(value);
    try {
      localStorage.setItem(LS_KEY, value);
    } catch { /* localStorage unavailable */ }
  }

  function handleContinue(e: FormEvent) {
    e.preventDefault();
    setEmailError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setEmailError("Email is required.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setEmailError("Please enter a valid email.");
      return;
    }
    setEmail(trimmed);
    setStep(2);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/weekly-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          matchDay,
          weeklyLoad: Number(weeklyLoad),
          legsStatus,
          tissueFocus,
          includeSpeedExposure,
          recoveryMode,
          teammateCode: teammateCode || undefined,
          emailReminder: teammateValidated ? emailReminder : undefined,
        }),
      });

      const json = await res.json();

      if (json.ok === true) {
        setReport(json);
      } else {
        if (json.reason === "limit") {
          setErrorMsg(
            `1 report per week. Try again in ${json.daysRemaining ?? "a few"} day${json.daysRemaining === 1 ? "" : "s"}.`
          );
        } else {
          setErrorMsg(json.error ?? "Something went wrong.");
        }
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
    }

    setLoading(false);
  }

  const inputClass =
    "w-full rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3.5 text-base text-[var(--foreground)] placeholder-[var(--muted)] border-l-4 border-l-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] transition-all duration-200";

  const selectClass =
    "w-full rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3.5 text-base text-[var(--foreground)] border-l-4 border-l-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] transition-all duration-200 appearance-none cursor-pointer";

  // --- Report view ---
  if (report !== null) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-lg space-y-6">
          <h1 className="text-3xl font-bold text-[var(--foreground)] text-center">
            Your Weekly Report
          </h1>

          {report.source === "teammate" && (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-700 text-sm font-medium text-center">
              ELMPARC2 Beta unlocked ✅ Unlimited reports (free)
            </div>
          )}

          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 shadow-[var(--card-shadow)] space-y-5">
            <p className="text-lg font-medium text-[var(--foreground)]">
              {report.statusLine}
            </p>

            <div>
              <h3 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wide mb-3">
                This week&apos;s plan
              </h3>
              <ul className="space-y-2.5">
                {report.planBullets.map((bullet, i) => (
                  <li key={i} className="flex gap-3 text-[var(--foreground)]">
                    <span className="flex-shrink-0 mt-1.5 h-2 w-2 rounded-full bg-[var(--primary)]" />
                    <span className="text-base">{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl bg-[var(--input-bg)] border border-[var(--border)] border-l-4 border-l-[var(--primary)] px-4 py-3">
              <p className="text-sm text-[var(--foreground)]">
                {report.matchDayCue}
              </p>
            </div>
          </div>

          <a
            href="https://minute70.com#waitlist"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full rounded-2xl bg-[var(--primary)] text-white font-semibold py-4 text-lg text-center hover:brightness-110 transition-all duration-200 shadow-[0_4px_14px_-2px_rgba(26,122,107,0.3)]"
          >
            Get next week&apos;s report (join waitlist)
          </a>

          <button
            onClick={() => setReport(null)}
            className="block mx-auto text-sm text-[var(--muted)] hover:text-[var(--primary)] transition-colors underline underline-offset-4"
          >
            Generate another report
          </button>
        </div>
      </main>
    );
  }

  // --- Step 1: Email gate ---
  if (step === 1) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <h1 className="text-3xl font-bold text-[var(--foreground)] text-center mb-2">
            Minute70 Weekly Report (Beta)
          </h1>
          <p className="text-sm text-[var(--muted)] text-center mb-10">
            30 seconds → your week plan for strong legs in the final 20 minutes.
          </p>

          {emailError && (
            <div className="mb-6 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-red-700 text-sm">
              {emailError}
            </div>
          )}

          {/* Example output preview */}
          <div className="mb-8 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
            <h3 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">
              Example (what you&apos;ll get)
            </h3>
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">
                4 days before your match: Stamina Builder (45 min)
              </p>
              <ul className="mt-1.5 space-y-1 text-sm text-[var(--foreground)]">
                <li className="flex gap-2">
                  <span className="flex-shrink-0 mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
                  Warm-up: 8 min easy jog + mobility
                </li>
                <li className="flex gap-2">
                  <span className="flex-shrink-0 mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
                  Intervals: 6x2 min @ RPE 7 (1 min easy between)
                </li>
                <li className="flex gap-2">
                  <span className="flex-shrink-0 mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
                  Optional speed (toggle): 6x10s strides (80–90%) walk-back recovery
                </li>
                <li className="flex gap-2">
                  <span className="flex-shrink-0 mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
                  Cooldown: 5–8 min
                </li>
              </ul>
            </div>
            <p className="text-xs text-[var(--muted)]">
              Recovery example (you choose): {
                ({
                  Walk: "Walk — 20–30 min easy walk + mobility",
                  Pool: "Pool — 20–30 min easy swim + mobility",
                  Yoga: "Yoga — 20–30 min gentle flow + mobility",
                  "Foam Roll": "Foam Roll — 20–30 min rolling + mobility",
                  "Contrast Shower": "Contrast Shower — 10–15 min alternating hot/cold",
                  "Full Rest": "Full Rest — no training, no cross-training",
                } as Record<string, string>)[recoveryMode] ?? "Bike — 20–30 min easy spin + mobility"
              }
            </p>
            <p className="text-xs text-[var(--muted)] italic">
              Your plan adapts to your match day, legs status, and choices.
            </p>
          </div>

          <form onSubmit={handleContinue} className="space-y-7">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-[var(--foreground)] mb-2">
                Email <span className="text-[var(--destructive)]">*</span>
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={inputClass}
              />
              <p className="mt-1.5 text-xs text-[var(--muted)]">
                Public users get 1 report/week. Teammates get unlimited free beta access with a code. Email helps us enforce limits + send an optional 7-day reminder.
              </p>
              <p className="mt-1 text-xs text-[var(--muted)] italic">
                No spam. Not public. Beta tracking only.
              </p>
            </div>

            <button
              type="submit"
              className="w-full rounded-2xl bg-[var(--primary)] text-white font-semibold py-4 text-lg hover:brightness-110 transition-all duration-200 shadow-[0_4px_14px_-2px_rgba(26,122,107,0.3)]"
            >
              Continue
            </button>
          </form>
        </div>
      </main>
    );
  }

  // --- Step 2: Report form ---
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <h1 className="text-3xl font-bold text-[var(--foreground)] text-center mb-2">
          Minute70 Weekly Report
        </h1>
        <p className="text-sm text-[var(--muted)] text-center mb-8">{email}</p>

        {teammateValidated && (
          <div className="mb-6 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-700 text-sm font-medium">
            ELMPARC2 Beta Tester unlocked ✅
          </div>
        )}

        {errorMsg && (
          <div className="mb-6 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-red-700 text-sm">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-7">
          {/* Match Day */}
          <div>
            <label htmlFor="matchDay" className="block text-sm font-semibold text-[var(--foreground)] mb-2">
              Match Day <span className="text-[var(--destructive)]">*</span>
            </label>
            <div className="relative">
              <select
                id="matchDay"
                required
                value={matchDay}
                onChange={(e) => setMatchDay(e.target.value)}
                className={`${selectClass} ${!matchDay ? "text-[var(--muted)]" : ""}`}
              >
                <option value="" disabled>Select match day</option>
                {MATCH_DAYS.map((day) => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Weekly Load */}
          <div>
            <label htmlFor="weeklyLoad" className="block text-sm font-semibold text-[var(--foreground)] mb-2">
              Weekly Load (sessions) <span className="text-[var(--destructive)]">*</span>
            </label>
            <div className="relative">
              <select
                id="weeklyLoad"
                required
                value={weeklyLoad}
                onChange={(e) => setWeeklyLoad(e.target.value)}
                className={`${selectClass} ${!weeklyLoad ? "text-[var(--muted)]" : ""}`}
              >
                <option value="" disabled>Select sessions this week</option>
                {WEEKLY_LOAD_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Legs Status */}
          <div>
            <label className="block text-sm font-semibold text-[var(--foreground)] mb-3">
              Legs Status <span className="text-[var(--destructive)]">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {LEGS_OPTIONS.map((option) => (
                <label
                  key={option}
                  className="flex items-center gap-3 cursor-pointer select-none"
                >
                  <span
                    className={`flex-shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      legsStatus === option
                        ? "border-[var(--primary)] bg-[var(--primary)]"
                        : "border-[var(--border)]"
                    }`}
                  >
                    {legsStatus === option && (
                      <span className="h-2 w-2 rounded-full bg-white" />
                    )}
                  </span>
                  <input
                    type="radio"
                    name="legsStatus"
                    value={option}
                    checked={legsStatus === option}
                    onChange={(e) => setLegsStatus(e.target.value)}
                    required
                    className="sr-only"
                  />
                  <span className="text-base text-[var(--foreground)]">{option}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Tissue Focus */}
          <div>
            <label htmlFor="tissueFocus" className="block text-sm font-semibold text-[var(--foreground)] mb-2">
              Tissue Focus <span className="text-[var(--destructive)]">*</span>
            </label>
            <div className="relative">
              <select
                id="tissueFocus"
                required
                value={tissueFocus}
                onChange={(e) => setTissueFocus(e.target.value)}
                className={`${selectClass} ${!tissueFocus ? "text-[var(--muted)]" : ""}`}
              >
                <option value="" disabled>Select tissue focus</option>
                {TISSUE_FOCUS_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Include Speed Exposure */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <span
              className={`relative flex-shrink-0 h-6 w-11 rounded-full transition-colors duration-200 ${
                includeSpeedExposure ? "bg-[var(--primary)]" : "bg-[var(--border)]"
              }`}
              onClick={() => setIncludeSpeedExposure(!includeSpeedExposure)}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                  includeSpeedExposure ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </span>
            <span className="text-sm font-semibold text-[var(--foreground)]">
              Include Speed Exposure
            </span>
          </label>

          {/* Recovery Mode */}
          <div>
            <label htmlFor="recoveryMode" className="block text-sm font-semibold text-[var(--foreground)] mb-2">
              Recovery Mode <span className="text-[var(--destructive)]">*</span>
            </label>
            <div className="relative">
              <select
                id="recoveryMode"
                required
                value={recoveryMode}
                onChange={(e) => handleRecoveryModeChange(e.target.value)}
                className={selectClass}
              >
                {RECOVERY_MODE_OPTIONS.map((mode) => (
                  <option key={mode} value={mode}>{mode}</option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            <p className="mt-1.5 text-xs text-[var(--muted)]">We&apos;ll remember this on this device.</p>
          </div>

          {/* Teammate Code */}
          <div>
            <label htmlFor="teammateCode" className="block text-sm font-semibold text-[var(--foreground)] mb-2">
              Beta code <span className="text-[var(--muted)] font-normal">(optional)</span>
            </label>
            <input
              id="teammateCode"
              type="text"
              value={teammateCode}
              onChange={(e) => setTeammateCode(e.target.value)}
              placeholder="ELMPARC2FREE"
              className={inputClass}
            />
            <p className="mt-1.5 text-xs text-[var(--muted)]">If you were given a code, enter it here.</p>
          </div>

          {/* Email reminder checkbox — teammate only */}
          {teammateValidated && (
            <label className="flex items-center gap-3 cursor-pointer select-none rounded-xl border border-[var(--border)] bg-[var(--input-bg)] p-3 transition-all duration-200 hover:border-[var(--primary)]/50">
              <input
                type="checkbox"
                checked={emailReminder}
                onChange={(e) => setEmailReminder(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--border)] text-[var(--primary)] accent-[var(--primary)]"
              />
              <span className="text-sm text-[var(--foreground)]">
                Email me in 7 days to fill out my next report
              </span>
            </label>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-[var(--primary)] text-white font-semibold py-4 text-lg hover:brightness-110 transition-all duration-200 shadow-[0_4px_14px_-2px_rgba(26,122,107,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Generating..." : "Generate my report"}
          </button>
        </form>
      </div>
    </main>
  );
}
