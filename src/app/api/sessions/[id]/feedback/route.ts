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

  let body: { rating?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body." }, { status: 400 });
  }

  if (body.rating !== "up" && body.rating !== "down") {
    return NextResponse.json({ ok: false, error: "rating must be 'up' or 'down'." }, { status: 400 });
  }

  const { id: sessionId } = await params;
  const supabase = getSupabaseAdmin();

  // Verify session belongs to this user
  const { data: session } = await supabase
    .from("sessions")
    .select("id, plans!inner(user_id)")
    .eq("id", sessionId)
    .single();

  if (!session) {
    return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((session as any).plans?.user_id !== jwt.userId) {
    return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 });
  }

  await supabase.from("session_events").insert({
    session_id: sessionId,
    event_type: "feedback",
    payload: { rating: body.rating },
  });

  return NextResponse.json({ ok: true });
}
