/**
 * Sanity tests for authenticated flows (suite M–R).
 *
 * Creates a disposable Supabase user, exercises the full authenticated
 * API surface, then cleans up the user and all associated data.
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 *           SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local
 *           + dev server running on localhost:3000
 */

import { createClient } from "@supabase/supabase-js";

const API = "http://localhost:3000/api";
const TEST_EMAIL = `sanity-auth-${Date.now()}@test.local`;
const TEST_PASSWORD = "TestPass123!";

// Load env from .env.local (tsx doesn't auto-load it)
import { readFileSync } from "fs";
const envFile = readFileSync(".env.local", "utf-8");
const env: Record<string, string> = {};
for (const line of envFile.split("\n")) {
  const match = line.match(/^([A-Z_]+)=(.+)$/);
  if (match) env[match[1]] = match[2].trim();
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  console.error("Missing Supabase env vars in .env.local");
  process.exit(1);
}

const anonClient = createClient(SUPABASE_URL, ANON_KEY);
const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

function authHeaders(token: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function api(
  method: string,
  path: string,
  token: string,
  body?: Record<string, unknown>,
): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: authHeaders(token),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function run() {
  console.log(`\nAuthenticated flow tests — email: ${TEST_EMAIL}\n`);

  // ===== Setup: create test user =====
  const { data: signupData, error: signupErr } = await anonClient.auth.signUp({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  if (signupErr || !signupData.session) {
    console.error("Could not create test user:", signupErr?.message ?? "no session returned");
    process.exit(1);
  }
  const token = signupData.session.access_token;
  const userId = signupData.session.user.id;
  console.log(`  (test user created: ${userId.slice(0, 8)}...)\n`);

  // ===== M) Unauthenticated requests rejected =====
  console.log("M) Unauthenticated requests rejected");
  const m1 = await fetch(`${API}/profile`, { headers: { Authorization: "Bearer invalid" } });
  check("GET /api/profile 401 with bad token", m1.status === 401, `got ${m1.status}`);

  const m2 = await fetch(`${API}/plan`, { headers: { Authorization: "Bearer invalid" } });
  check("GET /api/plan 401 with bad token", m2.status === 401, `got ${m2.status}`);

  const m3 = await fetch(`${API}/profile`);
  check("GET /api/profile 401 with no token", m3.status === 401, `got ${m3.status}`);

  // ===== N) Profile: create and read =====
  console.log("\nN) Profile flow");
  const n1 = await api("GET", "/profile", token);
  check("GET /api/profile 200", n1.status === 200, `got ${n1.status}`);
  check("profile is null initially", n1.data.profile === null, `got ${JSON.stringify(n1.data.profile)}`);

  const n2 = await api("POST", "/profile", token, { focus: "late_game" });
  check("POST /api/profile 200", n2.status === 200, `got ${n2.status}`);
  check("ok=true", n2.data.ok === true, `got ${n2.data.ok}`);
  check("focus=late_game", n2.data.focus === "late_game", `got ${n2.data.focus}`);

  const n3 = await api("GET", "/profile", token);
  check("profile persisted", (n3.data.profile as Record<string, unknown>)?.focus === "late_game", `got ${JSON.stringify(n3.data.profile)}`);

  // Changing focus works (upsert)
  const n4 = await api("POST", "/profile", token, { focus: "injury_prevention" });
  check("focus change 200", n4.status === 200, `got ${n4.status}`);
  const n5 = await api("GET", "/profile", token);
  check("focus updated", (n5.data.profile as Record<string, unknown>)?.focus === "injury_prevention", `got ${JSON.stringify(n5.data.profile)}`);

  // Invalid focus rejected
  const n6 = await api("POST", "/profile", token, { focus: "invalid_focus" });
  check("invalid focus 400", n6.status === 400, `got ${n6.status}`);

  // ===== O) Plan auto-generation =====
  console.log("\nO) Plan auto-generation");
  const o1 = await api("GET", "/plan", token);
  check("GET /api/plan 200", o1.status === 200, `got ${o1.status}`);
  check("ok=true", o1.data.ok === true, `got ${o1.data.ok}`);
  check("plan exists", o1.data.plan != null, "plan is null");
  const plan = o1.data.plan as Record<string, unknown>;
  check("plan has id", typeof plan?.id === "string", `got ${typeof plan?.id}`);
  check("plan has focus", typeof plan?.focus === "string", `got ${plan?.focus}`);
  const sessions = o1.data.sessions as Array<Record<string, unknown>>;
  check("sessions array", Array.isArray(sessions), `got ${typeof sessions}`);
  check("sessions.length >= 1", sessions.length >= 1, `got ${sessions.length}`);
  const sessionId = sessions[0]?.id as string;
  check("session has id", typeof sessionId === "string", `got ${typeof sessionId}`);
  check("session status=scheduled", sessions[0]?.status === "scheduled", `got ${sessions[0]?.status}`);
  check("session has moves", Array.isArray(sessions[0]?.moves), `got ${typeof sessions[0]?.moves}`);

  // ===== P) Session start — blocked without entitlement =====
  console.log("\nP) Session start (no entitlement)");
  const p1 = await api("POST", `/sessions/${sessionId}/start`, token);
  check("start 403 (no entitlement)", p1.status === 403, `got ${p1.status}`);
  check("paywallRequired=true", p1.data.paywallRequired === true, `got ${p1.data.paywallRequired}`);

  // Wrong session ID
  const p2 = await api("POST", "/sessions/00000000-0000-0000-0000-000000000000/start", token);
  check("start 404 (bad session)", p2.status === 404, `got ${p2.status}`);

  // ===== Q) Promo redeem + session start =====
  console.log("\nQ) Promo redeem + session start");
  // Invalid code rejected
  const q0 = await api("POST", "/promo/redeem", token, { code: "BADCODE", email: TEST_EMAIL });
  check("invalid code 400", q0.status === 400, `got ${q0.status}`);

  // Redeem ELMPARC2FREE
  const q1 = await api("POST", "/promo/redeem", token, { code: "ELMPARC2FREE", email: TEST_EMAIL });
  check("redeem 200", q1.status === 200, `got ${q1.status}`);
  check("ok=true", q1.data.ok === true, `got ${q1.data.ok}`);
  check("expiresAt present", typeof q1.data.expiresAt === "string", `got ${typeof q1.data.expiresAt}`);

  // Idempotent re-redeem
  const q2 = await api("POST", "/promo/redeem", token, { code: "ELMPARC2FREE", email: TEST_EMAIL });
  check("re-redeem 200", q2.status === 200, `got ${q2.status}`);
  check("alreadyRedeemed=true", q2.data.alreadyRedeemed === true, `got ${q2.data.alreadyRedeemed}`);

  // Session start now succeeds
  const q3 = await api("POST", `/sessions/${sessionId}/start`, token);
  check("start 200 (with promo)", q3.status === 200, `got ${q3.status}`);
  check("ok=true", q3.data.ok === true, `got ${q3.data.ok}`);
  const startedSession = q3.data.session as Record<string, unknown>;
  check("session returned", startedSession != null, "session is null");
  check("session has moves", Array.isArray(startedSession?.moves), `got ${typeof startedSession?.moves}`);

  // ===== R) Session complete =====
  console.log("\nR) Session complete");
  const moveNames = ((startedSession?.moves ?? []) as Array<{ name: string }>).map((m) => m.name);
  const r1 = await api("POST", `/sessions/${sessionId}/complete`, token, {
    completed_moves: moveNames.slice(0, 2),
  });
  check("complete 200", r1.status === 200, `got ${r1.status}`);
  check("ok=true", r1.data.ok === true, `got ${r1.data.ok}`);
  check("completedAt present", typeof r1.data.completedAt === "string", `got ${typeof r1.data.completedAt}`);

  // Double complete rejected
  const r2 = await api("POST", `/sessions/${sessionId}/complete`, token, { completed_moves: [] });
  check("double complete 400", r2.status === 400, `got ${r2.status}`);

  // Plan reflects completed status
  const r3 = await api("GET", "/plan", token);
  const updatedSessions = r3.data.sessions as Array<Record<string, unknown>>;
  const completedSession = updatedSessions.find((s) => s.id === sessionId);
  check("session now completed", completedSession?.status === "completed", `got ${completedSession?.status}`);

  // ===== Cleanup =====
  console.log("\n  (cleaning up test user...)");
  // Delete in dependency order
  await adminClient.from("session_events").delete().eq("session_id", sessionId);
  const planId = (plan as Record<string, unknown>).id as string;
  await adminClient.from("sessions").delete().eq("plan_id", planId);
  await adminClient.from("plans").delete().eq("user_id", userId);
  await adminClient.from("entitlements").delete().eq("user_id", userId);
  await adminClient.from("promo_redemptions").delete().eq("user_id", userId);
  await adminClient.from("user_profiles").delete().eq("user_id", userId);
  await adminClient.from("report_events").delete().eq("user_id", userId);
  await adminClient.auth.admin.deleteUser(userId);
  console.log("  (done)\n");

  // Summary
  console.log(`${passed} passed, ${failed} failed  (authenticated flows)\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Auth flow tests crashed:", err.message);
  process.exit(1);
});
