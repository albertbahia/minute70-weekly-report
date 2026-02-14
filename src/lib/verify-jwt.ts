import { jwtVerify, createRemoteJWKSet } from "jose";

export type JwtResult =
  | { ok: true; userId: string }
  | { ok: false; error: string; status: number };

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const jwks = supabaseUrl
  ? createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`))
  : null;

export async function verifyJwt(request: Request): Promise<JwtResult> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    return { ok: false, error: "Missing authorization token.", status: 401 };
  }

  if (!jwks) {
    return { ok: false, error: "Server configuration error.", status: 500 };
  }

  try {
    const { payload } = await jwtVerify(token, jwks);
    if (!payload.sub) {
      return { ok: false, error: "Invalid token: no subject.", status: 401 };
    }
    return { ok: true, userId: payload.sub };
  } catch {
    return { ok: false, error: "Invalid or expired token.", status: 401 };
  }
}
