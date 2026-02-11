import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

const ALLOWED_CHOICES = [
  "Clear and actionable — I can follow this",
  "Too generic — needs more personalization",
  "Too hard — volume/intensity feels high",
  "Too easy — needs more challenge",
  "Confusing — I'm not sure what to do first",
  "Missing context — didn't match my match day / fatigue",
  "Other",
] as const;

interface FeedbackBody {
  feedbackChoice: string;
  feedbackOther?: string;
  reportContext?: Record<string, unknown>;
}

export async function POST(request: Request) {
  let body: FeedbackBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body." },
      { status: 400 },
    );
  }

  const choice = (body.feedbackChoice ?? "").trim();

  if (!ALLOWED_CHOICES.includes(choice as (typeof ALLOWED_CHOICES)[number])) {
    return NextResponse.json(
      { ok: false, error: "Invalid feedback choice." },
      { status: 400 },
    );
  }

  // Only keep freetext for "Other"
  let otherText: string | null = null;
  if (choice === "Other") {
    otherText = (body.feedbackOther ?? "").trim().slice(0, 240) || null;
  }

  // Validate reportContext size (< 2 KB)
  let context: Record<string, unknown> | null = null;
  if (body.reportContext && typeof body.reportContext === "object") {
    const serialized = JSON.stringify(body.reportContext);
    if (serialized.length < 2048) {
      context = body.reportContext;
    }
  }

  const supabase = getSupabaseAdmin();

  const { error: insertError } = await supabase
    .from("report_feedback")
    .insert({
      feedback_choice: choice,
      feedback_other: otherText,
      report_context: context,
    });

  if (insertError) {
    return NextResponse.json(
      { ok: false, error: "Something went wrong." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
