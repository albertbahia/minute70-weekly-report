import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

const TEAMMATE_CODE = "ELMPARC2FREE";
const RATE_LIMIT_DAYS = 7;

interface SorenessInput {
  hamstrings: number;
  groinAdductors: number;
  quadsCalves: number;
  other?: { label?: string; value: number };
}

interface ReportBody {
  email: string;
  matchDay: string;
  weeklyLoad: number;
  legsStatus: string;
  tissueFocus: string;
  includeSpeedExposure: boolean;
  recoveryMode: string;
  halfLengthMinutes?: number;
  teammateCode?: string;
  emailReminder?: boolean;
  requestedMode?: string;
  soreness?: SorenessInput;
}

const VALID_HALF_LENGTHS = [20, 25, 30, 35, 40, 45];

const VALID_MATCH_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const VALID_LEGS = ["Fresh", "Medium", "Heavy", "Tweaky"];
const VALID_TISSUE = ["Quads", "Hamstrings", "Calves", "Glutes", "Hip Flexors", "Ankles"];
const VALID_RECOVERY = ["Walk", "Pool", "Yoga", "Foam Roll", "Contrast Shower", "Full Rest"];
const VALID_REQUESTED_MODES = ["recovery", "balanced", "push"];

// --- Session detail types ---
interface Move {
  name: string;
  prescription: string;
  notes?: string;
}

interface SessionDetail {
  intensity: "moderate" | "light" | "recovery";
  title: string;
  intent: string;
  durationMin: number;
  warmup: Move[];
  main: Move[];
  cooldown: Move[];
}

// --- Tissue-focus lookup ---
const TISSUE_ACTIVATION: Record<string, Move> = {
  Quads:        { name: "Wall sit hold", prescription: "2 \u00d7 20s" },
  Hamstrings:   { name: "Single-leg RDL", prescription: "2 \u00d7 8 reps/side", notes: "Bodyweight only" },
  Calves:       { name: "Calf raise hold", prescription: "2 \u00d7 12 reps" },
  Glutes:       { name: "Glute bridge", prescription: "2 \u00d7 10 reps" },
  "Hip Flexors":{ name: "Hip flexor march", prescription: "2 \u00d7 10 reps/side" },
  Ankles:       { name: "Ankle circles", prescription: "10 each direction/side" },
};

const TISSUE_STRETCH: Record<string, Move> = {
  Quads:        { name: "Standing quad stretch", prescription: "30s/side" },
  Hamstrings:   { name: "Standing hamstring stretch", prescription: "30s/side" },
  Calves:       { name: "Wall calf stretch", prescription: "30s/side" },
  Glutes:       { name: "Pigeon stretch", prescription: "30s/side" },
  "Hip Flexors":{ name: "Hip flexor lunge stretch", prescription: "30s/side" },
  Ankles:       { name: "Ankle dorsiflexion stretch", prescription: "30s/side" },
};

