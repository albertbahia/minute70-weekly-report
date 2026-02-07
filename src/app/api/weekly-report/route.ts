import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

const TEAMMATE_CODE = "ELMPARC2FREE";
const RATE_LIMIT_DAYS = 7;

interface ReportBody {
  email: string;
  matchDay: string;
  trainingDays: number;
  legsStatus: string;
  teammateCode?: string;
  emailReminder?: boolean;
}

const VALID_MATCH_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const VALID_LEGS = ["Fresh", "Medium", "Heavy", "Tweaky"];

export async function POST(request: Request) {
  try {
    const body: ReportBody = await request.json();

    // --- Validation ---
    const { email, matchDay, trainingDays, legsStatus, teammateCode, emailReminder } = body;

    if (!email || !matchDay || trainingDays === undefined || !legsStatus) {
      return NextResponse.json(
        { ok: false, reason: "validation", error: "Email, match day, training days, and legs status are required." },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { ok: false, reason: "validation", error: "Invalid email address." },
        { status: 400 }
      );
    }

    if (!VALID_MATCH_DAYS.includes(matchDay)) {
      return NextResponse.json(
        { ok: false, reason: "validation", error: "Invalid match day." },
        { status: 400 }
      );
    }

    if (typeof trainingDays !== "number" || trainingDays < 0 || trainingDays > 7) {
      return NextResponse.json(
        { ok: false, reason: "validation", error: "Training days must be 0–7." },
        { status: 400 }
      );
    }

    if (!VALID_LEGS.includes(legsStatus)) {
      return NextResponse.json(
        { ok: false, reason: "validation", error: "Invalid legs status." },
        { status: 400 }
      );
    }

    const isTeammate = teammateCode === TEAMMATE_CODE;

    const supabase = getSupabaseAdmin();

    // --- Rate-limit check (skip for teammates) ---
    if (!isTeammate) {
      const cutoff = new Date(Date.now() - RATE_LIMIT_DAYS * 24 * 60 * 60 * 1000).toISOString();

      const { data: recent, error: lookupError } = await supabase
        .from("weekly_report_requests")
        .select("id, created_at")
        .eq("email", email.toLowerCase())
        .gte("created_at", cutoff)
        .limit(1);

      if (lookupError) {
        console.error("Rate-limit lookup failed:", lookupError);
        return NextResponse.json(
          { ok: false, reason: "error", error: "Server error." },
          { status: 500 }
        );
      }

      if (recent && recent.length > 0) {
        const nextAllowed = new Date(
          new Date(recent[0].created_at).getTime() + RATE_LIMIT_DAYS * 24 * 60 * 60 * 1000
        );
        const daysRemaining = Math.ceil((nextAllowed.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
        console.log(`[rate-limit] blocked ${email.toLowerCase()} — ${daysRemaining}d remaining`);
        return NextResponse.json(
          {
            ok: false,
            reason: "limit",
            source: "public",
            daysRemaining,
            error: `You already submitted a report recently. You can submit again after ${nextAllowed.toLocaleDateString()}.`,
          },
          { status: 429 }
        );
      }
    }

    // --- Insert report ---
    const { data: report, error: insertError } = await supabase
      .from("weekly_report_requests")
      .insert({
        email: email.toLowerCase(),
        match_day: matchDay,
        training_days: trainingDays,
        legs_status: legsStatus,
        teammate_code: isTeammate ? TEAMMATE_CODE : null,
      })
      .select("id")
      .single();

    if (insertError || !report) {
      console.error("Insert failed:", insertError);
      return NextResponse.json(
        { ok: false, reason: "error", error: "Failed to save report." },
        { status: 500 }
      );
    }

    // --- Follow-up reminder (teammate only, opt-in) ---
    let followupCreated = false;
    if (isTeammate && emailReminder !== false) {
      const sendAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { error: followupError } = await supabase
        .from("weekly_report_followups")
        .insert({
          email: email.toLowerCase(),
          send_at: sendAt,
          report_request_id: report.id,
        });

      if (followupError) {
        console.error("Follow-up insert failed:", followupError);
        // Non-fatal: report was still saved
      } else {
        followupCreated = true;
        console.log(`[followup] scheduled for ${email.toLowerCase()} — send_at=${sendAt}`);
      }
    }

    const source = isTeammate ? "teammate" : "public";
    console.log(`[report] saved for ${email.toLowerCase()} — source=${source}`);

    return NextResponse.json({
      ok: true,
      source,
      followupScheduled: followupCreated,
    });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return NextResponse.json(
        { ok: false, reason: "validation", error: "Invalid request body." },
        { status: 400 }
      );
    }
    console.error("Unhandled error:", err);
    return NextResponse.json(
      { ok: false, reason: "error", error: "Internal server error." },
      { status: 500 }
    );
  }
}
