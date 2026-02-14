import { NextResponse } from "next/server";
import { verifyJwt } from "@/lib/verify-jwt";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getMovesForFocus } from "@/lib/session-moves";

export async function POST(request: Request) {
  const jwt = await verifyJwt(request);
  if (!jwt.ok) {
    return NextResponse.json({ ok: false, error: jwt.error }, { status: jwt.status });
  }

  let body: { plan_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const planId = body.plan_id ?? "";
  if (!planId) {
    return NextResponse.json({ ok: false, error: "plan_id is required." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Verify plan ownership
  const { data: plan } = await supabase
    .from("plans")
    .select("id, focus, user_id")
    .eq("id", planId)
    .single();

  if (!plan || plan.user_id !== jwt.userId) {
    return NextResponse.json({ ok: false, error: "Plan not found." }, { status: 404 });
  }

  const focus = (plan.focus ?? "late_game") as "late_game" | "injury_prevention";
  const moves = getMovesForFocus(focus);

  // Regenerate moves for remaining scheduled sessions
  const { data: scheduled } = await supabase
    .from("sessions")
    .select("id")
    .eq("plan_id", planId)
    .eq("status", "scheduled");

  if (!scheduled || scheduled.length === 0) {
    return NextResponse.json({ ok: true, sessionsAdjusted: 0 });
  }

  const ids = scheduled.map((s: { id: string }) => s.id);

  const { error } = await supabase
    .from("sessions")
    .update({ moves })
    .in("id", ids);

  if (error) {
    return NextResponse.json({ ok: false, error: "Failed to adjust sessions." }, { status: 500 });
  }

  // Update plan timestamp (non-blocking — log but don't fail)
  const { error: tsError } = await supabase
    .from("plans")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", planId);

  if (tsError) {
    console.error("[auto-adjust] Failed to update plan timestamp:", tsError.message);
  }

  return NextResponse.json({ ok: true, sessionsAdjusted: ids.length });
}
