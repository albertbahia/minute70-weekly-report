import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email")?.trim().toLowerCase();

  if (!email) {
    return NextResponse.json(
      { ok: false, error: "Email is required." },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("waitlist_signups")
    .select("pref_recovery_until")
    .eq("email", email)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Preferences lookup failed:", error);
    return NextResponse.json(
      { ok: false, error: "Server error." },
      { status: 500 },
    );
  }

  const prefRecoveryUntil: string | null = data?.pref_recovery_until ?? null;
  const isRecoveryActive =
    prefRecoveryUntil !== null && new Date(prefRecoveryUntil) > new Date();

  return NextResponse.json({ ok: true, prefRecoveryUntil, isRecoveryActive });
}
