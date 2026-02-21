import { NextResponse } from "next/server";
import { verifyJwt } from "@/lib/verify-jwt";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  const jwt = await verifyJwt(request);
  if (!jwt.ok) {
    return NextResponse.json({ ok: false, error: jwt.error }, { status: jwt.status });
  }

  let body: { match_datetime?: string; league_name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const dt = body.match_datetime ?? "";
  const parsed = new Date(dt);
  if (!dt || isNaN(parsed.getTime())) {
    return NextResponse.json(
      { ok: false, error: "match_datetime must be a valid ISO date string." },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("matches")
    .insert({
      user_id: jwt.userId,
      match_datetime: parsed.toISOString(),
      league_name: body.league_name?.trim() || null,
    })
    .select("id, match_datetime, league_name")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: "Failed to create match." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, match: data });
}
