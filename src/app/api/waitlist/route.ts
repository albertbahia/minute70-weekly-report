import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

interface WaitlistBody {
  email: string;
}

export async function POST(request: Request) {
  let body: WaitlistBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body." },
      { status: 400 },
    );
  }

  const email = (body.email ?? "").trim().toLowerCase();

  if (!email) {
    return NextResponse.json(
      { ok: false, error: "Email is required." },
      { status: 400 },
    );
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json(
      { ok: false, error: "Please enter a valid email." },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdmin();

  // Check if already on the waitlist
  const { data: existing, error: lookupError } = await supabase
    .from("waitlist_signups")
    .select("id")
    .eq("email", email)
    .limit(1);

  if (lookupError) {
    return NextResponse.json(
      { ok: false, error: "Something went wrong." },
      { status: 500 },
    );
  }

  if (existing && existing.length > 0) {
    return NextResponse.json({ ok: true, status: "exists" });
  }

  // Insert new signup
  const { error: insertError } = await supabase
    .from("waitlist_signups")
    .insert({ email });

  if (insertError) {
    // Handle unique constraint race condition
    if (insertError.code === "23505") {
      return NextResponse.json({ ok: true, status: "exists" });
    }
    return NextResponse.json(
      { ok: false, error: "Something went wrong." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, status: "created" });
}
