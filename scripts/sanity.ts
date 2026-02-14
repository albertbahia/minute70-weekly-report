const BASE = "http://localhost:3000/api/weekly-report";
const WAITLIST_BASE = "http://localhost:3000/api/waitlist";
const EMAIL = `sanity-${Date.now()}@test.local`;
const TEAMMATE_EMAIL_C = `sanity-tm-${Date.now()}@test.local`;
const TEAMMATE_EMAIL_D = `sanity-tmfu-${Date.now()}@test.local`;
const WAITLIST_EMAIL = `sanity-wl-${Date.now()}@test.local`;

interface Move {
  name: string;
  prescription: string;
  notes?: string;
}

interface SessionDetail {
  intensity: string;
  title: string;
  intent: string;
  durationMin: number;
  warmup: Move[];
  main: Move[];
  cooldown: Move[];
}

interface ApiResponse {
  ok: boolean;
  reason?: string;
  source?: string;
  status?: string;
  daysRemaining?: number;
  followupScheduled?: boolean;
  statusLine?: string;
  sessions?: SessionDetail[];
  matchDayCue?: string;
  error?: string;
}

async function postTo(url: string, body: Record<string, unknown>): Promise<{ status: number; data: ApiResponse }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data: ApiResponse = await res.json();
  return { status: res.status, data };
}

async function post(body: Record<string, unknown>): Promise<{ status: number; data: ApiResponse }> {
  return postTo(BASE, body);
}

const report = (overrides: Record<string, unknown> = {}) => ({
  email: EMAIL,
  matchDay: "Saturday",
  legsStatus: "Fresh",
  tissueFocus: "Quads",
  includeSpeedExposure: false,
  recoveryMode: "Walk",
  halfLengthMinutes: 25,
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
  check("sessions is array", Array.isArray(a.data.sessions), `got ${typeof a.data.sessions}`);
  check("sessions.length >= 1", (a.data.sessions?.length ?? 0) >= 1, `got ${a.data.sessions?.length}`);
  const firstSession = a.data.sessions?.[0];
  check("session has intensity", typeof firstSession?.intensity === "string", `got ${firstSession?.intensity}`);
  check("session has warmup array", Array.isArray(firstSession?.warmup), `got ${typeof firstSession?.warmup}`);
  check("session has main array", Array.isArray(firstSession?.main), `got ${typeof firstSession?.main}`);
  check("session has cooldown array", Array.isArray(firstSession?.cooldown), `got ${typeof firstSession?.cooldown}`);
  check("matchDayCue is string", typeof a.data.matchDayCue === "string", `got ${typeof a.data.matchDayCue}`);

  // B) Public second report same email — should be rate-limited
  console.log("\nB) Public duplicate (rate-limit)");
  const b = await post(report());
  check("status 429", b.status === 429, `got ${b.status}`);
  check("ok=false", b.data.ok === false, `got ${b.data.ok}`);
  check('reason="limit"', b.data.reason === "limit", `got ${b.data.reason}`);
  check("daysRemaining is number", typeof b.data.daysRemaining === "number", `got ${b.data.daysRemaining}`);

  // C) Teammate report — should succeed (separate email avoids DB trigger clash)
  console.log("\nC) Teammate bypass");
  const c = await post(report({ email: TEAMMATE_EMAIL_C, teammateCode: "ELMPARC2FREE", emailReminder: false }));
  check("status 200", c.status === 200, `got ${c.status}`);
  check("ok=true", c.data.ok === true, `got ${c.data.ok}`);
  check('source="teammate"', c.data.source === "teammate", `got ${c.data.source}`);

  // D) Teammate with followup checkbox
  console.log("\nD) Teammate follow-up scheduled");
  const d = await post(report({ email: TEAMMATE_EMAIL_D, teammateCode: "ELMPARC2FREE", emailReminder: true }));
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
  const hasSprintMove = (e2.data.sessions ?? []).some(s =>
    s.main.some(m => m.name.toLowerCase().includes("sprint"))
  );
  check("has sprint move", hasSprintMove, "no sprint move found in any session");

  // F) Waitlist — new signup
  console.log("\nF) Waitlist new signup");
  const f = await postTo(WAITLIST_BASE, { email: WAITLIST_EMAIL });
  check("status 200", f.status === 200, `got ${f.status}`);
  check("ok=true", f.data.ok === true, `got ${f.data.ok}`);
  check('status="ok"', f.data.status === "ok", `got ${f.data.status}`);

  // G) Waitlist — duplicate email (uniform response)
  console.log("\nG) Waitlist duplicate (uniform)");
  const g = await postTo(WAITLIST_BASE, { email: WAITLIST_EMAIL });
  check("status 200", g.status === 200, `got ${g.status}`);
  check("ok=true", g.data.ok === true, `got ${g.data.ok}`);
  check('status="ok"', g.data.status === "ok", `got ${g.data.status}`);

  // H) Waitlist — missing email rejected
  console.log("\nH) Waitlist missing email");
  const h = await postTo(WAITLIST_BASE, {});
  check("status 400", h.status === 400, `got ${h.status}`);
  check("ok=false", h.data.ok === false, `got ${h.data.ok}`);

  // I) Waitlist — invalid email rejected
  console.log("\nI) Waitlist invalid email");
  const i = await postTo(WAITLIST_BASE, { email: "not-an-email" });
  check("status 400", i.status === 400, `got ${i.status}`);
  check("ok=false", i.data.ok === false, `got ${i.data.ok}`);

  // J) Report with soreness + intent — new fields accepted
  console.log("\nJ) Report with soreness + intent");
  const SORENESS_EMAIL = `sanity-sore-${Date.now()}@test.local`;
  const j = await post(report({
    email: SORENESS_EMAIL,
    requestedMode: "balanced",
    soreness: { hamstrings: 3, groinAdductors: 2, quadsCalves: 1 },
  }));
  check("status 200", j.status === 200, `got ${j.status}`);
  check("ok=true", j.data.ok === true, `got ${j.data.ok}`);

  // K) Invalid soreness rejected
  console.log("\nK) Invalid soreness rejected");
  const BADSORE_EMAIL = `sanity-badsore-${Date.now()}@test.local`;
  const k = await post(report({
    email: BADSORE_EMAIL,
    requestedMode: "balanced",
    soreness: { hamstrings: 15, groinAdductors: 0, quadsCalves: 0 },
  }));
  check("status 400", k.status === 400, `got ${k.status}`);
  check("ok=false", k.data.ok === false, `got ${k.data.ok}`);

  // L) Event logging endpoint
  console.log("\nL) Event logging");
  const EVENTS_BASE = "http://localhost:3000/api/events/report";
  const l1 = await postTo(EVENTS_BASE, {
    eventType: "report_generated",
    payload: { requestedMode: "balanced", actualMode: "balanced", sorenessMax: 3 },
  });
  check("valid event 200", l1.status === 200, `got ${l1.status}`);
  check("ok=true", l1.data.ok === true, `got ${l1.data.ok}`);

  const l2 = await postTo(EVENTS_BASE, { eventType: "invalid_event" });
  check("invalid event 400", l2.status === 400, `got ${l2.status}`);
  check("ok=false", l2.data.ok === false, `got ${l2.data.ok}`);

  // Summary
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Sanity script crashed:", err.message);
  process.exit(1);
});
