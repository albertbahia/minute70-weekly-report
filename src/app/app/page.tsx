"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { logEvent } from "@/lib/log-event";
import type { Session } from "@supabase/supabase-js";

interface SessionRow {
  id: string;
  scheduled_for: string;
  completed_at: string | null;
  duration_minutes: number;
  status: "scheduled" | "completed" | "skipped";
}

interface PlanRow {
  id: string;
  focus: string;
  sessions_per_week: number;
  match_id: string | null;
}

const CAPTAIN_QUOTES = [
  "Consistency beats intensity. You showed up — that matters.",
  "The final minutes belong to those who prepare. You're preparing.",
  "Every session adds a layer of resilience your legs will thank you for.",
];

export default function AppDashboard() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Data
  const [plan, setPlan] = useState<PlanRow | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [profileFocus, setProfileFocus] = useState<string | null>(null);

  // Modals
  const [showFocusModal, setShowFocusModal] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [showAutoAdjust, setShowAutoAdjust] = useState(false);

  // Promo state
  const [promoCode, setPromoCode] = useState("");
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoSuccess, setPromoSuccess] = useState(false);
  const [promoLoading, setPromoLoading] = useState(false);

  // Focus selection
  const [focusLoading, setFocusLoading] = useState(false);
  const [focusError, setFocusError] = useState<string | null>(null);

  // Auto-adjust
  const [adjustLoading, setAdjustLoading] = useState(false);

  // Paywall message
  const [paywallMessage, setPaywallMessage] = useState<string | null>(null);

  const token = session?.access_token ?? "";

  const headers = useCallback(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    }),
    [token],
  );

  // Auth check
  useEffect(() => {
    const supabase = getSupabaseBrowser();
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!s) {
        window.location.href = "/weekly-report";
        return;
      }
      setSession(s);
    });
  }, []);

  // Fetch profile + plan once authed
  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);

    const [profileRes, planRes] = await Promise.all([
      fetch("/api/profile", { headers: { Authorization: `Bearer ${token}` } }),
      fetch("/api/plan", { headers: { Authorization: `Bearer ${token}` } }),
    ]);

    const profileJson = await profileRes.json();
    const planJson = await planRes.json();

    if (profileJson.ok && profileJson.profile) {
      setProfileFocus(profileJson.profile.focus);
    } else {
      setShowFocusModal(true);
    }

    if (planJson.ok) {
      setPlan(planJson.plan);
      setSessions(planJson.sessions ?? []);
    }

    setLoading(false);
  }, [token]);

  useEffect(() => {
    if (token) fetchData();
  }, [token, fetchData]);

  // Check for auto-adjust trigger from session player return
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("autoAdjust") === "1") {
      setShowAutoAdjust(true);
      window.history.replaceState({}, "", "/app");
    }
  }, []);

  // --- Handlers ---

  async function handleFocusSelect(focus: "late_game" | "injury_prevention") {
    setFocusLoading(true);
    setFocusError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ focus }),
      });
      const json = await res.json();
      if (!json.ok) {
        setFocusError(json.error ?? "Could not save. Try again.");
        setFocusLoading(false);
        return;
      }
    } catch {
      setFocusError("Network error. Try again.");
      setFocusLoading(false);
      return;
    }
    setProfileFocus(focus);
    setShowFocusModal(false);
    setFocusLoading(false);
    // Refetch plan (will auto-generate with new focus)
    setPlan(null);
    setSessions([]);
    fetchData();
  }

  async function handleStartSession(sessionId: string) {
    const res = await fetch(`/api/sessions/${sessionId}/start`, {
      method: "POST",
      headers: headers(),
    });
    const json = await res.json();

    if (json.paywallRequired) {
      setShowPaywall(true);
      logEvent(token, "paywall_viewed", { triggered_by: "session_start" });
      return;
    }

    if (json.ok) {
      logEvent(token, "session_started", { session_id: sessionId, focus: plan?.focus });
      window.location.href = `/app/session/${sessionId}`;
    }
  }

  async function handlePromoRedeem() {
    setPromoError(null);
    setPromoLoading(true);

    const res = await fetch("/api/promo/redeem", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        code: promoCode,
        email: session?.user.email ?? "",
      }),
    });

    const json = await res.json();
    setPromoLoading(false);

    if (json.ok) {
      setPromoSuccess(true);
      logEvent(token, "promo_redeemed", { code: promoCode.toUpperCase() });
    } else {
      setPromoError(json.error ?? "Failed to redeem code.");
    }
  }

  async function handleAutoAdjust() {
    if (!plan) return;
    setAdjustLoading(true);
    const res = await fetch("/api/auto-adjust", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ plan_id: plan.id }),
    });
    const json = await res.json();
    setAdjustLoading(false);
    setShowAutoAdjust(false);

    if (json.ok) {
      logEvent(token, "auto_adjust_accepted", {
        plan_id: plan.id,
        sessions_adjusted: json.sessionsAdjusted,
      });
      fetchData();
    }
  }

  async function handleSignOut() {
    const supabase = getSupabaseBrowser();
    await supabase.auth.signOut();
    window.location.href = "/weekly-report";
  }

  // --- Computed ---

  const completedCount = sessions.filter((s) => s.status === "completed").length;
  const totalCount = sessions.length;
  const today = new Date().toISOString().slice(0, 10);
  const overdue = sessions.filter(
    (s) => s.status === "scheduled" && s.scheduled_for < today,
  );
  const isBehind = overdue.length > 0;
  const remaining = totalCount - completedCount;

  const focusLabel =
    profileFocus === "late_game"
      ? "Late-game legs"
      : profileFocus === "injury_prevention"
        ? "Injury prevention"
        : "";

  // --- Render ---

  if (loading || !session) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--muted)]">Loading...</p>
      </main>
    );
  }

  return (
    <>
      {/* Header */}
      <header className="w-full border-b border-[var(--border)]">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-6 py-4">
          <a
            href="/"
            className="text-lg font-bold tracking-tight text-[var(--foreground)] hover:text-[var(--primary)] transition-colors"
          >
            Minute70
          </a>
          <div className="flex items-center gap-4">
            <span className="text-sm text-[var(--muted)]">{session.user.email}</span>
            <button
              onClick={handleSignOut}
              className="text-sm text-[var(--muted)] underline underline-offset-4 hover:text-[var(--primary)] transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="min-h-screen flex items-start justify-center p-6 pt-10">
        <div className="w-full max-w-lg space-y-6">
          {/* Focus badge */}
          {profileFocus && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Focus
              </span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[var(--primary)] text-white">
                {focusLabel}
              </span>
            </div>
          )}

          {/* This Week heading */}
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
            This Week
          </h1>

          {/* Status */}
          {totalCount > 0 && (
            <div
              className={`rounded-xl px-4 py-3 text-sm font-medium ${
                isBehind
                  ? "border border-amber-300 bg-amber-50 text-amber-800"
                  : "border border-emerald-300 bg-emerald-50 text-emerald-700"
              }`}
            >
              {isBehind
                ? `Behind this week — ${remaining} session${remaining !== 1 ? "s" : ""} left to stay on track.`
                : completedCount === totalCount
                  ? "All sessions complete. Well done."
                  : `On track — ${completedCount} of ${totalCount} sessions done.`}
            </div>
          )}

          {/* Progress */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-[var(--border)]">
              <div
                className="h-2 rounded-full bg-[var(--primary)] transition-all duration-300"
                style={{
                  width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : "0%",
                }}
              />
            </div>
            <span className="text-sm font-semibold text-[var(--foreground)]">
              {completedCount}/{totalCount}
            </span>
          </div>

          {/* Session cards */}
          {sessions.map((s, i) => (
            <div
              key={s.id}
              className="bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-[var(--card-shadow)] p-5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[var(--foreground)]">
                  Session {i + 1}
                </h3>
                <span
                  className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                    s.status === "completed"
                      ? "bg-emerald-100 text-emerald-700"
                      : s.status === "skipped"
                        ? "bg-red-100 text-red-600"
                        : "bg-[var(--input-bg)] text-[var(--muted)] border border-[var(--border)]"
                  }`}
                >
                  {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                </span>
              </div>

              <p className="text-sm text-[var(--muted)]">
                {focusLabel} &middot; ~{s.duration_minutes} min &middot;{" "}
                {formatDate(s.scheduled_for)}
              </p>

              {s.status === "scheduled" && (
                <button
                  onClick={() => handleStartSession(s.id)}
                  className="w-full rounded-2xl bg-[var(--primary)] text-white font-semibold py-3 text-base hover:scale-[1.02] hover:shadow-[0_6px_20px_-2px_rgba(26,122,107,0.4)] transition-all duration-200 shadow-[0_4px_14px_-2px_rgba(26,122,107,0.3)]"
                >
                  Start Session
                </button>
              )}

              {s.status === "completed" && s.completed_at && (
                <p className="text-xs text-[var(--muted)]">
                  Completed {new Date(s.completed_at).toLocaleDateString()}
                </p>
              )}
            </div>
          ))}

          {/* Generate new plan link */}
          {sessions.length === 0 && !loading && (
            <p className="text-center text-sm text-[var(--muted)]">
              No sessions yet. Set your focus above to get started.
            </p>
          )}
        </div>
      </main>

      {/* ===== FOCUS MODAL ===== */}
      {showFocusModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--card)] rounded-2xl shadow-[var(--card-shadow-lg)] p-8 max-w-md w-full space-y-6">
            <h2 className="text-xl font-bold tracking-tight text-[var(--foreground)] text-center">
              What&apos;s your #1 concern?
            </h2>

            {focusError && (
              <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-red-700 text-sm">
                {focusError}
              </div>
            )}

            <button
              onClick={() => handleFocusSelect("late_game")}
              disabled={focusLoading}
              className="w-full text-left rounded-xl border-2 border-[var(--border)] hover:border-[var(--primary)] p-5 transition-colors"
            >
              <p className="text-base font-semibold text-[var(--foreground)]">
                Late-game legs
              </p>
              <p className="text-sm text-[var(--muted)] mt-1">
                Legs fade in the last 20 minutes
              </p>
            </button>

            <button
              onClick={() => handleFocusSelect("injury_prevention")}
              disabled={focusLoading}
              className="w-full text-left rounded-xl border-2 border-[var(--border)] hover:border-[var(--primary)] p-5 transition-colors"
            >
              <p className="text-base font-semibold text-[var(--foreground)]">
                Hamstring / groin injury prevention
              </p>
              <p className="text-sm text-[var(--muted)] mt-1">
                Reduce risk of common soft-tissue injuries
              </p>
            </button>

            <button
              onClick={handleSignOut}
              className="block mx-auto text-sm text-[var(--muted)] underline underline-offset-4 hover:text-[var(--primary)] transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      )}

      {/* ===== PAYWALL MODAL ===== */}
      {showPaywall && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--card)] rounded-2xl shadow-[var(--card-shadow-lg)] p-8 max-w-md w-full space-y-6">
            <button
              onClick={() => { setShowPaywall(false); setPaywallMessage(null); }}
              className="absolute top-4 right-4 text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              &times;
            </button>

            <h2 className="text-xl font-bold tracking-tight text-[var(--foreground)] text-center">
              Unlock guided sessions
            </h2>
            <p className="text-sm text-[var(--muted)] text-center">
              Access 8-minute guided sessions that adapt to your week.
            </p>

            {paywallMessage && (
              <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-700 text-sm text-center">
                {paywallMessage}
              </div>
            )}

            {/* Monthly */}
            <div className="rounded-xl border border-[var(--border)] p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold text-[var(--foreground)]">Monthly</span>
                <span className="text-base font-bold text-[var(--foreground)]">$11.99/mo</span>
              </div>
              <button
                onClick={() => {
                  logEvent(token, "trial_started", { source: "paywall_monthly" });
                  setPaywallMessage("Free trials coming soon. Join the waitlist.");
                }}
                className="w-full rounded-xl bg-[var(--primary)] text-white font-semibold py-3 text-sm hover:scale-[1.02] transition-all duration-200"
              >
                Start 2 Week Free Trial
              </button>
            </div>

            {/* Season Pass */}
            <div className="rounded-xl border-2 border-[var(--primary)] p-4 space-y-2 relative">
              <span className="absolute -top-3 left-4 bg-[var(--accent)] text-white text-xs font-semibold px-2.5 py-0.5 rounded-full">
                Best value
              </span>
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold text-[var(--foreground)]">Season Pass</span>
                <span className="text-base font-bold text-[var(--foreground)]">$98.99/yr</span>
              </div>
              <p className="text-xs text-[var(--muted)]">12 months from purchase</p>
              <button
                onClick={() => {
                  logEvent(token, "season_pass_purchased", { source: "paywall_cta" });
                  setPaywallMessage("Season Pass coming soon. Join the waitlist.");
                }}
                className="w-full rounded-xl bg-[var(--primary)] text-white font-semibold py-3 text-sm hover:scale-[1.02] transition-all duration-200"
              >
                Start 2 Week Free Trial
              </button>
            </div>

            <div className="text-center">
              <button
                onClick={() => {
                  setShowPaywall(false);
                  setPaywallMessage(null);
                  setShowPromoModal(true);
                }}
                className="text-sm text-[var(--muted)] underline underline-offset-4 hover:text-[var(--primary)] transition-colors"
              >
                Have a team code?
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== PROMO CODE MODAL ===== */}
      {showPromoModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--card)] rounded-2xl shadow-[var(--card-shadow-lg)] p-8 max-w-md w-full space-y-5">
            <h2 className="text-xl font-bold tracking-tight text-[var(--foreground)] text-center">
              Enter your team code
            </h2>

            {promoError && (
              <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-red-700 text-sm">
                {promoError}
              </div>
            )}

            {promoSuccess ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-700 text-sm text-center">
                  Code redeemed. You have 3 Pro sessions per week for 4 weeks.
                </div>
                <button
                  onClick={() => {
                    setShowPromoModal(false);
                    setPromoSuccess(false);
                    setPromoCode("");
                    fetchData();
                  }}
                  className="w-full rounded-2xl bg-[var(--primary)] text-white font-semibold py-3 text-base hover:scale-[1.02] transition-all duration-200"
                >
                  Continue
                </button>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-semibold text-[var(--foreground)] mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={session?.user.email ?? ""}
                    disabled
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--muted)]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[var(--foreground)] mb-2">
                    Team code
                  </label>
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    placeholder="Enter code here"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3.5 text-base text-[var(--foreground)] placeholder-[var(--muted)] border-l-4 border-l-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] transition-all duration-200"
                  />
                </div>
                <button
                  onClick={handlePromoRedeem}
                  disabled={promoLoading || !promoCode.trim()}
                  className="w-full rounded-2xl bg-[var(--primary)] text-white font-semibold py-3 text-base hover:scale-[1.02] transition-all duration-200 disabled:opacity-60"
                >
                  {promoLoading ? "Redeeming..." : "Redeem Code"}
                </button>
                <button
                  onClick={() => {
                    setShowPromoModal(false);
                    setPromoError(null);
                  }}
                  className="w-full text-sm text-[var(--muted)] underline underline-offset-4 hover:text-[var(--primary)] transition-colors"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ===== AUTO-ADJUST MODAL ===== */}
      {showAutoAdjust && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--card)] rounded-2xl shadow-[var(--card-shadow-lg)] p-8 max-w-md w-full space-y-5 text-center">
            <h2 className="text-xl font-bold tracking-tight text-[var(--foreground)]">
              Adjust your remaining sessions?
            </h2>
            <p className="text-sm text-[var(--muted)]">
              We&apos;ll recalibrate your upcoming sessions based on what you&apos;ve completed.
            </p>
            <button
              onClick={handleAutoAdjust}
              disabled={adjustLoading}
              className="w-full rounded-2xl bg-[var(--primary)] text-white font-semibold py-3 text-base hover:scale-[1.02] transition-all duration-200 disabled:opacity-60"
            >
              {adjustLoading ? "Adjusting..." : "Adjust my plan"}
            </button>
            <button
              onClick={() => setShowAutoAdjust(false)}
              className="text-sm text-[var(--muted)] underline underline-offset-4 hover:text-[var(--primary)] transition-colors"
            >
              Keep as is
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
