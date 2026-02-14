import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard — Minute70",
  description:
    "Your weekly training dashboard. Track sessions, manage your plan, and stay on track.",
};

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
