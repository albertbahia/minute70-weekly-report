import { NextResponse } from "next/server";
import { verifyJwt } from "@/lib/verify-jwt";
import { getSupabaseAdmin } from "@/lib/supabase";
import { canStartSession } from "@/lib/entitlements";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const jwt = await verifyJwt(request);
  if (!jwt.ok) {
    return NextResponse.json({ ok: false, error: jwt.error }, { status: jwt.status });
  }

  const { id: sessionId } = await params;
  const supabase = getSupabaseAdmin();

  // Verify session belongs to this user (sessions → plans → user_id)
  const { data: session } = await supabase
    .from("sessions")
    .select("id, plan_id, status, moves, duration_minutes, plans!inner(user_id)")
    .eq("id", sessionId)
    .single();

  if (!session) {
    return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const planOwner = (session as any).plans?.user_id;
  if (planOwner !== jwt.userId) {
    return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 });
  }

  if (session.status !== "scheduled") {
    return NextResponse.json(
      { ok: false, error: `Session is already ${session.status}.` },
      { status: 400 },
    );
  }

  // Entitlement check
  const entCheck = await canStartSession(jwt.userId);
  if (!entCheck.allowed) {
    return NextResponse.json(
      { ok: false, reason: entCheck.reason, paywallRequired: true },
      { status: 403 },
    );
  }

  // Log start event
  await supabase.from("session_events").insert({
    session_id: sessionId,
    event_type: "started",
  });

  return NextResponse.json({
    ok: true,
    session: {
      id: session.id,
      moves: session.moves,
      duration_minutes: session.duration_minutes,
    },
  });
}
