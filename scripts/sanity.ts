const BASE = "http://localhost:3000/api/weekly-report";
const EMAIL = `sanity-${Date.now()}@test.local`;

interface ApiResponse {
  ok: boolean;
  reason?: string;
  source?: string;
  daysRemaining?: number;
  followupScheduled?: boolean;
  statusLine?: string;
  planBullets?: string[];
  matchDayCue?: string;
  error?: string;
}

async function post(body: Record<string, unknown>): Promise<{ status: number; data: ApiResponse }> {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data: ApiResponse = await res.json();
  return { status: res.status, data };
}

const report = (overrides: Record<string, unknown> = {}) => ({
  email: EMAIL,
  matchDay: "Saturday",
  weeklyLoad: 3,
  legsStatus: "Fresh",
  tissueFocus: "Quads",
  includeSpeedExposure: false,
  recoveryMode: "Walk",
  ...overrides,
});

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

async function run() {
  console.log(`\nSanity tests — email: ${EMAIL}\n`);

  // A) Public first report — should succeed with plan
  console.log("A) Public first report");
  const a = await post(report());
  check("status 200", a.status === 200, `got ${a.status}`);
  check("ok=true", a.data.ok === true, `got ${a.data.ok}`);
  check('source="public"', a.data.source === "public", `got ${a.data.source}`);
  check("statusLine is string", typeof a.data.statusLine === "string", `got ${typeof a.data.statusLine}`);
  check("planBullets is array", Array.isArray(a.data.planBullets), `got ${typeof a.data.planBullets}`);
  check("planBullets.length >= 3", (a.data.planBullets?.length ?? 0) >= 3, `got ${a.data.planBullets?.length}`);
  check("matchDayCue is string", typeof a.data.matchDayCue === "string", `got ${typeof a.data.matchDayCue}`);

  // B) Public second report same email — should be rate-limited
  console.log("\nB) Public duplicate (rate-limit)");
  const b = await post(report());
  check("status 429", b.status === 429, `got ${b.status}`);
  check("ok=false", b.data.ok === false, `got ${b.data.ok}`);
  check('reason="limit"', b.data.reason === "limit", `got ${b.data.reason}`);
  check("daysRemaining is number", typeof b.data.daysRemaining === "number", `got ${b.data.daysRemaining}`);

  // C) Teammate report same email — should bypass limit
  console.log("\nC) Teammate bypass");
  const c = await post(report({ teammateCode: "ELMPARC2FREE", emailReminder: false }));
  check("status 200", c.status === 200, `got ${c.status}`);
  check("ok=true", c.data.ok === true, `got ${c.data.ok}`);
  check('source="teammate"', c.data.source === "teammate", `got ${c.data.source}`);

  // D) Teammate with followup checkbox
  console.log("\nD) Teammate follow-up scheduled");
  const d = await post(report({ teammateCode: "ELMPARC2FREE", emailReminder: true }));
  check("status 200", d.status === 200, `got ${d.status}`);
  check("ok=true", d.data.ok === true, `got ${d.data.ok}`);
  check("followupScheduled=true", d.data.followupScheduled === true, `got ${d.data.followupScheduled}`);

  // E) Speed exposure enriches plan
  console.log("\nE) Speed exposure adds bullet");
  const e2 = await post(report({
    email: `sanity-speed-${Date.now()}@test.local`,
    includeSpeedExposure: true,
  }));
  check("status 200", e2.status === 200, `got ${e2.status}`);
  check("has speed bullet", (e2.data.planBullets ?? []).some(b => b.toLowerCase().includes("sprint")), "no sprint bullet found");

  // Summary
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Sanity script crashed:", err.message);
  process.exit(1);
});
