import { NextResponse } from "next/server";
import { verifyJwt } from "@/lib/verify-jwt";
import { canStartSession } from "@/lib/entitlements";

export async function POST(request: Request) {
  const jwt = await verifyJwt(request);
  if (!jwt.ok) {
    return NextResponse.json({ ok: false, error: jwt.error }, { status: jwt.status });
  }

  const result = await canStartSession(jwt.userId);

  return NextResponse.json({
    ok: true,
    allowed: result.allowed,
    reason: result.reason,
    entitlementStatus: result.entitlementStatus,
  });
}
