/**
 * Non-destructive smoke tests for minute70.com (or any target URL).
 *
 * Every check either:
 *  - Makes a read-only request (GET), or
 *  - Sends data that fails validation before any DB write (returns 4xx)
 *
 * No data is written to the database.
 *
 * Usage:
 *   npx tsx scripts/smoke-prod.ts                          # targets https://minute70.com
 *   npx tsx scripts/smoke-prod.ts http://localhost:3000    # targets local dev
 */

const BASE = process.argv[2]?.replace(/\/$/, "") ?? "https://minute70.com";

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

async function get(path: string, headers?: Record<string, string>) {
  const res = await fetch(`${BASE}${path}`, { headers });
  return { status: res.status };
}

async function post(
  path: string,
  body: Record<string, unknown>,
  headers?: Record<string, string>,
): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function run() {
  console.log(`\nSmoke tests — target: ${BASE}\n`);

  // -------------------------------------------------------------------------
  // A) Site reachable
  // -------------------------------------------------------------------------
  console.log("A) Site reachable");
  const a = await get("/");
  check("GET / returns 2xx or 3xx", a.status < 400, `got ${a.status}`);

  // -------------------------------------------------------------------------
  // B) Authenticated endpoints reject unauthenticated requests
  //    (read-only: no DB write, just auth check)
  // -------------------------------------------------------------------------
  console.log("\nB) Auth guard");
  const b1 = await get("/api/profile");
  check("GET /api/profile → 401 (no token)", b1.status === 401, `got ${b1.status}`);

  const b2 = await get("/api/plan");
  check("GET /api/plan → 401 (no token)", b2.status === 401, `got ${b2.status}`);

  const b3 = await get("/api/profile", { Authorization: "Bearer invalid-token" });
  check("GET /api/profile → 401 (bad token)", b3.status === 401, `got ${b3.status}`);

  // -------------------------------------------------------------------------
  // C) Waitlist validation (rejected before DB write)
  // -------------------------------------------------------------------------
  console.log("\nC) Waitlist validation");
  const c1 = await post("/api/waitlist", {});
  check("missing email → 400", c1.status === 400, `got ${c1.status}`);
  check("ok=false", c1.data.ok === false, `got ${c1.data.ok}`);

  const c2 = await post("/api/waitlist", { email: "not-an-email" });
  check("invalid email → 400", c2.status === 400, `got ${c2.status}`);
  check("ok=false", c2.data.ok === false, `got ${c2.data.ok}`);

  // -------------------------------------------------------------------------
  // D) Weekly report validation (rejected before DB write)
  // -------------------------------------------------------------------------
  console.log("\nD) Weekly report validation");
  const d1 = await post("/api/weekly-report", {});
  check("missing all fields → 400", d1.status === 400, `got ${d1.status}`);
  check("ok=false", d1.data.ok === false, `got ${d1.data.ok}`);

  const d2 = await post("/api/weekly-report", {
    email: "not-an-email",
    matchDay: "Saturday",
    legsStatus: "Fresh",
    tissueFocus: "Quads",
    recoveryMode: "Walk",
  });
  check("invalid email → 400", d2.status === 400, `got ${d2.status}`);

  const d3 = await post("/api/weekly-report", {
    email: "test@example.com",
    matchDay: "NotADay",
    legsStatus: "Fresh",
    tissueFocus: "Quads",
    recoveryMode: "Walk",
  });
  check("invalid matchDay → 400", d3.status === 400, `got ${d3.status}`);

  const d4 = await post("/api/weekly-report", {
    email: "test@example.com",
    matchDay: "Saturday",
    legsStatus: "Fresh",
    tissueFocus: "Quads",
    recoveryMode: "Walk",
    requestedMode: "invalid_mode",
  });
  check("invalid requestedMode → 400", d4.status === 400, `got ${d4.status}`);

  const d5 = await post("/api/weekly-report", {
    email: "test@example.com",
    matchDay: "Saturday",
    legsStatus: "Fresh",
    tissueFocus: "Quads",
    recoveryMode: "Walk",
    soreness: { hamstrings: 15, groinAdductors: 0, quadsCalves: 0 },
  });
  check("soreness out of range → 400", d5.status === 400, `got ${d5.status}`);

  // -------------------------------------------------------------------------
  // E) Events validation (rejected before DB write)
  // -------------------------------------------------------------------------
  console.log("\nE) Events validation");
  const e1 = await post("/api/events/report", { eventType: "invalid_event_type" });
  check("invalid event type → 400", e1.status === 400, `got ${e1.status}`);
  check("ok=false", e1.data.ok === false, `got ${e1.data.ok}`);

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Smoke test crashed:", err.message);
  process.exit(1);
});
