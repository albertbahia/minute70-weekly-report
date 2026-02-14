import { NextResponse } from "next/server";
import { verifyJwt } from "@/lib/verify-jwt";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  const jwt = await verifyJwt(request);
  if (!jwt.ok) {
    return NextResponse.json({ ok: false, error: jwt.error }, { status: jwt.status });
  }

  let body: { enabled?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const enabled = body.enabled === true;

  const supabase = getSupabaseAdmin();

  // Get email from authenticated user
  const { data: user } = await supabase.auth.admin.getUserById(jwt.userId);
  const email = user?.user?.email?.toLowerCase();
  if (!email) {
    return NextResponse.json({ ok: false, error: "User not found." }, { status: 404 });
  }

  // Only update if the email exists in waitlist_signups — never auto-create
  const { data: existing } = await supabase
    .from("waitlist_signups")
    .select("id")
    .eq("email", email)
    .limit(1)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ ok: false, error: "No signup found." }, { status: 404 });
  }

  const prefValue = enabled
    ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const { error: updateError } = await supabase
    .from("waitlist_signups")
    .update({ pref_recovery_until: prefValue })
    .eq("email", email);

  if (updateError) {
    return NextResponse.json({ ok: false, error: "Failed to save preference." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, isRecoveryActive: enabled });
}
