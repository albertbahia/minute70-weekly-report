import { NextResponse } from "next/server";
import { verifyJwt } from "@/lib/verify-jwt";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const jwt = await verifyJwt(request);
  if (!jwt.ok) {
    return NextResponse.json({ ok: false, error: jwt.error }, { status: jwt.status });
  }

  let body: { completed_moves?: string[] } = {};
  try {
    body = await request.json();
  } catch {
    // Body is optional
  }

  const { id: sessionId } = await params;
  const supabase = getSupabaseAdmin();

  // Verify ownership
  const { data: session } = await supabase
    .from("sessions")
    .select("id, status, plans!inner(user_id)")
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

  if (session.status === "completed") {
    return NextResponse.json({ ok: false, error: "Session already completed." }, { status: 400 });
  }

  // Mark completed
  const { error } = await supabase
    .from("sessions")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", sessionId);

  if (error) {
    return NextResponse.json({ ok: false, error: "Failed to complete session." }, { status: 500 });
  }

  // Log completion event
  await supabase.from("session_events").insert({
    session_id: sessionId,
    event_type: "completed",
    payload: { completed_moves: body.completed_moves ?? [] },
  });

  return NextResponse.json({ ok: true, completedAt: new Date().toISOString() });
}
