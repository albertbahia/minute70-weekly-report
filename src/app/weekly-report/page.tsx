"use client";

import { useState, useEffect, FormEvent } from "react";
import { getLateWindow } from "@/lib/late-window";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { logEvent } from "@/lib/log-event";
import type { Session } from "@supabase/supabase-js";

const HALF_LENGTH_OPTIONS = [20, 25, 30, 35, 40, 45] as const;
const DEFAULT_HALF = 25;

interface Move {
  name: string;
  prescription: string;
  notes?: string;
}

interface SessionDetail {
  intensity: "moderate" | "light" | "recovery";
  title: string;
  intent: string;
  durationMin: number;
  warmup: Move[];
  main: Move[];
  cooldown: Move[];
}

interface ReportResponse {
  ok: boolean;
  source: "public" | "teammate";
  followupScheduled: boolean;
  statusLine: string;
  sessions: SessionDetail[];
  matchDayCue: string;
  reason?: string;
  daysRemaining?: number;
  error?: string;
}

const FEEDBACK_CHOICES = [
  "Clear and actionable — I can follow this",
  "Too generic — needs more personalization",
  "Too hard — volume/intensity feels high",
  "Too easy — needs more challenge",
  "Confusing — I'm not sure what to do first",
  "Missing context — didn't match my match day / fatigue",
  "Other",
] as const;

const MATCH_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const LEGS_OPTIONS = ["Fresh", "Medium", "Heavy", "Tweaky"] as const;
const TISSUE_FOCUS_OPTIONS = ["Quads", "Hamstrings", "Calves", "Glutes", "Hip Flexors", "Ankles"] as const;
const RECOVERY_MODE_OPTIONS = ["Walk", "Pool", "Yoga", "Foam Roll", "Contrast Shower", "Full Rest"] as const;
const WEEK_INTENT_OPTIONS = ["Recovery", "Balanced", "Push"] as const;

const LS_KEY = "minute70_recovery_mode";

// --- Recovery mobility data ---
const RECOVERY_FIXED_MOVES = [
  "Hip flexor lunge stretch \u2014 30s/side",
  "Adductor rock-backs \u2014 10 reps/side",
  "Glute bridge hold \u2014 2 \u00d7 25s (rest 15s)",
];

const RECOVERY_ROTATING_POOL = [
  "90/90 hip switches \u2014 8 reps/side",
  "Hamstring scoops \u2014 10 reps/side",
  "Standing quad stretch \u2014 30s/side",
  "Calf raises \u2014 12 reps/side",
  "Ankle rocks \u2014 10 reps/side",
];

function getDailyRotation(): [string, string] {
  const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = ((hash << 5) - hash + dateStr.charCodeAt(i)) | 0;
  }
  hash = Math.abs(hash);
  const pool = [...RECOVERY_ROTATING_POOL];
  const firstIdx = hash % pool.length;
  const pick1 = pool.splice(firstIdx, 1)[0];
  const secondIdx = Math.floor(hash / 5) % pool.length;
  const pick2 = pool[secondIdx];
  return [pick1, pick2];
}

function getRecoveryMoveStrings(): string[] {
  const [r1, r2] = getDailyRotation();
  return [...RECOVERY_FIXED_MOVES, r1, r2];
}

