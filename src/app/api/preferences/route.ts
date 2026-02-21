import { NextResponse } from "next/server";
import { verifyJwt } from "@/lib/verify-jwt";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET(request: Request) {
  const jwt = await verifyJwt(request);
  if (!jwt.ok) {
    return NextResponse.json({ ok: false, error: jwt.error }, { status: jwt.status });
  }

  const supabase = getSupabaseAdmin();

  // Look up by user_id via auth.users email join
  const { data: user } = await supabase.auth.admin.getUserById(jwt.userId);
  const email = user?.user?.email?.toLowerCase();
  if (!email) {
    return NextResponse.json({ ok: true, isRecoveryActive: false });
  }

  const { data, error } = await supabase
    .from("waitlist_signups")
    .select("pref_recovery_until")
    .eq("email", email)
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: "Server error." }, { status: 500 });
  }

  const prefRecoveryUntil: string | null = data?.pref_recovery_until ?? null;
  const isRecoveryActive =
    prefRecoveryUntil !== null && new Date(prefRecoveryUntil) > new Date();

  return NextResponse.json({ ok: true, isRecoveryActive });
}
