import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center px-6 py-16 sm:py-24">
      {/* Hero */}
      <section className="w-full max-w-lg text-center space-y-6">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-[var(--foreground)]">
          Minute70
        </h1>
        <p className="text-lg text-[var(--muted)] leading-relaxed">
          A 30-second weekly plan to help you finish strong in the final
          20&nbsp;minutes.
        </p>

        <Link
          href="/weekly-report"
          className="inline-block w-full sm:w-auto rounded-2xl bg-[var(--primary)] text-white font-semibold px-8 py-4 text-lg hover:brightness-110 transition-all duration-200 shadow-[0_4px_14px_-2px_rgba(26,122,107,0.3)]"
        >
          Get this week&apos;s report
        </Link>

        <p className="text-sm text-[var(--muted)]">
          One report per week.
        </p>
      </section>

      {/* Trust + clarity */}
      <section className="w-full max-w-lg mt-16 space-y-3">
        <ul className="space-y-2.5 text-base text-[var(--foreground)]">
          <li className="flex gap-3">
            <span className="flex-shrink-0 mt-1.5 h-2 w-2 rounded-full bg-[var(--primary)]" />
            Built for adult rec soccer players.
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 mt-1.5 h-2 w-2 rounded-full bg-[var(--primary)]" />
            Personalized to your match day, legs status, and choices.
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 mt-1.5 h-2 w-2 rounded-full bg-[var(--primary)]" />
            Takes ~30 seconds.
          </li>
        </ul>
      </section>

      {/* Example card */}
      <section className="w-full max-w-lg mt-16">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 space-y-4 shadow-[var(--card-shadow)]">
          <h3 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">
            Example (what you&apos;ll get)
          </h3>

          <p className="text-sm font-medium text-[var(--foreground)]">
            4 days before your match: Stamina Builder (45 min)
          </p>

          <ul className="space-y-1.5 text-sm text-[var(--foreground)]">
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

          <p className="text-xs text-[var(--muted)] italic">
            Plans adapt to your match day, legs status, and choices.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full max-w-lg mt-20 pt-6 border-t border-[var(--border)]">
        <p className="text-xs text-[var(--muted)] text-center">
          No spam. Just your weekly plan.
        </p>
      </footer>
    </main>
  );
}
