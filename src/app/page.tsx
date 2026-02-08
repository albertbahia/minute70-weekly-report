import Link from "next/link";

const FAQ = [
  {
    q: "What is Minute70?",
    a: "A free weekly microcycle planner for adult rec soccer players. Answer a few questions, get a session plan tailored to your match day.",
  },
  {
    q: "How long does it take?",
    a: "About 30 seconds to fill out. Your plan is generated instantly.",
  },
  {
    q: "What do I need to know beforehand?",
    a: "Just your match day, how your legs feel, and how many sessions you train per week. That\u2019s it.",
  },
  {
    q: "Is it really free?",
    a: "Yes \u2014 you get 1 Weekly Report per week for free. If something changes mid-week (extra match, soreness, schedule shift), you can unlock additional reports in the same week for a small per-report fee. We\u2019ll also offer a membership option later for players who want more frequent updates.",
  },
  {
    q: "Who is this for?",
    a: "Adult recreational soccer players who want to feel strong in the last 20 minutes of a match\u2014without a full-time coach.",
  },
];

export default function Home() {
  return (
    <>
      {/* Header */}
      <header className="w-full border-b border-[var(--border)]">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-bold tracking-tight text-[var(--foreground)]">
            Minute70
          </Link>
          <Link
            href="/weekly-report"
            className="text-sm font-medium text-[var(--primary)] hover:brightness-110 transition-colors"
          >
            Get your report
          </Link>
        </div>
      </header>

      <main className="flex flex-col items-center">
        {/* Hero */}
        <section className="w-full max-w-2xl text-center pt-20 sm:pt-28 pb-16 px-6 space-y-6">
          <p className="text-sm font-semibold uppercase tracking-widest text-[var(--accent)]">
            Late-Game Legs, Engineered
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-[var(--foreground)] leading-[1.1]">
            Finish strong in the final&nbsp;20&nbsp;minutes
          </h1>
          <p className="text-lg font-light text-[var(--muted)] leading-relaxed max-w-lg mx-auto">
            A free weekly plan built around your match day. Answer a few
            questions, get a personalized session in&nbsp;seconds.
          </p>
          <div className="pt-2">
            <Link
              href="/weekly-report"
              className="inline-block w-full sm:w-auto rounded-2xl bg-[var(--primary)] text-white font-semibold px-10 py-4 text-lg hover:scale-[1.02] hover:shadow-[0_6px_20px_-2px_rgba(26,122,107,0.4)] transition-all duration-200 shadow-[0_4px_14px_-2px_rgba(26,122,107,0.3)]"
            >
              Get Your Weekly Report
            </Link>
          </div>
          <p className="text-sm font-light text-[var(--muted)]">
            Free &middot; No account needed &middot; 30 seconds
          </p>
        </section>

        {/* How it works */}
        <div className="w-full bg-[var(--card)] border-t border-[var(--border)]">
          <section className="max-w-2xl mx-auto py-16 px-6">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--foreground)] text-center mb-10">
              How it works
            </h2>
            <div className="grid sm:grid-cols-3 gap-8 text-center">
              {[
                {
                  step: "1",
                  title: "Answer 5 questions",
                  desc: "Match day, legs status, weekly load, tissue focus, and recovery preference.",
                },
                {
                  step: "2",
                  title: "Get your plan",
                  desc: "A personalized session with warm-up, intervals, optional speed work, and cooldown.",
                },
                {
                  step: "3",
                  title: "Finish strong",
                  desc: "Train with purpose so your legs hold up when the game is on the line.",
                },
              ].map((item) => (
                <div key={item.step} className="space-y-3">
                  <span className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-[var(--primary)] text-white font-bold text-sm shadow-[0_2px_8px_-2px_rgba(26,122,107,0.4)]">
                    {item.step}
                  </span>
                  <h3 className="text-base font-semibold text-[var(--foreground)]">
                    {item.title}
                  </h3>
                  <p className="text-sm font-light text-[var(--muted)] leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Example card */}
        <section className="w-full max-w-2xl py-16 px-6 border-t border-[var(--border)]">
          <h2 className="text-2xl font-bold tracking-tight text-[var(--foreground)] text-center mb-10">
            What you&apos;ll get
          </h2>
          <div className="max-w-lg mx-auto rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-5 shadow-[var(--card-shadow-lg)]">
            <h3 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">
              Example session
            </h3>
            <p className="text-base font-medium text-[var(--foreground)]">
              4 days before your match: Stamina Builder (45&nbsp;min)
            </p>
            <ul className="space-y-2 text-sm text-[var(--foreground)]">
              <li className="flex gap-2.5">
                <span className="flex-shrink-0 mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
                Warm-up: 8 min easy jog + mobility
              </li>
              <li className="flex gap-2.5">
                <span className="flex-shrink-0 mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
                Intervals: 6&times;2 min @ RPE 7 (1 min easy between)
              </li>
              <li className="flex gap-2.5">
                <span className="flex-shrink-0 mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
                Optional speed (toggle): 6&times;10s strides (80&ndash;90%) walk-back recovery
              </li>
              <li className="flex gap-2.5">
                <span className="flex-shrink-0 mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
                Cooldown: 5&ndash;8 min
              </li>
            </ul>
            <p className="text-xs text-[var(--muted)] italic">
              Plans adapt to your match day, legs status, and choices.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <div className="w-full bg-[var(--card)] border-t border-[var(--border)]">
          <section className="max-w-2xl mx-auto py-16 px-6">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--foreground)] text-center mb-10">
              Questions
            </h2>
            <div className="max-w-lg mx-auto space-y-6">
              {FAQ.map((item) => (
                <div key={item.q}>
                  <h3 className="text-sm font-semibold text-[var(--foreground)]">
                    {item.q}
                  </h3>
                  <p className="mt-1 text-sm font-light text-[var(--muted)] leading-relaxed">
                    {item.a}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Bottom CTA */}
        <section className="w-full max-w-2xl py-16 px-6 border-t border-[var(--border)] text-center space-y-4">
          <h2 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
            Ready to finish strong?
          </h2>
          <Link
            href="/weekly-report"
            className="inline-block w-full sm:w-auto rounded-2xl bg-[var(--primary)] text-white font-semibold px-10 py-4 text-lg hover:scale-[1.02] hover:shadow-[0_6px_20px_-2px_rgba(26,122,107,0.4)] transition-all duration-200 shadow-[0_4px_14px_-2px_rgba(26,122,107,0.3)]"
          >
            Get Your Weekly Report
          </Link>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-[var(--border)] mt-8">
        <div className="max-w-3xl mx-auto px-6 py-6 text-center">
          <p className="text-xs text-[var(--muted)]">
            No spam. Just your weekly plan.
          </p>
        </div>
      </footer>
    </>
  );
}