function buildRecoverySession(): SessionDetail {
  const moves = getRecoveryMoveStrings();
  return {
    intensity: "recovery",
    title: "Recovery Session",
    intent: "Promote blood flow and restore range of motion.",
    durationMin: 20,
    warmup: [
      { name: "Easy walk", prescription: "3 min" },
      { name: "Arm circles", prescription: "10 each direction" },
      { name: "Cat-cow", prescription: "8 reps" },
    ],
    main: moves.map((m) => {
      const parts = m.split(" \u2014 ");
      return { name: parts[0], prescription: parts[1] ?? "" };
    }),
    cooldown: [
      { name: "Seated forward fold", prescription: "30s" },
      { name: "Supine twist", prescription: "20s/side" },
      { name: "Deep breathing", prescription: "2 min" },
    ],
  };
}

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

  // Auth state
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  // Step 1
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);

  // Step 2
  const [matchDay, setMatchDay] = useState("");
  const [legsStatus, setLegsStatus] = useState("");
  const [tissueFocus, setTissueFocus] = useState("");
  const [includeSpeedExposure, setIncludeSpeedExposure] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState("Walk");
  const [halfLength, setHalfLength] = useState(DEFAULT_HALF);
  const [teammateCode, setTeammateCode] = useState("");
  const [emailReminder, setEmailReminder] = useState(true);

  // Week intent
  const [requestedMode, setRequestedMode] = useState("");

  // Soreness sliders
  const [sorenessHamstrings, setSorenessHamstrings] = useState(0);
  const [sorenessGroin, setSorenessGroin] = useState(0);
  const [sorenessQuads, setSorenessQuads] = useState(0);
  const [sorenessOtherLabel, setSorenessOtherLabel] = useState("");
  const [sorenessOtherValue, setSorenessOtherValue] = useState(0);
  const [sorenessOtherEnabled, setSorenessOtherEnabled] = useState(false);

  // Override state (computed per generation, not persisted)
  const [actualMode, setActualMode] = useState<string | null>(null);
  const [overrideApplied, setOverrideApplied] = useState(false);

  const lateWindow = getLateWindow(halfLength);

  const [report, setReport] = useState<ReportResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Recovery mode toggle
  const [recoveryActive, setRecoveryActive] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Feedback state
  const [feedbackChoice, setFeedbackChoice] = useState("");
  const [feedbackOther, setFeedbackOther] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackSkipped, setFeedbackSkipped] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState(false);

  const [teammateValidated, setTeammateValidated] = useState(false);

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

  // Persist recovery_mode to localStorage on change
  function handleRecoveryModeChange(value: string) {
    setRecoveryMode(value);
    try {
      localStorage.setItem(LS_KEY, value);
    } catch { /* localStorage unavailable */ }
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
        setSession(data.session);
        setEmail(data.session.user.email ?? trimmed);
        // Fire signup_created event (fire-and-forget)
        logEvent(data.session.access_token, "signup_created");
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmed,
        password,
      });
      if (error) {
        setAuthError(error.message);
        setAuthLoading(false);
        return;
      }
      if (data.session) {
        setSession(data.session);
        setEmail(data.session.user.email ?? trimmed);
      }
    }

    // Redirect to app dashboard after successful auth
    window.location.href = "/app";
    return;

    // Legacy: step 2 flow (kept but unreachable after redirect)
    setStep(2);
    setAuthLoading(false);

    // Fetch recovery preference (non-blocking)
    fetch(`/api/preferences?email=${encodeURIComponent(trimmed)}`)
      .then((r) => r.json())
      .then((data) => { if (data.isRecoveryActive) setRecoveryActive(true); })
      .catch(() => {});
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
          legsStatus,
          tissueFocus,
          includeSpeedExposure,
          recoveryMode,
          halfLengthMinutes: halfLength,
          teammateCode: teammateCode || undefined,
          emailReminder: teammateValidated ? emailReminder : undefined,
          requestedMode: requestedMode.toLowerCase() || undefined,
          soreness: {
            hamstrings: sorenessHamstrings,
            groinAdductors: sorenessGroin,
            quadsCalves: sorenessQuads,
            ...(sorenessOtherEnabled && sorenessOtherLabel.trim()
              ? { other: { label: sorenessOtherLabel.trim(), value: sorenessOtherValue } }
              : {}),
          },
        }),
      });

      const json = await res.json();

      if (json.ok === true) {
        setReport(json);
        setTeammateValidated(json.source === "teammate");

        // Compute soreness override
        const sorenessValues = [sorenessHamstrings, sorenessGroin, sorenessQuads];
        if (sorenessOtherEnabled) sorenessValues.push(sorenessOtherValue);
        const sorenessMax = Math.max(...sorenessValues);
        const mode = requestedMode.toLowerCase();
        const overridden = sorenessMax >= 7 && mode !== "recovery";
        const finalMode = overridden ? "recovery" : mode;

        setActualMode(finalMode);
        setOverrideApplied(overridden);
        if (finalMode === "recovery") setRecoveryActive(true);

        // Fire anonymous events (non-blocking)
        const eventPayload = {
          requestedMode: mode,
          actualMode: finalMode,
          overrideApplied: overridden,
          sorenessMax,
          soreness: {
            hamstrings: sorenessHamstrings,
            groinAdductors: sorenessGroin,
            quadsCalves: sorenessQuads,
            ...(sorenessOtherEnabled ? { other: { label: sorenessOtherLabel, value: sorenessOtherValue } } : {}),
          },
          legsStatus,
          matchDay,
        };
        fetch("/api/events/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventType: "report_generated", payload: eventPayload }),
        }).catch(() => {});
        if (overridden) {
          fetch("/api/events/report", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventType: "mode_overridden", payload: { ...eventPayload, overrideReason: "soreness_max>=7" } }),
          }).catch(() => {});
        }

        // Authenticated event (fire-and-forget)
        if (session?.access_token) {
          logEvent(session.access_token, "weekly_report_generated", {
            mode: finalMode,
            sorenessMax,
            overrideApplied: overridden,
          });
        }
      } else {
        if (json.reason === "limit") {
          setErrorMsg(
            "You've already generated this week's report. Come back next week."
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

  // --- Recovery toggle handler ---
  async function handleRecoveryToggle() {
    setRecoveryLoading(true);
    const enabling = !recoveryActive;
    try {
      const res = await fetch("/api/preferences/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, enabled: enabling }),
      });
      const data = await res.json();
      if (data.ok) {
        setRecoveryActive(enabling);
        showToast(enabling ? "Switched to Recovery mode." : "Recovery mode disabled.");
      }
    } catch {
      showToast("Could not update preference.");
    }
    setRecoveryLoading(false);
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  // --- Feedback submit ---
  async function handleFeedbackSubmit() {
    if (!feedbackChoice || feedbackSubmitted) return;
    setFeedbackLoading(true);
    try {
      const res = await fetch("/api/feedback/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedbackChoice,
          feedbackOther: feedbackChoice === "Other" ? feedbackOther : undefined,
          reportContext: {
            matchDay,
            legsStatus,
            tissueFocus,
            halfLength,
            recoveryActive,
            requestedMode,
            actualMode,
            overrideApplied,
            sorenessMax: Math.max(
              sorenessHamstrings, sorenessGroin, sorenessQuads,
              ...(sorenessOtherEnabled ? [sorenessOtherValue] : []),
            ),
            source: report?.source,
            generatedAt: new Date().toISOString(),
          },
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setFeedbackError(false);
        setFeedbackSubmitted(true);
      } else {
        setFeedbackError(true);
      }
    } catch {
      setFeedbackError(true);
    }
    setFeedbackLoading(false);
  }

  // --- Accordion state ---
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  function toggleSection(key: string) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  // --- Copy to clipboard ---
  function handleCopyPlan() {
    if (!report) return;
    const displaySessions = getDisplaySessions();
    const lines: string[] = [report.statusLine, ""];
    displaySessions.forEach((s) => {
      lines.push(`${s.title} (~${s.durationMin} min)`);
      lines.push(`  Warm-up:`);
      s.warmup.forEach((m) => lines.push(`    - ${m.name} - ${m.prescription}`));
      lines.push(`  Main Work:`);
      s.main.forEach((m) => lines.push(`    - ${m.name} - ${m.prescription}`));
      lines.push(`  Cooldown:`);
      s.cooldown.forEach((m) => lines.push(`    - ${m.name} - ${m.prescription}`));
      lines.push("");
    });
    lines.push(report.matchDayCue);
    navigator.clipboard.writeText(lines.join("\n")).then(
      () => showToast("Copied to clipboard."),
      () => showToast("Could not copy."),
    );
  }

  // --- Build display sessions (apply Recovery swap if active) ---
  function getDisplaySessions(): SessionDetail[] {
    if (!report) return [];
    const sessions = [...report.sessions];
    if (recoveryActive || actualMode === "recovery") {
      const idx = sessions.findIndex((s) => s.intensity === "moderate");
      if (idx >= 0) {
        sessions[idx] = buildRecoverySession();
      }
    }
    return sessions;
  }

  // --- Report view ---
  if (report !== null) {
    const moderateIdx = report.sessions.findIndex((s) => s.intensity === "moderate");
    const displaySessions = getDisplaySessions();

    const INTENSITY_BADGE: Record<string, string> = {
      moderate: "bg-[var(--primary)] text-white",
      light: "bg-[var(--input-bg)] text-[var(--muted)] border border-[var(--border)]",
      recovery: "bg-[var(--accent)] text-white",
    };

    const SECTION_LABELS = ["Warm-up", "Main Work", "Cooldown / Mobility"] as const;
    const SECTION_KEYS = ["warmup", "main", "cooldown"] as const;

    return (
      <>
      <header className="w-full border-b border-[var(--border)]">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-6 py-4">
          <a href="/" className="text-lg font-bold tracking-tight text-[var(--foreground)] hover:text-[var(--primary)] transition-colors">
            Minute70
          </a>
        </div>
      </header>
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-lg space-y-6">
          <h1 className="text-3xl font-bold text-[var(--foreground)] text-center">
            Your Weekly Report
          </h1>

          {report.source === "teammate" && (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-700 text-sm font-medium text-center">
              ELMPARC2 Beta unlocked ✅
            </div>
          )}

          <p className="text-lg font-medium text-[var(--foreground)] text-center">
            {report.statusLine}
          </p>

          {/* Week Mode badge */}
          {actualMode && (
            <div className="flex items-center justify-center">
              <span className={`inline-flex items-center text-sm font-semibold px-3 py-1 rounded-full ${
                actualMode === "recovery"
                  ? "bg-[var(--accent)] text-white"
                  : actualMode === "push"
                    ? "bg-[var(--primary)] text-white"
                    : "bg-[var(--input-bg)] text-[var(--foreground)] border border-[var(--border)]"
              }`}>
                Week Mode: {actualMode.charAt(0).toUpperCase() + actualMode.slice(1)}
                {overrideApplied && " (Auto-adjusted)"}
              </span>
            </div>
          )}

          {/* Override banner */}
          {overrideApplied && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-800 text-sm">
              <p className="font-semibold">Soreness override active</p>
              <p className="mt-1">
                At least one area is rated 7/10 or higher. Your plan has been auto-adjusted to Recovery mode to protect you this week.
              </p>
            </div>
          )}

          {/* Session cards */}
          {displaySessions.map((session, si) => (
            <div
              key={si}
              className="bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-[var(--card-shadow)] overflow-hidden"
            >
              {/* Card header */}
              <div className="p-5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-semibold uppercase tracking-wide px-2.5 py-0.5 rounded-full ${INTENSITY_BADGE[session.intensity] ?? ""}`}
                  >
                    {session.intensity}
                  </span>
                  <span className="text-xs text-[var(--muted)]">~{session.durationMin} min</span>
                </div>
                <h3 className="text-base font-bold text-[var(--foreground)]">{session.title}</h3>
                <p className="text-sm text-[var(--muted)]">{session.intent}</p>
              </div>

              {/* Accordion sections */}
              <div className="border-t border-[var(--border)]">
                {SECTION_LABELS.map((label, secIdx) => {
                  const key = `${si}-${secIdx}`;
                  const isOpen = openSections[key] ?? false;
                  const moves: Move[] = session[SECTION_KEYS[secIdx]];
                  return (
                    <div key={secIdx} className={secIdx > 0 ? "border-t border-[var(--border)]" : ""}>
                      <button
                        onClick={() => toggleSection(key)}
                        className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--input-bg)] transition-colors"
                      >
                        <span>
                          {label}{" "}
                          <span className="font-normal text-[var(--muted)]">({moves.length})</span>
                        </span>
                        <svg
                          className={`h-4 w-4 text-[var(--muted)] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {isOpen && (
                        <ul className="px-5 pb-3 space-y-2">
                          {moves.map((move, mi) => (
                            <li key={mi} className="flex gap-2">
                              <span className="flex-shrink-0 mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
                              <div>
                                <span className="text-sm text-[var(--foreground)]">
                                  {move.name} <span className="font-medium">{move.prescription}</span>
                                </span>
                                {move.notes && (
                                  <p className="text-xs text-[var(--muted)] italic">{move.notes}</p>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Recovery toggle — only when a moderate session exists and not override-forced */}
          {moderateIdx >= 0 && !overrideApplied && (
            <button
              onClick={handleRecoveryToggle}
              disabled={recoveryLoading}
              className="block mx-auto text-sm text-[var(--muted)] hover:text-[var(--primary)] transition-colors underline underline-offset-4 disabled:opacity-50"
            >
              {recoveryLoading
                ? "Updating..."
                : recoveryActive
                  ? "Disable Recovery mode"
                  : "Switch to Recovery mode"}
            </button>
          )}

          {/* Match day cue */}
          <div className="rounded-xl bg-[var(--input-bg)] border border-[var(--border)] border-l-4 border-l-[var(--primary)] px-4 py-3">
            <p className="text-sm text-[var(--foreground)]">
              {report.matchDayCue}
            </p>
          </div>

          {/* Feedback card */}
          {!feedbackSkipped && !feedbackSubmitted && (
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-[var(--card-shadow)] p-5 space-y-3">
              <div>
                <h3 className="text-sm font-bold text-[var(--foreground)]">
                  Quick feedback (10 seconds)
                </h3>
                <p className="text-xs text-[var(--muted)] mt-1">
                  Anonymous — we don&apos;t collect your email or identity. This helps improve Minute70.
                </p>
              </div>

              <div>
                <label htmlFor="feedbackChoice" className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                  What best describes this week&apos;s report?
                </label>
                <div className="relative">
                  <select
                    id="feedbackChoice"
                    value={feedbackChoice}
                    onChange={(e) => { setFeedbackChoice(e.target.value); setFeedbackError(false); }}
                    className={`${selectClass} ${!feedbackChoice ? "text-[var(--muted)]" : ""}`}
                  >
                    <option value="" disabled>Select an option</option>
                    {FEEDBACK_CHOICES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <svg className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {feedbackChoice === "Other" && (
                <div>
                  <input
                    type="text"
                    value={feedbackOther}
                    onChange={(e) => setFeedbackOther(e.target.value)}
                    maxLength={240}
                    placeholder="Type your feedback…"
                    className={inputClass}
                  />
                  <p className="mt-1 text-xs text-[var(--muted)] text-right">{feedbackOther.length}/240</p>
                </div>
              )}

              {feedbackError && (
                <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-red-700 text-sm">
                  Could not save feedback. Try again.
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setFeedbackSkipped(true)}
                  className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  Skip
                </button>
                <button
                  type="button"
                  onClick={handleFeedbackSubmit}
                  disabled={!feedbackChoice || feedbackLoading}
                  className="rounded-xl bg-[var(--primary)] text-white text-sm font-semibold px-5 py-2 hover:brightness-110 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {feedbackLoading ? "Saving..." : "Submit"}
                </button>
              </div>
            </div>
          )}

          {feedbackSubmitted && (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-700 text-sm font-medium text-center">
              Thanks — feedback saved.
            </div>
          )}

          {/* Copy plan */}
          <button
            onClick={handleCopyPlan}
            className="flex items-center gap-2 mx-auto text-sm text-[var(--muted)] hover:text-[var(--primary)] transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="9" y="9" width="13" height="13" rx="2" strokeWidth={2} />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeWidth={2} />
            </svg>
            Copy plan
          </button>

          <a
            href="/waitlist"
            className="block w-full rounded-2xl bg-[var(--primary)] text-white font-semibold py-4 text-lg text-center hover:scale-[1.02] hover:shadow-[0_6px_20px_-2px_rgba(26,122,107,0.4)] transition-all duration-200 shadow-[0_4px_14px_-2px_rgba(26,122,107,0.3)]"
          >
            Join the waitlist
          </a>

          <button
            onClick={() => { setReport(null); setActualMode(null); setOverrideApplied(false); setRecoveryActive(false); setTeammateValidated(false); }}
            className="block mx-auto text-sm text-[var(--muted)] hover:text-[var(--primary)] transition-colors underline underline-offset-4"
          >
            Generate another report
          </button>

          <a
            href="/"
            className="block mx-auto text-sm text-[var(--muted)] hover:text-[var(--primary)] transition-colors underline underline-offset-4"
          >
            Back to home
          </a>
        </div>

        {/* Toast */}
        {toast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-3 text-emerald-700 text-sm font-medium shadow-[var(--card-shadow)] z-50">
            {toast}
          </div>
        )}
      </main>
      </>
    );
  }

  // --- Step 1: Email gate ---
  if (step === 1) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <h1 className="text-3xl font-bold text-[var(--foreground)] text-center mb-2">
            Minute70 Weekly Report
          </h1>
          <p className="text-sm text-[var(--muted)] text-center mb-10">
            30 seconds → your week plan for strong legs in the final {getLateWindow(DEFAULT_HALF)} minutes.
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

          {/* League Half Length */}
          <div>
            <label htmlFor="halfLength" className="block text-sm font-semibold text-[var(--foreground)] mb-2">
              League half length (minutes) <span className="text-[var(--destructive)]">*</span>
            </label>
            <div className="relative">
              <select
                id="halfLength"
                required
                value={halfLength}
                onChange={(e) => setHalfLength(Number(e.target.value))}
                className={selectClass}
              >
                {HALF_LENGTH_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            <p className="mt-1.5 text-xs text-[var(--muted)]">
              Late window = last {lateWindow} minutes
            </p>
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

          {/* Week Intent */}
          <div>
            <label className="block text-sm font-semibold text-[var(--foreground)] mb-3">
              This Week&apos;s Goal <span className="text-[var(--destructive)]">*</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              {WEEK_INTENT_OPTIONS.map((option) => (
                <label
                  key={option}
                  className="flex items-center gap-3 cursor-pointer select-none"
                >
                  <span
                    className={`flex-shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      requestedMode === option
                        ? "border-[var(--primary)] bg-[var(--primary)]"
                        : "border-[var(--border)]"
                    }`}
                  >
                    {requestedMode === option && (
                      <span className="h-2 w-2 rounded-full bg-white" />
                    )}
                  </span>
                  <input
                    type="radio"
                    name="requestedMode"
                    value={option}
                    checked={requestedMode === option}
                    onChange={(e) => setRequestedMode(e.target.value)}
                    required
                    className="sr-only"
                  />
                  <span className="text-base text-[var(--foreground)]">{option}</span>
                </label>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-[var(--muted)]">
              Recovery = low intensity only. Balanced = mix. Push = higher volume.
            </p>
          </div>

          {/* Soreness */}
          <div>
            <label className="block text-sm font-semibold text-[var(--foreground)] mb-1">
              Soreness (0–10) <span className="text-[var(--destructive)]">*</span>
            </label>
            <p className="text-xs text-[var(--muted)] mb-4">
              0 = fresh, 10 = can&apos;t push
            </p>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-[var(--foreground)]">Hamstrings</span>
                  <span className="text-sm font-medium text-[var(--foreground)] tabular-nums">{sorenessHamstrings}/10</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={sorenessHamstrings}
                  onChange={(e) => setSorenessHamstrings(Number(e.target.value))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer accent-[var(--primary)] bg-[var(--border)]"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-[var(--foreground)]">Groin / Adductors</span>
                  <span className="text-sm font-medium text-[var(--foreground)] tabular-nums">{sorenessGroin}/10</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={sorenessGroin}
                  onChange={(e) => setSorenessGroin(Number(e.target.value))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer accent-[var(--primary)] bg-[var(--border)]"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-[var(--foreground)]">Quads / Calves</span>
                  <span className="text-sm font-medium text-[var(--foreground)] tabular-nums">{sorenessQuads}/10</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={sorenessQuads}
                  onChange={(e) => setSorenessQuads(Number(e.target.value))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer accent-[var(--primary)] bg-[var(--border)]"
                />
              </div>
              <div className="border-t border-[var(--border)] pt-3">
                <label className="flex items-center gap-3 cursor-pointer select-none mb-3">
                  <input
                    type="checkbox"
                    checked={sorenessOtherEnabled}
                    onChange={(e) => setSorenessOtherEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-[var(--border)] text-[var(--primary)] accent-[var(--primary)]"
                  />
                  <span className="text-sm text-[var(--foreground)]">
                    Add another area <span className="text-[var(--muted)] font-normal">(optional)</span>
                  </span>
                </label>
                {sorenessOtherEnabled && (
                  <div className="space-y-3 pl-7">
                    <input
                      type="text"
                      value={sorenessOtherLabel}
                      onChange={(e) => setSorenessOtherLabel(e.target.value)}
                      placeholder="e.g. Lower back, Ankle"
                      maxLength={40}
                      className={inputClass}
                    />
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm text-[var(--foreground)]">{sorenessOtherLabel || "Other"}</span>
                        <span className="text-sm font-medium text-[var(--foreground)] tabular-nums">{sorenessOtherValue}/10</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={10}
                        step={1}
                        value={sorenessOtherValue}
                        onChange={(e) => setSorenessOtherValue(Number(e.target.value))}
                        className="w-full h-2 rounded-full appearance-none cursor-pointer accent-[var(--primary)] bg-[var(--border)]"
                      />
                    </div>
                  </div>
                )}
              </div>
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
              placeholder="Enter code here"
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
