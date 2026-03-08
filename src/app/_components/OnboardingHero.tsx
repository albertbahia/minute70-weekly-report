"use client";

import { useState, useEffect, FormEvent } from "react";
import { getLateWindow } from "@/lib/late-window";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { logEvent } from "@/lib/log-event";

const DEFAULT_HALF = 25;
const LS_ONBOARDING_KEY = "minute70_onboarding";

type Step = "questionnaire" | "preview" | "auth";
type Focus = "late_game" | "injury_prevention";

const MATCH_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const LEGS_OPTIONS = ["Fresh", "Moderate", "Heavy", "Very Heavy"];

const PREVIEW_SESSIONS: Record<Focus, { title: string; moves: string[] }[]> = {
  late_game: [
    {
      title: "3 days out: Late-Game Conditioning",
      moves: [
        "Warm-up: 5 min easy jog + dynamic mobility",
        "Intervals: 4×3 min @ RPE 7 (90s easy between)",
        "Finish: 3×10s acceleration bursts",
        "Cooldown: 5 min + calf stretch",
      ],
    },
    {
      title: "1 day out: Match Activation",
      moves: [
        "10 min easy movement + strides",
        "3×20m acceleration runs",
        "5 min foam roll — quads & hamstrings",
      ],
    },
  ],
  injury_prevention: [
    {
      title: "3 days out: Hip & Hamstring Activation",
      moves: [
        "Warm-up: 5 min walk + hip circles",
        "Nordic curls: 3×5 slow negatives",
        "Hip flexor stretch + glute bridge: 3×12",
        "Cooldown: 5 min adductor stretch",
      ],
    },
    {
      title: "1 day out: Pre-Match Mobility",
      moves: [
        "10 min light movement",
        "Dynamic hip opener: 2×8 each side",
        "Groin activation: band walks 2×15",
      ],
    },
  ],
};

