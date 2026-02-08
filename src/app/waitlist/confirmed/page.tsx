import Link from "next/link";
import { maskEmail } from "@/lib/mask-email";

interface Props {
  searchParams: Promise<{ status?: string; email?: string }>;
}

export default async function WaitlistConfirmedPage({ searchParams }: Props) {
  const { status, email } = await searchParams;
  const isExists = status === "exists";
  const masked = email ? maskEmail(email) : "";

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center space-y-6">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)]">
          {isExists
            ? "You\u2019re already on the waitlist \u2705"
            : "You\u2019re on the waitlist \u2705"}
        </h1>

        {masked && (
          <p className="text-sm text-[var(--muted)]">{masked}</p>
        )}

        <Link
          href="/"
          className="inline-block rounded-2xl bg-[var(--primary)] text-white font-semibold px-8 py-4 text-lg hover:scale-[1.02] hover:shadow-[0_6px_20px_-2px_rgba(26,122,107,0.4)] transition-all duration-200 shadow-[0_4px_14px_-2px_rgba(26,122,107,0.3)]"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
