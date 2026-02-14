import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const ALLOWED_EVENTS = ["report_generated", "mode_overridden"] as const;

interface EventBody {
  eventType: string;
  payload?: Record<string, unknown>;
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`events:${ip}`, 20, 60_000); // 20 per minute
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: "Too many requests." }, { status: 429 });
  }

  let body: EventBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body." },
      { status: 400 },
    );
  }

  const eventType = (body.eventType ?? "").trim();

  if (!ALLOWED_EVENTS.includes(eventType as (typeof ALLOWED_EVENTS)[number])) {
    return NextResponse.json(
      { ok: false, error: "Invalid event type." },
      { status: 400 },
    );
  }

  // Validate payload size (< 4 KB)
  let payload: Record<string, unknown> | null = null;
  if (body.payload && typeof body.payload === "object") {
    const serialized = JSON.stringify(body.payload);
    if (serialized.length < 4096) {
      payload = body.payload;
    }
  }

  const supabase = getSupabaseAdmin();

  const { error: insertError } = await supabase
    .from("report_events")
    .insert({
      event_type: eventType,
      event_props: payload,
    });

  if (insertError) {
    return NextResponse.json(
      { ok: false, error: "Something went wrong." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
