/**
 * Deletes all rows from dev database tables used by sanity tests.
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 * ORDER matters — child tables deleted before parents.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const envFile = readFileSync(resolve(__dirname, "..", ".env.local"), "utf-8");
const env: Record<string, string> = {};
for (const line of envFile.split("\n")) {
  const m = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/);
  if (m) env[m[1]] = m[2];
}

const SUPABASE_URL = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_KEY);

const TABLES = [
  // Children first
  "session_events",
  "sessions",
  "plans",
  "promo_redemptions",
  "entitlements",
  "user_profiles",
  "report_events",
  "weekly_report_followups",
  "weekly_report_requests",
  "waitlist_signups",
];

async function run() {
  console.log(`\nResetting dev DB — ${SUPABASE_URL}\n`);

  // Tables that use user_id as PK instead of id
  const USER_ID_PK_TABLES = new Set(["user_profiles"]);

  for (const table of TABLES) {
    const pkCol = USER_ID_PK_TABLES.has(table) ? "user_id" : "id";
    const { error, count } = await db.from(table).delete({ count: "exact" }).neq(pkCol, "00000000-0000-0000-0000-000000000000");
    if (error) {
      console.error(`  FAIL  ${table} — ${error.message}`);
    } else {
      console.log(`  OK    ${table} (${count ?? "?"} rows deleted)`);
    }
  }

  console.log("\nDone.\n");
}

run().catch((err) => {
  console.error("Reset script crashed:", err.message);
  process.exit(1);
});
