import { getLateWindow } from "@/lib/late-window";
import OnboardingHero from "./_components/OnboardingHero";

const DEFAULT_HALF = 25;
const DEFAULT_LATE = getLateWindow(DEFAULT_HALF);

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
    a: `Yes \u2014 you get 1 free session per week. If you want unlimited sessions, upgrade to a paid plan.`,
  },
  {
    q: "Who is this for?",
    a: `Adult recreational soccer players who want to feel strong in the last ${DEFAULT_LATE} minutes of a match\u2014without a full-time coach.`,
  },
];

export default function Home() {
  return (
    <div className="relative">
      {/* Transparent header — overlays the dark hero */}
      <header className="absolute top-0 left-0 right-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-6 py-5">
          <a href="/" className="text-lg font-bold tracking-tight text-[var(--on-dark)]">
            Minute70
          </a>
          <a
            href="#onboarding"
            className="text-sm font-medium text-[var(--on-dark-muted)] hover:text-[var(--on-dark)] transition-colors"
          >
            Sign in
          </a>
        </div>
      </header>

      <main className="flex flex-col items-center">
        {/* Questionnaire + preview + auth — dark hero */}
        <OnboardingHero />

        {/* Social proof strip */}
        <div className="w-full bg-[var(--hero-bg)]">
          <div className="max-w-3xl mx-auto px-6 py-4 flex flex-wrap justify-center gap-x-8 gap-y-2">
            {["3 questions", "8-min sessions", "Free first session"].map((stat) => (
              <span
                key={stat}
                className="text-xs font-semibold uppercase tracking-widest text-[var(--on-dark-muted)]"
              >
                {stat}
              </span>
            ))}
          </div>
        </div>

        {/* How it works */}
        <div className="w-full bg-[var(--card)] border-t border-[var(--border)]">
          <section className="max-w-2xl mx-auto py-16 px-6">
            <h2 className="text-3xl font-black tracking-tight text-[var(--foreground)] text-center mb-10">
              How it works
            </h2>
            <div className="grid sm:grid-cols-3 gap-8 text-center">
              {[
                {
                  step: "1",
                  title: "Answer 3 questions",
                  desc: "Your concern, match day, and how your legs feel this week.",
                },
                {
                  step: "2",
                  title: "See your plan",
                  desc: "A personalized session built around your match day and recovery needs.",
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

        {/* FAQ */}
        <div className="w-full bg-[var(--card)] border-t border-[var(--border)]">
          <section className="max-w-2xl mx-auto py-16 px-6">
            <h2 className="text-3xl font-black tracking-tight text-[var(--foreground)] text-center mb-10">
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
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-[var(--border)] mt-8">
        <div className="max-w-3xl mx-auto px-6 py-6 text-center">
          <p className="text-xs text-[var(--muted)]">
            No spam. Just your weekly plan.
          </p>
        </div>
      </footer>
    </div>
  );
}
