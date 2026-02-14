import { NextResponse } from "next/server";
import { verifyJwt } from "@/lib/verify-jwt";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  PROMO_CODE,
  PROMO_MAX_ATTEMPTS,
  PROMO_DURATION_DAYS,
  PROMO_WEEKLY_SESSIONS,
} from "@/lib/entitlements";

export async function POST(request: Request) {
  const jwt = await verifyJwt(request);
  if (!jwt.ok) {
    return NextResponse.json({ ok: false, error: jwt.error }, { status: jwt.status });
  }

  let body: { code?: string; email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const code = (body.code ?? "").trim().toUpperCase();
  const email = (body.email ?? "").trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ ok: false, error: "Email is required." }, { status: 400 });
  }
  if (code !== PROMO_CODE) {
    return NextResponse.json({ ok: false, error: "Invalid promo code." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Check existing redemption
  const { data: existing } = await supabase
    .from("promo_redemptions")
    .select("*")
    .eq("user_id", jwt.userId)
    .eq("code", PROMO_CODE)
    .single();

  if (existing) {
    // Already exhausted
    if (existing.attempts >= PROMO_MAX_ATTEMPTS || existing.status === "exhausted") {
      return NextResponse.json(
        { ok: false, error: "Maximum redemption attempts reached." },
        { status: 403 },
      );
    }
    // Already expired
    if (new Date() > new Date(existing.expires_at) || existing.status === "expired") {
      await supabase
        .from("promo_redemptions")
        .update({ status: "expired" })
        .eq("id", existing.id);
      return NextResponse.json(
        { ok: false, error: "Promo code has expired." },
        { status: 403 },
      );
    }
    // Already active — idempotent success
    if (existing.status === "active") {
      return NextResponse.json({
        ok: true,
        expiresAt: existing.expires_at,
        sessionsPerWeek: PROMO_WEEKLY_SESSIONS,
        alreadyRedeemed: true,
      });
    }
  }

  // First redemption
  const expiresAt = new Date();
  expiresAt.setUTCDate(expiresAt.getUTCDate() + PROMO_DURATION_DAYS);

  const { error: promoError } = await supabase
    .from("promo_redemptions")
    .insert({
      user_id: jwt.userId,
      email,
      code: PROMO_CODE,
      expires_at: expiresAt.toISOString(),
    });

  if (promoError) {
    // Race condition — unique constraint
    if (promoError.code === "23505") {
      return NextResponse.json({
        ok: true,
        expiresAt: expiresAt.toISOString(),
        sessionsPerWeek: PROMO_WEEKLY_SESSIONS,
        alreadyRedeemed: true,
      });
    }
    return NextResponse.json({ ok: false, error: "Failed to redeem code." }, { status: 500 });
  }

  // Create/update entitlement
  await supabase.from("entitlements").upsert(
    {
      user_id: jwt.userId,
      status: "promo",
      start_at: new Date().toISOString(),
      end_at: expiresAt.toISOString(),
      source: PROMO_CODE,
      weekly_pro_sessions_remaining: PROMO_WEEKLY_SESSIONS,
      weekly_sessions_reset_at: new Date().toISOString(),
      redemption_attempts: 1,
    },
    { onConflict: "user_id" },
  );

  return NextResponse.json({
    ok: true,
    expiresAt: expiresAt.toISOString(),
    sessionsPerWeek: PROMO_WEEKLY_SESSIONS,
  });
}
