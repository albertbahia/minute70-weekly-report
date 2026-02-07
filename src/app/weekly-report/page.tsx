"use client";

import { useState, FormEvent } from "react";

type Status = "idle" | "submitting" | "success" | "error";

const MATCH_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const TRAINING_DAYS_OPTIONS = ["0", "1", "2", "3", "4", "5", "6", "7"];
const LEGS_OPTIONS = ["Fresh", "Medium", "Heavy", "Tweaky"] as const;

export default function WeeklyReportPage() {
  const [email, setEmail] = useState("");
  const [matchDay, setMatchDay] = useState("");
  const [trainingDays, setTrainingDays] = useState("");
  const [legsStatus, setLegsStatus] = useState("");
  const [teammateCode, setTeammateCode] = useState("");
  const [emailReminder, setEmailReminder] = useState(true);

  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [isTeammate, setIsTeammate] = useState(false);

  const teammateValidated = teammateCode === "ELMPARC2FREE";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");

    try {
      const res = await fetch("/api/weekly-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          matchDay,
          trainingDays: Number(trainingDays),
          legsStatus,
          teammateCode: teammateCode || undefined,
          emailReminder: teammateValidated ? emailReminder : undefined,
        }),
      });

      const data = await res.json();

      if (!data.ok) {
        setStatus("error");
        setErrorMsg(data.error || "Something went wrong.");
        return;
      }

      setIsTeammate(data.source === "teammate");
      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMsg("Network error. Please try again.");
    }
  }

  const inputClass =
    "w-full rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3.5 text-base text-[var(--foreground)] placeholder-[var(--muted)] border-l-4 border-l-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] transition-all duration-200";

  const selectClass =
    "w-full rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3.5 text-base text-[var(--foreground)] border-l-4 border-l-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] transition-all duration-200 appearance-none cursor-pointer";

  if (status === "success") {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-lg space-y-6 text-center">
          {isTeammate && (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-700 text-sm font-medium">
              ELMPARC2 Beta Tester unlocked ✅
            </div>
          )}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8 shadow-[var(--card-shadow)]">
            <div className="text-4xl mb-4">🎉</div>
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-2">Report submitted!</h2>
            <p className="text-[var(--muted)] text-sm">
              {isTeammate
                ? "Thanks for your report. See you next week!"
                : "Thanks for your report. You can submit again in 7 days."}
            </p>
            <button
              onClick={() => {
                setStatus("idle");
                setEmail("");
                setMatchDay("");
                setTrainingDays("");
                setLegsStatus("");
                setTeammateCode("");
                setEmailReminder(true);
                setIsTeammate(false);
              }}
              className="mt-6 text-sm text-[var(--muted)] hover:text-[var(--primary)] transition-colors underline underline-offset-4"
            >
              Submit another
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <h1 className="text-3xl font-bold text-[var(--foreground)] text-center mb-10">
          Minute70 Weekly Report
        </h1>

        {teammateValidated && (
          <div className="mb-6 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-700 text-sm font-medium">
            ELMPARC2 Beta Tester unlocked ✅
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-7">
          {/* Email */}
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
          </div>

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

          {/* Training Days Last 7 */}
          <div>
            <label htmlFor="trainingDays" className="block text-sm font-semibold text-[var(--foreground)] mb-2">
              Training Days Last 7 <span className="text-[var(--destructive)]">*</span>
            </label>
            <div className="relative">
              <select
                id="trainingDays"
                required
                value={trainingDays}
                onChange={(e) => setTrainingDays(e.target.value)}
                className={`${selectClass} ${!trainingDays ? "text-[var(--muted)]" : ""}`}
              >
                <option value="" disabled>Select training days</option>
                {TRAINING_DAYS_OPTIONS.map((n) => (
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

          {/* Teammate Code */}
          <div>
            <label htmlFor="teammateCode" className="block text-sm font-semibold text-[var(--foreground)] mb-2">
              Teammate Code <span className="text-[var(--muted)] font-normal">(optional)</span>
            </label>
            <input
              id="teammateCode"
              type="text"
              value={teammateCode}
              onChange={(e) => setTeammateCode(e.target.value)}
              placeholder="ELMPARC2FREE"
              className={inputClass}
            />
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

          {/* Error */}
          {status === "error" && (
            <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-red-700 text-sm">
              {errorMsg}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={status === "submitting"}
            className="w-full rounded-2xl bg-[var(--primary)] text-white font-semibold py-4 text-lg hover:brightness-110 transition-all duration-200 shadow-[0_4px_14px_-2px_rgba(26,122,107,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === "submitting" ? "Generating..." : "Generate my report"}
          </button>
        </form>
      </div>
    </main>
  );
}
