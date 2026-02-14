import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

interface WaitlistBody {
  email: string;
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`waitlist:${ip}`, 5, 60_000); // 5 per minute
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: "Too many requests." }, { status: 429 });
  }

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
    return NextResponse.json({ ok: true, status: "ok" });
  }

  // Insert new signup
  const { error: insertError } = await supabase
    .from("waitlist_signups")
    .insert({ email });

  if (insertError) {
    // Handle unique constraint race condition
    if (insertError.code === "23505") {
      return NextResponse.json({ ok: true, status: "ok" });
    }
    return NextResponse.json(
      { ok: false, error: "Something went wrong." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, status: "ok" });
}
