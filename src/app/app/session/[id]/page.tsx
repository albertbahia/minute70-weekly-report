"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { logEvent } from "@/lib/log-event";
import type { Session } from "@supabase/supabase-js";
import type { SessionMove } from "@/lib/session-moves";

const CAPTAIN_QUOTES = [
  "Consistency beats intensity. You showed up — that matters.",
  "The final minutes belong to those who prepare. You're preparing.",
  "Every session adds a layer of resilience your legs will thank you for.",
];

export default function SessionPlayerPage({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>;
}) {
  const [sessionId, setSessionId] = useState<string>("");
  const [authSession, setAuthSession] = useState<Session | null>(null);
  const [phase, setPhase] = useState<"loading" | "playing" | "done">("loading");
  const [moves, setMoves] = useState<SessionMove[]>([]);
  const [durationMin, setDurationMin] = useState(8);
  const [timeLeft, setTimeLeft] = useState(8 * 60);
  const [checkedMoves, setCheckedMoves] = useState<Set<string>>(new Set());
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startTimeRef = useRef<number>(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const token = authSession?.access_token ?? "";

  // Resolve params
  useEffect(() => {
    paramsPromise.then((p) => setSessionId(p.id));
  }, [paramsPromise]);

  // Auth
  useEffect(() => {
    const supabase = getSupabaseBrowser();
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!s) {
        window.location.href = "/weekly-report";
        return;
      }
      setAuthSession(s);
    });
  }, []);

  // Fetch session data
  const fetchSession = useCallback(async () => {
    if (!token || !sessionId) return;
    const res = await fetch(`/api/plan`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (!json.ok) {
      window.location.href = "/app";
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sess = json.sessions?.find((s: any) => s.id === sessionId);
    if (!sess || sess.status !== "scheduled") {
      window.location.href = "/app";
      return;
    }

    setMoves(sess.moves ?? []);
    setDurationMin(sess.duration_minutes ?? 8);
    setTimeLeft((sess.duration_minutes ?? 8) * 60);
    startTimeRef.current = Date.now();
    setPhase("playing");
  }, [token, sessionId]);

  useEffect(() => {
    if (token && sessionId) fetchSession();
  }, [token, sessionId, fetchSession]);

  // Timer
  useEffect(() => {
    if (phase !== "playing") return;

    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [phase]);

  function toggleMove(name: string) {
    setCheckedMoves((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async function handleComplete() {
    if (completing) return;
    setCompleting(true);
    setCompleteError(null);

    if (intervalRef.current) clearInterval(intervalRef.current);

    const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);

    try {
      const res = await fetch(`/api/sessions/${sessionId}/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ completed_moves: Array.from(checkedMoves) }),
      });

      const json = await res.json();
      if (json.ok) {
        logEvent(token, "session_completed", {
          session_id: sessionId,
          completed_moves_count: checkedMoves.size,
          duration_seconds_elapsed: elapsed,
        });
        setElapsedSeconds(elapsed);
        setPhase("done");
      } else {
        setCompleteError(json.error ?? "Could not complete session. Try again.");
      }
    } catch {
      setCompleteError("Network error. Check your connection and try again.");
    }

    setCompleting(false);
  }

  // Captain quote — deterministic from sessionId
  const quoteIndex = sessionId
    ? sessionId.charCodeAt(0) % CAPTAIN_QUOTES.length
    : 0;

  const mm = Math.floor(timeLeft / 60)
    .toString()
    .padStart(2, "0");
  const ss = (timeLeft % 60).toString().padStart(2, "0");

  // --- Loading ---
  if (phase === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--muted)]">Loading session...</p>
      </main>
    );
  }

  // --- Completion screen ---
  if (phase === "done") {
    return (
      <>
        <header className="w-full border-b border-[var(--border)]">
          <div className="max-w-3xl mx-auto flex items-center px-6 py-4">
            <a
              href="/app"
              className="text-lg font-bold tracking-tight text-[var(--foreground)] hover:text-[var(--primary)] transition-colors"
            >
              Minute70
            </a>
          </div>
        </header>

        <main className="min-h-screen flex items-center justify-center p-6">
          <div className="w-full max-w-md text-center space-y-8">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
              <svg
                className="h-8 w-8 text-emerald-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
              Session complete.
            </h1>

            <blockquote className="italic text-[var(--muted)] text-sm border-l-4 border-[var(--primary)] pl-4 text-left">
              &ldquo;{CAPTAIN_QUOTES[quoteIndex]}&rdquo;
            </blockquote>

            <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-700 text-sm font-medium">
              {checkedMoves.size} of {moves.length} moves completed in{" "}
              {elapsedSeconds >= 60
                ? `${Math.floor(elapsedSeconds / 60)} min ${elapsedSeconds % 60}s`
                : `${elapsedSeconds}s`}.
            </div>

            <div className="space-y-3">
              <a
                href="/app?autoAdjust=1"
                className="block w-full rounded-2xl bg-[var(--primary)] text-white font-semibold py-3 text-base text-center hover:scale-[1.02] hover:shadow-[0_6px_20px_-2px_rgba(26,122,107,0.4)] transition-all duration-200 shadow-[0_4px_14px_-2px_rgba(26,122,107,0.3)]"
              >
                Adjust my plan
              </a>
              <a
                href="/app"
                className="block text-sm text-[var(--muted)] underline underline-offset-4 hover:text-[var(--primary)] transition-colors"
              >
                Back to dashboard
              </a>
            </div>
          </div>
        </main>
      </>
    );
  }

  // --- Playing ---
  return (
    <>
      <header className="w-full border-b border-[var(--border)]">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-6 py-4">
          <a
            href="/app"
            className="text-lg font-bold tracking-tight text-[var(--foreground)] hover:text-[var(--primary)] transition-colors"
          >
            Minute70
          </a>
          <span className="text-sm text-[var(--muted)]">~{durationMin} min session</span>
        </div>
      </header>

      <main className="min-h-screen flex items-start justify-center p-6 pt-10">
        <div className="w-full max-w-md space-y-8">
          {/* Timer */}
          <div className="text-center space-y-1">
            <p
              className="text-5xl font-bold tracking-tight tabular-nums"
              style={{ fontFamily: "var(--font-heading), system-ui, sans-serif" }}
            >
              {mm}:{ss}
            </p>
            <p className="text-sm text-[var(--muted)]">
              {timeLeft > 0 ? "remaining" : "time's up — finish when ready"}
            </p>
          </div>

          {/* Move checklist */}
          <div className="space-y-3">
            {moves.map((move) => (
              <label
                key={move.name}
                className="flex gap-3 items-start cursor-pointer bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 hover:border-[var(--primary)]/50 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={checkedMoves.has(move.name)}
                  onChange={() => toggleMove(move.name)}
                  className="mt-0.5 h-5 w-5 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]/30"
                />
                <div className="flex-1">
                  <p
                    className={`text-sm font-medium ${
                      checkedMoves.has(move.name)
                        ? "text-[var(--muted)] line-through"
                        : "text-[var(--foreground)]"
                    }`}
                  >
                    {move.name}
                  </p>
                  <p className="text-xs text-[var(--muted)]">{move.prescription}</p>
                  {move.notes && (
                    <p className="text-xs text-[var(--muted)] italic mt-0.5">
                      {move.notes}
                    </p>
                  )}
                </div>
              </label>
            ))}
          </div>

          {/* Complete button */}
          {completeError && (
            <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-red-700 text-sm">
              {completeError}
            </div>
          )}
          <button
            onClick={handleComplete}
            disabled={completing}
            className="w-full rounded-2xl bg-[var(--primary)] text-white font-semibold py-4 text-lg hover:scale-[1.02] hover:shadow-[0_6px_20px_-2px_rgba(26,122,107,0.4)] transition-all duration-200 shadow-[0_4px_14px_-2px_rgba(26,122,107,0.3)] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {completing ? "Completing..." : "Complete Session"}
          </button>

          <a
            href="/app"
            className="block text-center text-sm text-[var(--muted)] underline underline-offset-4 hover:text-[var(--primary)] transition-colors"
          >
            Cancel and return to dashboard
          </a>
        </div>
      </main>
    </>
  );
}
