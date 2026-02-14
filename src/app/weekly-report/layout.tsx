import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up — Minute70",
  description:
    "Create your Minute70 account to get a personalized weekly training plan built around your match day.",
};

export default function WeeklyReportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