function StepDots({ current, dark }: { current: 1 | 2 | 3; dark?: boolean }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-10">
      {([1, 2, 3] as const).map((n) => (
        <div
          key={n}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            n === current
              ? "w-6 bg-[var(--primary)]"
              : n < current
              ? `w-3 ${dark ? "bg-[var(--primary)]/50" : "bg-[var(--primary)]/40"}`
              : `w-3 ${dark ? "bg-[var(--on-dark-border)]" : "bg-[var(--border)]"}`
          }`}
        />
      ))}
    </div>
  );
}

export default function OnboardingHero() {
  const [step, setStep] = useState<Step>("questionnaire");
  const [focus, setFocus] = useState<Focus | null>(null);
  const [matchDay, setMatchDay] = useState("Saturday");
  const [legsStatus, setLegsStatus] = useState("Moderate");

  const [authMode, setAuthMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    try {
      const supabase = getSupabaseBrowser();
      supabase.auth.getSession().then(({ data: { session: s } }) => {
        if (s) window.location.href = "/app";
      });
    } catch {
      // env vars not configured — stay on page
    }
  }, []);

  function handleShowPlan() {
    if (!focus) return;
    try {
      localStorage.setItem(LS_ONBOARDING_KEY, JSON.stringify({ focus, matchDay, legsStatus }));
    } catch {
      // localStorage unavailable — continue anyway
    }
    setStep("preview");
  }

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
      const { data, error } = await supabase.auth.signUp({ email: trimmed, password });
      if (error) { setAuthError(error.message); setAuthLoading(false); return; }
      if (!data.session) {
        setAuthError("Check your inbox — we sent you a confirmation link.");
        setAuthLoading(false);
        return;
      }
      logEvent(data.session.access_token, "signup_created");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: trimmed, password });
      if (error) { setAuthError(error.message); setAuthLoading(false); return; }
    }

    window.location.href = "/app";
  }

  const inputClass =
    "w-full rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3.5 text-base text-[var(--foreground)] placeholder-[var(--muted)] border-l-4 border-l-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] transition-all duration-200";

  const lateWindow = getLateWindow(DEFAULT_HALF);
  const previewSessions = focus ? PREVIEW_SESSIONS[focus] : [];

  // ── Step 1: Questionnaire — dark hero ─────────────────────────────────────
  if (step === "questionnaire") {
    return (
      <section
        id="onboarding"
        className="w-full relative overflow-hidden"
      >
        {/* Looping background video */}
        <video
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          poster="/hero-poster.jpg"
          aria-hidden="true"
        >
          <source src="https://jwyzirf2p9nsxfdg.public.blob.vercel-storage.com/hero.mp4" type="video/mp4" />
        </video>

        {/* Dark overlay — preserves text readability */}
        <div className="absolute inset-0 bg-[var(--hero-bg)]/90" />

        {/* All existing content — sits above the video */}
        <div className="relative z-10 max-w-2xl mx-auto pt-28 sm:pt-36 pb-16 px-6">
          <StepDots current={1} dark />

          <div className="text-center space-y-5 mb-12">
            <p className="text-sm font-semibold uppercase tracking-widest text-[var(--accent)]">
              Late-Game Legs, Engineered
            </p>
            <h1
              className="text-5xl sm:text-6xl font-black tracking-tight leading-[0.95] text-[var(--on-dark)]"
              style={{ fontFamily: "var(--font-heading), system-ui, sans-serif" }}
            >
              Finish strong in the final&nbsp;{lateWindow}&nbsp;minutes
            </h1>
            <p className="text-lg font-light text-[var(--on-dark-muted)] max-w-lg mx-auto">
              Answer 3 questions — see your personalized training plan instantly.
            </p>
            <div className="flex flex-wrap gap-3 justify-center pt-1">
              {["3 Questions", "8-Min Sessions", "Free First Session"].map((stat, i, arr) => (
                <span key={stat} className="flex items-center gap-3">
                  <span className="text-xs font-semibold uppercase tracking-widest text-[var(--on-dark-muted)]">
                    {stat}
                  </span>
                  {i < arr.length - 1 && (
                    <span className="text-[var(--on-dark-border)] select-none">·</span>
                  )}
                </span>
              ))}
            </div>
          </div>

          <div className="max-w-lg mx-auto space-y-7">
            <div className="space-y-3">
              <p className="text-sm font-semibold text-[var(--on-dark)]">What&apos;s your #1 concern?</p>
              <button
                onClick={() => setFocus("late_game")}
                className={`w-full text-left rounded-xl border-2 p-5 transition-all duration-200 ${
                  focus === "late_game"
                    ? "border-[var(--primary)] bg-[var(--primary)]/15"
                    : "border-[var(--on-dark-border)] bg-white/5 hover:border-[var(--primary)]/60"
                }`}
              >
                <p className="text-base font-semibold text-[var(--on-dark)]">Late-game legs</p>
                <p className="text-sm text-[var(--on-dark-muted)] mt-1">Legs fade in the last 20 minutes</p>
              </button>
              <button
                onClick={() => setFocus("injury_prevention")}
                className={`w-full text-left rounded-xl border-2 p-5 transition-all duration-200 ${
                  focus === "injury_prevention"
                    ? "border-[var(--primary)] bg-[var(--primary)]/15"
                    : "border-[var(--on-dark-border)] bg-white/5 hover:border-[var(--primary)]/60"
                }`}
              >
                <p className="text-base font-semibold text-[var(--on-dark)]">Injury prevention</p>
                <p className="text-sm text-[var(--on-dark-muted)] mt-1">Reduce risk of hamstring / groin injuries</p>
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-[var(--on-dark)]">Match day</p>
              <div className="flex flex-wrap gap-2">
                {MATCH_DAYS.map((day) => (
                  <button
                    key={day}
                    onClick={() => setMatchDay(day)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      matchDay === day
                        ? "bg-[var(--primary)] text-white"
                        : "bg-white/8 text-[var(--on-dark-muted)] border border-[var(--on-dark-border)] hover:border-[var(--primary)]/60"
                    }`}
                  >
                    {day.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-[var(--on-dark)]">Legs this week</p>
              <div className="flex flex-wrap gap-2">
                {LEGS_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setLegsStatus(opt)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      legsStatus === opt
                        ? "bg-[var(--primary)] text-white"
                        : "bg-white/8 text-[var(--on-dark-muted)] border border-[var(--on-dark-border)] hover:border-[var(--primary)]/60"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleShowPlan}
              disabled={!focus}
              className="w-full rounded-2xl bg-[var(--primary)] text-white font-semibold py-4 text-lg hover:scale-[1.02] hover:shadow-[0_6px_20px_-2px_rgba(26,122,107,0.4)] transition-all duration-200 shadow-[0_4px_14px_-2px_rgba(26,122,107,0.3)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              See my plan →
            </button>

            <p className="text-center text-sm text-[var(--on-dark-muted)]">
              Already have an account?{" "}
              <button
                onClick={() => { setAuthMode("login"); setStep("auth"); }}
                className="text-[var(--on-dark)] underline underline-offset-4 hover:text-white transition-colors"
              >
                Sign in
              </button>
            </p>
          </div>
        </div>
      </section>
    );
  }

  // ── Step 2: Preview ────────────────────────────────────────────────────────
  if (step === "preview") {
    return (
      <section className="w-full bg-[var(--background)] pt-20 sm:pt-28 pb-16 px-6">
        <div className="max-w-lg mx-auto space-y-6">
          <StepDots current={2} />

          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--primary)] mb-1">
              Your plan is ready
            </p>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">
              {focus === "late_game" ? "Late-Game Leg Training" : "Injury Prevention Program"}
            </h1>
            <p className="text-sm text-[var(--muted)] mt-1">
              {matchDay} match · {legsStatus} legs this week
            </p>
          </div>

          {previewSessions[0] && (
            <div className="bg-[var(--card)] rounded-2xl p-5 space-y-3" style={{ border: `1px solid var(--border)`, borderLeft: `4px solid var(--primary)` }}>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[var(--foreground)]">Session 1</h3>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[var(--input-bg)] text-[var(--muted)] border border-[var(--border)]">
                  8 min
                </span>
              </div>
              <p className="text-sm text-[var(--muted)]">{previewSessions[0].title}</p>
              <ul className="space-y-1.5">
                {previewSessions[0].moves.map((move, i) => (
                  <li key={i} className="flex gap-2 text-sm text-[var(--foreground)]">
                    <span className="flex-shrink-0 mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
                    {move}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {previewSessions[1] && (
            <div className="relative">
              <div
                className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 space-y-3 blur-sm select-none pointer-events-none"
                aria-hidden
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-[var(--foreground)]">Session 2</h3>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[var(--input-bg)] text-[var(--muted)] border border-[var(--border)]">
                    8 min
                  </span>
                </div>
                <p className="text-sm text-[var(--muted)]">{previewSessions[1].title}</p>
                <ul className="space-y-1.5">
                  {previewSessions[1].moves.map((move, i) => (
                    <li key={i} className="flex gap-2 text-sm text-[var(--foreground)]">
                      <span className="flex-shrink-0 mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
                      {move}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-[var(--card)]/70">
                <svg className="w-6 h-6 mb-2 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <p className="text-base font-bold text-[var(--foreground)]">Unlock your full week</p>
                <p className="text-sm text-[var(--muted)] mt-0.5">Free · No credit card</p>
              </div>
            </div>
          )}

          <button
            onClick={() => { setAuthMode("signup"); setStep("auth"); }}
            className="w-full rounded-2xl bg-[var(--primary)] text-white font-semibold py-4 text-lg hover:scale-[1.02] hover:shadow-[0_6px_20px_-2px_rgba(26,122,107,0.4)] transition-all duration-200 shadow-[0_4px_14px_-2px_rgba(26,122,107,0.3)]"
          >
            Start training free →
          </button>

          <p className="text-center text-sm text-[var(--muted)]">
            Already have an account?{" "}
            <button
              onClick={() => { setAuthMode("login"); setStep("auth"); }}
              className="underline underline-offset-4 hover:text-[var(--primary)] transition-colors"
            >
              Sign in
            </button>
          </p>

          <p className="text-center text-xs text-[var(--muted)]">
            <button
              onClick={() => setStep("questionnaire")}
              className="underline underline-offset-4 hover:text-[var(--primary)] transition-colors"
            >
              ← Back
            </button>
          </p>
        </div>
      </section>
    );
  }

  // ── Step 3: Auth ───────────────────────────────────────────────────────────
  return (
    <section className="w-full bg-[var(--background)] pt-20 sm:pt-28 pb-16 px-6">
      <div className="max-w-lg mx-auto space-y-6">
        <StepDots current={3} />

        <div className="text-center">
          <h1 className="text-2xl font-bold text-[var(--foreground)] mb-1">
            {authMode === "signup" ? "Create your free account" : "Welcome back"}
          </h1>
          <p className="text-sm text-[var(--muted)]">
            {authMode === "signup"
              ? "Your first session is free every week."
              : "Continue where you left off."}
          </p>
          {focus && authMode === "signup" && (
            <p className="text-sm italic text-[var(--muted)] mt-1">
              Your {focus === "late_game" ? "late-game" : "injury prevention"} plan is ready.
            </p>
          )}
        </div>

        {authError && (
          <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-red-700 text-sm">
            {authError}
          </div>
        )}

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
            className="w-full rounded-2xl bg-[var(--primary)] text-white font-semibold py-4 text-lg hover:scale-[1.02] hover:shadow-[0_6px_20px_-2px_rgba(26,122,107,0.4)] transition-all duration-200 shadow-[0_4px_14px_-2px_rgba(26,122,107,0.3)] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {authLoading
              ? "Please wait…"
              : authMode === "signup"
                ? "Sign Up & Continue"
                : "Log In & Continue"}
          </button>
        </form>

        <p className="text-center text-sm text-[var(--muted)]">
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

        <p className="text-center text-xs text-[var(--muted)]">
          <button
            onClick={() => setStep("preview")}
            className="underline underline-offset-4 hover:text-[var(--primary)] transition-colors"
          >
            ← Back to preview
          </button>
        </p>

        <p className="text-center text-xs text-[var(--muted)] italic">No spam. Not public.</p>
      </div>
    </section>
  );
}
