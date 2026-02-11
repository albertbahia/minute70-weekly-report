import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

interface RecoveryBody {
  email: string;
  enabled: boolean;
}

export async function POST(request: Request) {
  try {
    const body: RecoveryBody = await request.json();
    const { enabled } = body;
    const email = body.email?.trim().toLowerCase();

    if (!email) {
      return NextResponse.json(
        { ok: false, error: "Email is required." },
        { status: 400 },
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { ok: false, error: "Invalid email address." },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();

    // Ensure the email exists in waitlist_signups (upsert)
    const { data: existing } = await supabase
      .from("waitlist_signups")
      .select("id")
      .eq("email", email)
      .limit(1)
      .maybeSingle();

    if (!existing) {
      const { error: insertError } = await supabase
        .from("waitlist_signups")
        .insert({ email });

      if (insertError) {
        // 23505 = unique constraint violation (race condition — row was inserted concurrently)
        if (insertError.code !== "23505") {
          console.error("Waitlist insert failed:", insertError);
          return NextResponse.json(
            { ok: false, error: "Server error." },
            { status: 500 },
          );
        }
      }
    }

    // Set or clear pref_recovery_until
    const prefValue = enabled
      ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { error: updateError } = await supabase
      .from("waitlist_signups")
      .update({ pref_recovery_until: prefValue })
      .eq("email", email);

    if (updateError) {
      console.error("Preference update failed:", updateError);
      return NextResponse.json(
        { ok: false, error: "Failed to save preference." },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, isRecoveryActive: enabled });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return NextResponse.json(
        { ok: false, error: "Invalid request body." },
        { status: 400 },
      );
    }
    console.error("Unhandled error:", err);
    return NextResponse.json(
      { ok: false, error: "Internal server error." },
      { status: 500 },
    );
  }
}