function generatePlan(
  legsStatus: string,
  _weeklyLoad: number,
  matchDay: string,
  tissueFocus: string,
  includeSpeedExposure: boolean,
  _recoveryMode: string,
) {
  const STATUS_LINES: Record<string, string> = {
    Fresh: "Legs feeling good \u2014 time to build on that.",
    Medium: "Solid base this week. A smart taper will sharpen you up.",
    Heavy: "Legs are loaded. This week is about recovery, not volume.",
    Tweaky: "Something\u2019s off \u2014 protect it now so you\u2019re available on match day.",
  };

  const statusLine = STATUS_LINES[legsStatus] ?? "Plan generated.";
  const activation = TISSUE_ACTIVATION[tissueFocus] ?? TISSUE_ACTIVATION["Quads"];
  const stretch = TISSUE_STRETCH[tissueFocus] ?? TISSUE_STRETCH["Quads"];
  const sessions: SessionDetail[] = [];

  if (legsStatus === "Fresh" || legsStatus === "Medium") {
    // --- Moderate session ---
    const mainMoves: Move[] = [
      { name: "Tempo run", prescription: "4 \u00d7 3 min at RPE 6\u20137", notes: "90s walk between sets" },
      { name: "Ball work / passing drill", prescription: "8 min" },
      { name: "Change-of-direction drill", prescription: "6 reps \u00d7 20m" },
      { name: "Positional patterns", prescription: "5 min" },
    ];
    if (includeSpeedExposure) {
      mainMoves.push({ name: "Short sprints", prescription: "4 \u00d7 15m at 85%", notes: "Walk-back recovery" });
    }

    sessions.push({
      intensity: "moderate",
      title: "Moderate Rhythm Session",
      intent: "Maintain match tempo and keep your legs ticking over.",
      durationMin: includeSpeedExposure ? 40 : 35,
      warmup: [
        { name: "Easy jog", prescription: "5 min", notes: "Build pace gradually" },
        { name: "Leg swings", prescription: "10 each direction/side" },
        { name: "Hip circles", prescription: "8 reps/side" },
        activation,
      ],
      main: mainMoves,
      cooldown: [
        { name: "Easy walk", prescription: "3 min" },
        stretch,
        { name: "Foam roll", prescription: "2 min lower body" },
      ],
    });

    // --- Light session ---
    sessions.push({
      intensity: "light",
      title: "Light Technical Session",
      intent: "Stay sharp without adding fatigue.",
      durationMin: 25,
      warmup: [
        { name: "Walk", prescription: "3 min" },
        { name: "Ankle rocks", prescription: "10 reps/side" },
        { name: "Bodyweight squats", prescription: "8 reps, slow" },
      ],
      main: [
        { name: "Technical ball touches", prescription: "8 min, easy pace" },
        { name: "Passing drill (ground)", prescription: "5 min pairs" },
        { name: "Light positional walk-through", prescription: "5 min" },
      ],
      cooldown: [
        stretch,
        { name: "Hip flexor stretch", prescription: "30s/side" },
        { name: "Deep breathing", prescription: "2 min, lying down" },
      ],
    });
  } else if (legsStatus === "Heavy") {
    sessions.push({
      intensity: "light",
      title: "Light Recovery Session",
      intent: "Promote blood flow without loading tired legs.",
      durationMin: 20,
      warmup: [
        { name: "Easy walk", prescription: "5 min" },
        { name: "Arm circles", prescription: "10 each direction" },
        { name: "Gentle leg swings", prescription: "8/side" },
      ],
      main: [
        { name: "Technical ball touches", prescription: "5 min, very easy" },
        { name: "Passing drill (ground)", prescription: "5 min, no running" },
        activation,
      ],
      cooldown: [
        stretch,
        { name: "Foam roll", prescription: "3 min full lower body" },
        { name: "Deep breathing", prescription: "2 min, lying down" },
      ],
    });
  } else {
    // Tweaky
    const gentleStretch: Move = { ...stretch, notes: "Gentle \u2014 stop if painful" };
    sessions.push({
      intensity: "light",
      title: "Gentle Mobility Session",
      intent: "Protect the area and maintain range of motion.",
      durationMin: 20,
      warmup: [
        { name: "Slow walk", prescription: "3 min" },
        { name: "Arm circles", prescription: "10 each direction" },
        { name: "Cat-cow", prescription: "8 reps" },
      ],
      main: [
        { name: "Seated hip circles", prescription: "8 reps/side" },
        { name: "Supine knee rocks", prescription: "10 reps/side" },
        { name: "Gentle ankle rocks", prescription: "10 reps/side" },
        { name: gentleStretch.name, prescription: gentleStretch.prescription, notes: gentleStretch.notes },
      ],
      cooldown: [
        { name: "Seated forward fold", prescription: "30s" },
        { name: "Supine twist", prescription: "20s/side" },
        { name: "Deep breathing", prescription: "2 min, lying down" },
      ],
    });
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
      ? `Match day is ${matchDay} \u2014 ${daysUntilMatch === 1 ? "tomorrow" : "in 2 days"}. Lock in rest and hydration.`
      : `Match day is ${matchDay} (${daysUntilMatch} days out). You have time to train smart this week.`;

  return { statusLine, sessions, matchDayCue };
}

export async function POST(request: Request) {
  try {
    const body: ReportBody = await request.json();

    // --- Validation ---
    const {
      email, matchDay, weeklyLoad, legsStatus, tissueFocus,
      includeSpeedExposure, recoveryMode, halfLengthMinutes, teammateCode, emailReminder,
    } = body;

    const halfLength = halfLengthMinutes ?? 25;

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

    if (!VALID_HALF_LENGTHS.includes(halfLength)) {
      return NextResponse.json(
        { ok: false, reason: "validation", error: "Invalid half length." },
        { status: 400 }
      );
    }

    if (body.requestedMode && !VALID_REQUESTED_MODES.includes(body.requestedMode)) {
      return NextResponse.json(
        { ok: false, reason: "validation", error: "Invalid requested mode." },
        { status: 400 }
      );
    }

    if (body.soreness) {
      const s = body.soreness;
      const vals = [s.hamstrings, s.groinAdductors, s.quadsCalves];
      if (s.other?.value !== undefined) vals.push(s.other.value);
      if (vals.some((v) => typeof v !== "number" || v < 0 || v > 10)) {
        return NextResponse.json(
          { ok: false, reason: "validation", error: "Soreness values must be 0\u201310." },
          { status: 400 }
        );
      }
    }

    const isTeammate = teammateCode === TEAMMATE_CODE;

    // DEV-ONLY: allow x-minute70-tier header to simulate paid tier
    const devTier =
      process.env.NODE_ENV !== "production"
        ? request.headers.get("x-minute70-tier")
        : null;
    const isPaid = isTeammate || devTier === "paid";

    const supabase = getSupabaseAdmin();

    // --- Rate-limit check (skip for paid / teammates) ---
    if (!isPaid) {
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
        half_length_minutes: halfLength,
        teammate_code: isTeammate ? TEAMMATE_CODE : null,
        tier: isPaid ? "paid" : "free",
        requested_mode: body.requestedMode ?? null,
        soreness_hamstrings: body.soreness?.hamstrings ?? null,
        soreness_groin_adductors: body.soreness?.groinAdductors ?? null,
        soreness_quads_calves: body.soreness?.quadsCalves ?? null,
        soreness_other_label: body.soreness?.other?.label ?? null,
        soreness_other_value: body.soreness?.other?.value ?? null,
      })
      .select("id")
      .single();

    if (insertError) {
      const errMsg = insertError.message ?? "";

      // DB trigger rate-limit — message starts with "rate_limited:"
      if (errMsg.includes("rate_limited:")) {
        const { data: latest } = await supabase
          .from("weekly_report_requests")
          .select("created_at")
          .eq("email", email.toLowerCase())
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        let daysRemaining = 7;
        if (latest) {
          const nextAllowed = new Date(
            new Date(latest.created_at).getTime() + RATE_LIMIT_DAYS * 24 * 60 * 60 * 1000
          );
          daysRemaining = Math.max(
            0,
            Math.min(7, Math.ceil((nextAllowed.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
          );
        }

        console.log(`[rate-limit/db] blocked ${email.toLowerCase()} — ${daysRemaining}d remaining`);
        return NextResponse.json(
          {
            ok: false,
            reason: "limit",
            source: isPaid ? "teammate" : "public",
            daysRemaining,
            error: "You already generated this week's report. Come back next week.",
          },
          { status: 429 }
        );
      }

      console.error("Insert failed:", insertError);
      return NextResponse.json(
        { ok: false, reason: "error", error: "Failed to save report." },
        { status: 500 }
      );
    }

    if (!report) {
      console.error("Insert returned no data");
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

    const source = isPaid ? "teammate" : "public";
    console.log(`[report] saved for ${email.toLowerCase()} — source=${source}`);

    const plan = generatePlan(legsStatus, weeklyLoad, matchDay, tissueFocus, includeSpeedExposure, recoveryMode);

    return NextResponse.json({
      ok: true,
      source,
      followupScheduled: followupCreated,
      statusLine: plan.statusLine,
      sessions: plan.sessions,
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
