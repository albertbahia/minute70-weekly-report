import { NextResponse } from "next/server";
import { verifyJwt } from "@/lib/verify-jwt";
import { getSupabaseAdmin } from "@/lib/supabase";

const VALID_FOCUS = ["late_game", "injury_prevention"] as const;

export async function GET(request: Request) {
  const jwt = await verifyJwt(request);
  if (!jwt.ok) {
    return NextResponse.json({ ok: false, error: jwt.error }, { status: jwt.status });
  }

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("user_profiles")
    .select("focus, created_at")
    .eq("user_id", jwt.userId)
    .single();

  return NextResponse.json({ ok: true, profile: data ?? null });
}

export async function POST(request: Request) {
  const jwt = await verifyJwt(request);
  if (!jwt.ok) {
    return NextResponse.json({ ok: false, error: jwt.error }, { status: jwt.status });
  }

  let body: { focus?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const focus = (body.focus ?? "").trim();
  if (!VALID_FOCUS.includes(focus as (typeof VALID_FOCUS)[number])) {
    return NextResponse.json(
      { ok: false, error: "focus must be 'late_game' or 'injury_prevention'." },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("user_profiles")
    .upsert({ user_id: jwt.userId, focus }, { onConflict: "user_id" });

  if (error) {
    return NextResponse.json({ ok: false, error: "Failed to save profile." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, focus });
}
