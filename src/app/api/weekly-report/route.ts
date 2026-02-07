import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

const TEAMMATE_CODE = "ELMPARC2FREE";
const RATE_LIMIT_DAYS = 7;

interface ReportBody {
  email: string;
  matchDay: string;
  weeklyLoad: number;
  legsStatus: string;
  tissueFocus: string;
  includeSpeedExposure: boolean;
  recoveryMode: string;
  teammateCode?: string;
  emailReminder?: boolean;
}

const VALID_MATCH_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const VALID_LEGS = ["Fresh", "Medium", "Heavy", "Tweaky"];
const VALID_TISSUE = ["Quads", "Hamstrings", "Calves", "Glutes", "Hip Flexors", "Ankles"];
const VALID_RECOVERY = ["Walk", "Pool", "Yoga", "Foam Roll", "Contrast Shower", "Full Rest"];

function generatePlan(
  legsStatus: string,
  weeklyLoad: number,
  matchDay: string,
  tissueFocus: string,
  includeSpeedExposure: boolean,
  recoveryMode: string,
) {
  const STATUS_LINES: Record<string, string> = {
    Fresh: "Legs feeling good — time to build on that.",
    Medium: "Solid base this week. A smart taper will sharpen you up.",
    Heavy: "Legs are loaded. This week is about recovery, not volume.",
    Tweaky: "Something's off — protect it now so you're available on match day.",
  };

  const BASE_BULLETS: Record<string, string[]> = {
    Fresh: [
      "2 moderate sessions (tempo runs or ball work) early in the week",
      "1 short high-intensity burst (sprints or small-sided game) mid-week",
      "Rest or light walk the day before match day",
    ],
    Medium: [
      "1 moderate session early in the week to maintain rhythm",
      "1 light recovery session mid-week",
      "Full rest day before match day — trust the taper",
    ],
    Heavy: [
      "Active recovery only — walks, stretching, foam rolling",
      "1 light technical session (passing, touch drills) if legs allow",
      "Prioritize sleep and hydration over any training volume",
    ],
    Tweaky: [
      "Skip all high-impact training until discomfort clears",
      "Light mobility work and targeted stretching daily",
      "If pain persists beyond 48 hours, see a physio before match day",
    ],
  };

  const statusLine = STATUS_LINES[legsStatus] ?? "Plan generated.";
  const planBullets = [...(BASE_BULLETS[legsStatus] ?? ["Follow your usual routine."])];

  // Enrich with tissue focus
  if (tissueFocus && legsStatus !== "Tweaky") {
    planBullets.push(`Add targeted ${tissueFocus.toLowerCase()} work (mobility + activation) before sessions`);
  } else if (tissueFocus && legsStatus === "Tweaky") {
    planBullets.push(`Gentle ${tissueFocus.toLowerCase()} stretching only — no loaded exercises`);
  }

  // Enrich with speed exposure
  if (includeSpeedExposure && (legsStatus === "Fresh" || legsStatus === "Medium")) {
    planBullets.push("Include 4–6 short sprints (10–20m) at 85–90% effort mid-week");
  } else if (includeSpeedExposure && legsStatus === "Heavy") {
    planBullets.push("Delay speed work until legs feel lighter — walk-throughs only");
  }

  // Enrich with recovery mode
  const recoveryLower = recoveryMode.toLowerCase();
  if (recoveryMode === "Full Rest") {
    planBullets.push("Recovery day = full rest — no training, no cross-training");
  } else {
    planBullets.push(`Recovery session: ${recoveryLower} for 20–30 min on off days`);
  }

  const daysUntilMatch = (() => {
    const dayIndex = VALID_MATCH_DAYS.indexOf(matchDay);
    const today = new Date().getDay(); // 0=Sun
    const matchDayIndex = (dayIndex + 1) % 7;
    const diff = (matchDayIndex - today + 7) % 7;
    return diff === 0 ? 7 : diff;
  })();

  const matchDayCue =
    daysUntilMatch <= 2
      ? `Match day is ${matchDay} — ${daysUntilMatch === 1 ? "tomorrow" : "in 2 days"}. Lock in rest and hydration.`
      : `Match day is ${matchDay} (${daysUntilMatch} days out). You have time to train smart this week.`;

  return { statusLine, planBullets, matchDayCue };
}

export async function POST(request: Request) {
  try {
    const body: ReportBody = await request.json();

    // --- Validation ---
    const {
      email, matchDay, weeklyLoad, legsStatus, tissueFocus,
      includeSpeedExposure, recoveryMode, teammateCode, emailReminder,
    } = body;

    if (!email || !matchDay || weeklyLoad === undefined || !legsStatus || !tissueFocus || !recoveryMode) {
      return NextResponse.json(
        { ok: false, reason: "validation", error: "All required fields must be filled." },
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

    if (typeof weeklyLoad !== "number" || weeklyLoad < 0 || weeklyLoad > 7) {
      return NextResponse.json(
        { ok: false, reason: "validation", error: "Weekly load must be 0–7." },
        { status: 400 }
      );
    }

    if (!VALID_LEGS.includes(legsStatus)) {
      return NextResponse.json(
        { ok: false, reason: "validation", error: "Invalid legs status." },
        { status: 400 }
      );
    }

    if (!VALID_TISSUE.includes(tissueFocus)) {
      return NextResponse.json(
        { ok: false, reason: "validation", error: "Invalid tissue focus." },
        { status: 400 }
      );
    }

    if (!VALID_RECOVERY.includes(recoveryMode)) {
      return NextResponse.json(
        { ok: false, reason: "validation", error: "Invalid recovery mode." },
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
        weekly_load: weeklyLoad,
        legs_status: legsStatus,
        tissue_focus: tissueFocus,
        include_speed_exposure: includeSpeedExposure,
        recovery_mode: recoveryMode,
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
      } else {
        followupCreated = true;
        console.log(`[followup] scheduled for ${email.toLowerCase()} — send_at=${sendAt}`);
      }
    }

    const source = isTeammate ? "teammate" : "public";
    console.log(`[report] saved for ${email.toLowerCase()} — source=${source}`);

    const plan = generatePlan(legsStatus, weeklyLoad, matchDay, tissueFocus, includeSpeedExposure, recoveryMode);

    return NextResponse.json({
      ok: true,
      source,
      followupScheduled: followupCreated,
      statusLine: plan.statusLine,
      planBullets: plan.planBullets,
      matchDayCue: plan.matchDayCue,
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
