"use client";

import { useState, useEffect, FormEvent } from "react";
import { getLateWindow } from "@/lib/late-window";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { logEvent } from "@/lib/log-event";
import type { Session } from "@supabase/supabase-js";

const DEFAULT_HALF = 25;

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
  // Auth state
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Recovery mode (for example preview only)
  const [recoveryMode, setRecoveryMode] = useState("Walk");

  // Load recovery_mode from localStorage on mount
  useEffect(() => {
    setRecoveryMode(getStoredRecoveryMode());
  }, []);

  // Check for existing Supabase session on mount — redirect to /app
  useEffect(() => {
    const supabase = getSupabaseBrowser();
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s) {
        window.location.href = "/app";
      }
    });
  }, []);

  async function handleAuth(e: FormEvent) {
    e.preventDefault();
    setAuthError(null);
    const trimmed = email.trim();
    if (!trimmed) { setAuthError("Email is required."); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) { setAuthError("Please enter a valid email."); return; }
    if (password.length < 6) { setAuthError("Password must be at least 6 characters."); return; }

    setAuthLoading(true);
    const supabase = getSupabaseBrowser();

    if (authMode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email: trimmed,
        password,
      });
      if (error) {
        setAuthError(error.message);
        setAuthLoading(false);
        return;
      }
      if (data.session) {
        logEvent(data.session.access_token, "signup_created");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmed,
        password,
      });
      if (error) {
        setAuthError(error.message);
        setAuthLoading(false);
        return;
      }
    }

    window.location.href = "/app";
  }

  const inputClass =
    "w-full rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3.5 text-base text-[var(--foreground)] placeholder-[var(--muted)] border-l-4 border-l-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] transition-all duration-200";

  const lateWindow = getLateWindow(DEFAULT_HALF);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <h1 className="text-3xl font-bold text-[var(--foreground)] text-center mb-2">
          Minute70 Weekly Report
        </h1>
        <p className="text-sm text-[var(--muted)] text-center mb-10">
          30 seconds → your week plan for strong legs in the final {lateWindow} minutes.
        </p>

        {authError && (
          <div className="mb-6 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-red-700 text-sm">
            {authError}
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

        <form onSubmit={handleAuth} className="space-y-5">
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

          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-[var(--foreground)] mb-2">
              Password <span className="text-[var(--destructive)]">*</span>
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className={inputClass}
            />
          </div>

          <button
            type="submit"
            disabled={authLoading}
            className="w-full rounded-2xl bg-[var(--primary)] text-white font-semibold py-4 text-lg hover:scale-[1.02] hover:shadow-[0_6px_20px_-2px_rgba(26,122,107,0.4)] transition-all duration-200 shadow-[0_4px_14px_-2px_rgba(26,122,107,0.3)] disabled:opacity-60"
          >
            {authLoading
              ? "Please wait…"
              : authMode === "signup"
                ? "Sign Up & Continue"
                : "Log In & Continue"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-[var(--muted)]">
          {authMode === "signup" ? (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => { setAuthMode("login"); setAuthError(null); }}
                className="underline underline-offset-4 hover:text-[var(--primary)] transition-colors"
              >
                Log in
              </button>
            </>
          ) : (
            <>
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => { setAuthMode("signup"); setAuthError(null); }}
                className="underline underline-offset-4 hover:text-[var(--primary)] transition-colors"
              >
                Sign up
              </button>
            </>
          )}
        </p>

        <p className="mt-2 text-center text-xs text-[var(--muted)] italic">
          No spam. Not public.
        </p>

        <p className="mt-4 text-center text-xs text-[var(--muted)]">
          Want to join the waitlist when Minute70 fully releases?{" "}
          <a
            href="/waitlist"
            className="underline underline-offset-4 hover:text-[var(--primary)] transition-colors"
          >
            Join the waitlist
          </a>
        </p>
      </div>
    </main>
  );
}
