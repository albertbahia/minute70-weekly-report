import { NextResponse } from "next/server";
import { verifyJwt } from "@/lib/verify-jwt";
import { getSupabaseAdmin } from "@/lib/supabase";

interface EventBody {
  event_type: string;
  event_props?: Record<string, unknown>;
}

export async function POST(request: Request) {
  // --- Parse body ---
  let body: EventBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body." },
      { status: 400 },
    );
  }

  const eventType = (body.event_type ?? "").trim();
  if (!eventType) {
    return NextResponse.json(
      { ok: false, error: "event_type is required." },
      { status: 400 },
    );
  }

  // --- Validate event_props size (< 4 KB) ---
  let eventProps: Record<string, unknown> = {};
  if (body.event_props && typeof body.event_props === "object") {
    const serialized = JSON.stringify(body.event_props);
    if (serialized.length >= 4096) {
      return NextResponse.json(
        { ok: false, error: "event_props too large." },
        { status: 400 },
      );
    }
    eventProps = body.event_props;
  }

  // --- Verify JWT ---
  const jwt = await verifyJwt(request);
  if (!jwt.ok) {
    return NextResponse.json({ ok: false, error: jwt.error }, { status: jwt.status });
  }

  // --- Insert event ---
  const supabase = getSupabaseAdmin();

  const { error: insertError } = await supabase
    .from("report_events")
    .insert({
      user_id: jwt.userId,
      event_type: eventType,
      event_props: eventProps,
    });

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json(
        { ok: false, error: "Duplicate event." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { ok: false, error: "Something went wrong." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
