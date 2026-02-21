import { getSupabaseAdmin } from "@/lib/supabase";

// --- Constants ---
export const PROMO_CODE = "ELMPARC2FREE";
export const PROMO_MAX_ATTEMPTS = 3;
export const PROMO_DURATION_DAYS = 28;
export const PROMO_WEEKLY_SESSIONS = 3;

export type EntitlementStatus =
  | "free"
  | "trial"
  | "pro_monthly"
  | "pro_season"
  | "promo";

export interface CanStartResult {
  allowed: boolean;
  reason: string;
  entitlementStatus: EntitlementStatus | "none";
}

/** Returns the most recent Monday 00:00 UTC for the given date. */
export function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Check if a user is allowed to start a session.
 * For promo users, this also decrements the weekly counter.
 */
export async function canStartSession(
  userId: string,
): Promise<CanStartResult> {
  const supabase = getSupabaseAdmin();

  const { data: ent, error } = await supabase
    .from("entitlements")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !ent) {
    return { allowed: false, reason: "no_entitlement", entitlementStatus: "none" };
  }

  const now = new Date();
  const status = ent.status as EntitlementStatus;

  // Free tier cannot start sessions
  if (status === "free") {
    return { allowed: false, reason: "free_tier", entitlementStatus: "free" };
  }

  // Pro or trial: check expiry
  if (status === "trial" || status === "pro_monthly" || status === "pro_season") {
    if (ent.end_at && now > new Date(ent.end_at)) {
      return { allowed: false, reason: "expired", entitlementStatus: status };
    }
    return { allowed: true, reason: "pro_active", entitlementStatus: status };
  }

  // Promo: check expiry + weekly limit (atomic decrement)
  if (status === "promo") {
    if (ent.end_at && now > new Date(ent.end_at)) {
      return { allowed: false, reason: "promo_expired", entitlementStatus: "promo" };
    }

    const weekStart = getStartOfWeek(now);

    // Atomic: resets counter if new week, then decrements if > 0
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "decrement_session_counter",
      {
        p_entitlement_id: ent.id,
        p_week_start: weekStart.toISOString(),
        p_weekly_limit: PROMO_WEEKLY_SESSIONS,
      },
    );

    if (rpcError) {
      return { allowed: false, reason: "server_error", entitlementStatus: "promo" };
    }

    // rpcResult = -1 means no rows updated (limit reached), >= 0 means remaining after decrement
    if (rpcResult < 0) {
      return {
        allowed: false,
        reason: "weekly_limit_reached",
        entitlementStatus: "promo",
      };
    }

    return { allowed: true, reason: "promo_active", entitlementStatus: "promo" };
  }

  return { allowed: false, reason: "unknown_status", entitlementStatus: "none" };
}
