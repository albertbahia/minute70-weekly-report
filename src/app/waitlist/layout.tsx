import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Waitlist — Minute70",
  description:
    "Join the Minute70 waitlist to be notified when the full platform launches.",
};

export default function WaitlistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
