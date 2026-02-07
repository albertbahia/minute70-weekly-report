import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

const TEAMMATE_CODE = "ELMPARC2FREE";
const RATE_LIMIT_DAYS = 7;

interface ReportBody {
  email: string;
  name: string;
  accomplishments: string;
  goals: string;
  blockers?: string;
  teammateCode?: string;
  emailReminder?: boolean;
}

export async function POST(request: Request) {
  try {
    const body: ReportBody = await request.json();

    // --- Validation ---
    const { email, name, accomplishments, goals, blockers, teammateCode, emailReminder } = body;

    if (!email || !name || !accomplishments || !goals) {
      return NextResponse.json(
        { ok: false, reason: "validation", error: "Email, name, accomplishments, and goals are required." },
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
        name,
        accomplishments,
        goals,
        blockers: blockers || null,
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
          name,
          send_at: sendAt,
          report_request_id: report.id,
        });

      if (followupError) {
        console.error("Follow-up insert failed:", followupError);
        // Non-fatal: report was still saved
      } else {
        followupCreated = true;
      }
    }

    return NextResponse.json({
      ok: true,
      source: isTeammate ? "teammate" : "public",
      followupScheduled: followupCreated,
    });
  } catch {
    return NextResponse.json(
      { ok: false, reason: "validation", error: "Invalid request body." },
      { status: 400 }
    );
  }
}
