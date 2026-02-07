"use client";

import { useState, FormEvent } from "react";

type Status = "idle" | "submitting" | "success" | "error";

export default function WeeklyReportPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [accomplishments, setAccomplishments] = useState("");
  const [goals, setGoals] = useState("");
  const [blockers, setBlockers] = useState("");
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
          name,
          accomplishments,
          goals,
          blockers,
          teammateCode: teammateCode || undefined,
          emailReminder: teammateValidated ? emailReminder : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data.error || "Something went wrong.");
        return;
      }

      setIsTeammate(data.isTeammate);
      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMsg("Network error. Please try again.");
    }
  }

  if (status === "success") {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-lg space-y-6 text-center">
          {isTeammate && (
            <div className="bg-emerald-900/40 border border-emerald-500/50 rounded-lg px-4 py-3 text-emerald-300 text-sm font-medium">
              ELMPARC2 Beta Tester unlocked ✅
            </div>
          )}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8">
            <div className="text-4xl mb-4">🎉</div>
            <h2 className="text-xl font-semibold text-white mb-2">Report submitted!</h2>
            <p className="text-zinc-400 text-sm">
              {isTeammate
                ? "Thanks for your report. See you next week!"
                : "Thanks for your report. You can submit again in 7 days."}
            </p>
            <button
              onClick={() => {
                setStatus("idle");
                setEmail("");
                setName("");
                setAccomplishments("");
                setGoals("");
                setBlockers("");
                setTeammateCode("");
                setEmailReminder(true);
                setIsTeammate(false);
              }}
              className="mt-6 text-sm text-zinc-500 hover:text-white transition-colors underline underline-offset-4"
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
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Weekly Report</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Share what you worked on this week.
          </p>
        </div>

        {teammateValidated && (
          <div className="mb-6 bg-emerald-900/40 border border-emerald-500/50 rounded-lg px-4 py-3 text-emerald-300 text-sm font-medium">
            ELMPARC2 Beta Tester unlocked ✅
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-300 mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent"
            />
          </div>

          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-zinc-300 mb-1.5">
              Name
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent"
            />
          </div>

          {/* Accomplishments */}
          <div>
            <label htmlFor="accomplishments" className="block text-sm font-medium text-zinc-300 mb-1.5">
              What did you accomplish this week?
            </label>
            <textarea
              id="accomplishments"
              required
              rows={3}
              value={accomplishments}
              onChange={(e) => setAccomplishments(e.target.value)}
              placeholder="Shipped the new onboarding flow, fixed 3 bugs..."
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent resize-y"
            />
          </div>

          {/* Goals */}
          <div>
            <label htmlFor="goals" className="block text-sm font-medium text-zinc-300 mb-1.5">
              Goals for next week
            </label>
            <textarea
              id="goals"
              required
              rows={3}
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              placeholder="Start the payments integration, write tests..."
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent resize-y"
            />
          </div>

          {/* Blockers */}
          <div>
            <label htmlFor="blockers" className="block text-sm font-medium text-zinc-300 mb-1.5">
              Blockers <span className="text-zinc-500 font-normal">(optional)</span>
            </label>
            <textarea
              id="blockers"
              rows={2}
              value={blockers}
              onChange={(e) => setBlockers(e.target.value)}
              placeholder="Waiting on design review for the dashboard..."
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent resize-y"
            />
          </div>

          {/* Teammate Code */}
          <div>
            <label htmlFor="teammateCode" className="block text-sm font-medium text-zinc-300 mb-1.5">
              Teammate code <span className="text-zinc-500 font-normal">(optional)</span>
            </label>
            <input
              id="teammateCode"
              type="text"
              value={teammateCode}
              onChange={(e) => setTeammateCode(e.target.value)}
              placeholder="Enter code if you have one"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent"
            />
          </div>

          {/* Email reminder checkbox — teammate only */}
          {teammateValidated && (
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={emailReminder}
                onChange={(e) => setEmailReminder(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500"
              />
              <span className="text-sm text-zinc-300">
                Email me in 7 days to fill out my next report
              </span>
            </label>
          )}

          {/* Error */}
          {status === "error" && (
            <div className="bg-red-900/40 border border-red-500/50 rounded-lg px-4 py-3 text-red-300 text-sm">
              {errorMsg}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={status === "submitting"}
            className="w-full rounded-lg bg-white text-black font-medium py-2.5 text-sm hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === "submitting" ? "Submitting..." : "Submit Report"}
          </button>
        </form>
      </div>
    </main>
  );
}
