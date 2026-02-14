import { NextResponse } from "next/server";
import { verifyJwt } from "@/lib/verify-jwt";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getMovesForFocus } from "@/lib/session-moves";

/**
 * GET /api/plan — Fetch or auto-generate the user's current weekly plan.
 * Requires Authorization: Bearer <access_token>.
 */
export async function GET(request: Request) {
  const jwt = await verifyJwt(request);
  if (!jwt.ok) {
    return NextResponse.json({ ok: false, error: jwt.error }, { status: jwt.status });
  }

  const supabase = getSupabaseAdmin();

  // Fetch latest plan
  const { data: plan } = await supabase
    .from("plans")
    .select("id, focus, sessions_per_week, match_id, created_at")
    .eq("user_id", jwt.userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (plan) {
    // Fetch sessions for this plan
    const { data: sessions } = await supabase
      .from("sessions")
      .select("id, scheduled_for, completed_at, duration_minutes, status, moves")
      .eq("plan_id", plan.id)
      .order("scheduled_for", { ascending: true });

    return NextResponse.json({ ok: true, plan, sessions: sessions ?? [] });
  }

  // No plan exists — auto-generate one
  const generated = await generatePlan(jwt.userId, supabase);
  if (!generated) {
    return NextResponse.json({ ok: false, error: "Failed to generate plan." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ...generated });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generatePlan(userId: string, supabase: any) {
  // Get user focus (default: late_game)
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("focus")
    .eq("user_id", userId)
    .single();

  const focus = (profile?.focus ?? "late_game") as "late_game" | "injury_prevention";

  // Get latest match (nullable)
  const { data: match } = await supabase
    .from("matches")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // Insert plan
  const { data: plan, error: planError } = await supabase
    .from("plans")
    .insert({
      user_id: userId,
      focus,
      match_id: match?.id ?? null,
      sessions_per_week: 2,
    })
    .select("id, focus, sessions_per_week, match_id, created_at")
    .single();

  if (planError || !plan) return null;

  // Generate session dates: next 2 weekdays from today
  const dates = getNextWeekdays(2);
  const moves = getMovesForFocus(focus);

  const sessionRows = dates.map((d) => ({
    plan_id: plan.id,
    scheduled_for: d,
    duration_minutes: 8,
    status: "scheduled" as const,
    moves,
  }));

  const { data: sessions, error: sessError } = await supabase
    .from("sessions")
    .insert(sessionRows)
    .select("id, scheduled_for, completed_at, duration_minutes, status, moves");

  if (sessError) return null;

  return { plan, sessions: sessions ?? [] };
}

/** Returns the next N weekdays (Mon–Fri) as ISO date strings (YYYY-MM-DD). */
function getNextWeekdays(count: number): string[] {
  const results: string[] = [];
  const d = new Date();
  // Start from tomorrow
  d.setUTCDate(d.getUTCDate() + 1);

  while (results.length < count) {
    const day = d.getUTCDay();
    if (day >= 1 && day <= 5) {
      results.push(d.toISOString().slice(0, 10));
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return results;
}
