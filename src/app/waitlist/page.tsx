"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function WaitlistPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const trimmed = email.trim();
    if (!trimmed) {
      setError("Email is required.");
      setLoading(false);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setError("Please enter a valid email.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });

      const json = await res.json();

      if (json.ok) {
        setToast(true);
        setTimeout(() => {
          router.push(
            `/waitlist/confirmed?status=${json.status}&email=${encodeURIComponent(trimmed)}`,
          );
        }, 1000);
      } else {
        setError(json.error ?? "Something went wrong.");
        setLoading(false);
      }
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)]">
            Join the waitlist
          </h1>
          <p className="text-sm text-[var(--muted)]">
            Get notified when Minute70 fully releases.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="waitlist-email"
              className="block text-sm font-semibold text-[var(--foreground)] mb-2"
            >
              Email
            </label>
            <input
              id="waitlist-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3.5 text-base text-[var(--foreground)] placeholder-[var(--muted)] border-l-4 border-l-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] transition-all duration-200"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-[var(--primary)] text-white font-semibold py-4 text-lg hover:scale-[1.02] hover:shadow-[0_6px_20px_-2px_rgba(26,122,107,0.4)] transition-all duration-200 shadow-[0_4px_14px_-2px_rgba(26,122,107,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Joining..." : "Join the waitlist"}
          </button>
        </form>

        <p className="text-center">
          <Link
            href="/"
            className="text-sm text-[var(--muted)] underline underline-offset-4 hover:text-[var(--primary)] transition-colors"
          >
            Back to home
          </Link>
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-3 text-emerald-700 text-sm font-medium shadow-[var(--card-shadow)]">
          You&apos;re on the waitlist ✅
        </div>
      )}
    </main>
  );
}
