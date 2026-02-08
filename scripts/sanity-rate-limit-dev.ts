/**
 * E2E sanity tests for DB-trigger rate limiting.
 *
 * Requires:
 *  - Dev server running on localhost:3000
 *  - .env.local with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *
 * Tests:
 *  J) Free tier  — 1st POST ok, 2nd POST 429 (DB trigger: free=1/week)
 *  K) Paid tier  — 3 POSTs ok, 4th POST 429 (DB trigger: paid=3/week)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------
const envPath = resolve(__dirname, "..", ".env.local");
const envFile = readFileSync(envPath, "utf-8");
const env: Record<string, string> = {};
for (const line of envFile.split("\n")) {
  const m = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/);
  if (m) env[m[1]] = m[2];
}

const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const BASE = "http://localhost:3000/api/weekly-report";
const FREE_EMAIL = "test_free@example.com";
const PAID_EMAIL = "test_paid@example.com";

interface ApiResponse {
  ok: boolean;
  reason?: string;
  source?: string;
  daysRemaining?: number;
  error?: string;
  statusLine?: string;
  planBullets?: string[];
  matchDayCue?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
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

function reportBody(email: string) {
  return {
    email,
    matchDay: "Saturday",
    weeklyLoad: 3,
    legsStatus: "Fresh",
    tissueFocus: "Quads",
    includeSpeedExposure: false,
    recoveryMode: "Walk",
  };
}

async function post(
  body: Record<string, unknown>,
  headers?: Record<string, string>,
): Promise<{ status: number; data: ApiResponse }> {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const data: ApiResponse = await res.json();
  return { status: res.status, data };
}

async function cleanup() {
  const emails = [FREE_EMAIL, PAID_EMAIL];
  for (const email of emails) {
    // Delete followups first (FK)
    await supabase
      .from("weekly_report_followups")
      .delete()
      .eq("email", email);
    await supabase
      .from("weekly_report_requests")
      .delete()
      .eq("email", email);
  }
}

async function checkDevServer(): Promise<boolean> {
  try {
    await fetch(BASE, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------
async function run() {
  // Pre-flight: dev server reachable?
  const up = await checkDevServer();
  if (!up) {
    console.error("\nDev server not running. Start with npm run dev, then re-run sanity.\n");
    process.exit(1);
  }

  console.log("\nRate-limit E2E tests\n");

  // Cleanup prior test data
  await cleanup();

  // -----------------------------------------------------------------------
  // J) Free tier — 1 allowed, 2nd blocked by DB trigger
  // -----------------------------------------------------------------------
  console.log("J) Free tier — 1st request succeeds");
  const j1 = await post(reportBody(FREE_EMAIL));
  check("status 200", j1.status === 200, `got ${j1.status}`);
  check("ok=true", j1.data.ok === true, `got ${j1.data.ok}`);
  check('source="public"', j1.data.source === "public", `got ${j1.data.source}`);

  console.log("\nJ) Free tier — 2nd request rate-limited");
  const j2 = await post(reportBody(FREE_EMAIL));
  check("status 429", j2.status === 429, `got ${j2.status}`);
  check("ok=false", j2.data.ok === false, `got ${j2.data.ok}`);
  check('reason="limit"', j2.data.reason === "limit", `got ${j2.data.reason}`);
  check("daysRemaining 1-7", typeof j2.data.daysRemaining === "number" && j2.data.daysRemaining >= 1 && j2.data.daysRemaining <= 7, `got ${j2.data.daysRemaining}`);
  check("error is string", typeof j2.data.error === "string" && j2.data.error.length > 0, "missing error message");

  // -----------------------------------------------------------------------
  // K) Paid tier — 3 allowed, 4th blocked by DB trigger
  // -----------------------------------------------------------------------
  console.log("\nK) Paid tier — requests 1-3 succeed");
  for (let i = 1; i <= 3; i++) {
    const k = await post(reportBody(PAID_EMAIL), { "x-minute70-tier": "paid" });
    check(`request ${i}: status 200`, k.status === 200, `got ${k.status}`);
    check(`request ${i}: ok=true`, k.data.ok === true, `got ${k.data.ok}`);
    check(`request ${i}: source="teammate"`, k.data.source === "teammate", `got ${k.data.source}`);
  }

  console.log("\nK) Paid tier — 4th request rate-limited");
  const k4 = await post(reportBody(PAID_EMAIL), { "x-minute70-tier": "paid" });
  check("status 429", k4.status === 429, `got ${k4.status}`);
  check("ok=false", k4.data.ok === false, `got ${k4.data.ok}`);
  check('reason="limit"', k4.data.reason === "limit", `got ${k4.data.reason}`);
  check('source="teammate"', k4.data.source === "teammate", `got ${k4.data.source}`);
  check("daysRemaining 1-7", typeof k4.data.daysRemaining === "number" && k4.data.daysRemaining >= 1 && k4.data.daysRemaining <= 7, `got ${k4.data.daysRemaining}`);
  check("error is string", typeof k4.data.error === "string" && k4.data.error.length > 0, "missing error message");

  // Cleanup after tests
  await cleanup();

  // Summary
  console.log(`\n${passed} passed, ${failed} failed  (rate-limit E2E)\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Rate-limit sanity script crashed:", err.message);
  process.exit(1);
});
