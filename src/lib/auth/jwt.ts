/**
 * HS256 JWT on the Web Crypto API.
 *
 * `jsonwebtoken` cannot run in the Edge runtime, which is why the middleware
 * used to check only that a session cookie EXISTED - anyone could set
 * `borcolcme_session=x` and walk past it. Web Crypto runs in both the Edge
 * middleware and Node route handlers, so the same real verification is used
 * everywhere.
 */

export interface SessionPayload {
  userId: string;
  email: string;
  name?: string | null;
}

interface JwtClaims extends SessionPayload {
  iat: number;
  exp: number;
}

const encoder = new TextEncoder();

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function jsonToBase64Url(value: unknown): string {
  return base64UrlEncode(encoder.encode(JSON.stringify(value)));
}

/**
 * The signing secret. There is no development fallback: a hardcoded default
 * would let anyone forge a session on a deployment that forgot to set it.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim().length < 32) {
    throw new Error(
      "JWT_SECRET tanımlı değil veya 32 karakterden kısa. Uygulama güvenli şekilde başlatılamaz."
    );
  }
  return secret;
}

async function getKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/** Constant-time comparison so a bad signature leaks no timing information. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 gün

export async function signSessionToken(
  payload: SessionPayload,
  secret: string = getJwtSecret(),
  maxAgeSeconds: number = SESSION_MAX_AGE_SECONDS
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const claims: JwtClaims = {
    userId: payload.userId,
    email: payload.email,
    name: payload.name ?? null,
    iat: now,
    exp: now + maxAgeSeconds,
  };

  const header = jsonToBase64Url({ alg: "HS256", typ: "JWT" });
  const body = jsonToBase64Url(claims);
  const signingInput = `${header}.${body}`;

  const signature = await crypto.subtle.sign("HMAC", await getKey(secret), encoder.encode(signingInput));
  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function verifySessionToken(
  token: string | undefined | null,
  secret: string = getJwtSecret()
): Promise<SessionPayload | null> {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;

  try {
    const headerJson = JSON.parse(new TextDecoder().decode(base64UrlDecode(header))) as {
      alg?: string;
    };
    // Reject "alg: none" and any algorithm swap outright.
    if (headerJson.alg !== "HS256") return null;

    const expected = new Uint8Array(
      await crypto.subtle.sign("HMAC", await getKey(secret), encoder.encode(`${header}.${body}`))
    );
    if (!timingSafeEqual(expected, base64UrlDecode(signature))) return null;

    const claims = JSON.parse(new TextDecoder().decode(base64UrlDecode(body))) as JwtClaims;
    if (typeof claims.exp !== "number" || claims.exp * 1000 <= Date.now()) return null;
    if (!claims.userId || !claims.email) return null;

    return { userId: claims.userId, email: claims.email, name: claims.name ?? null };
  } catch {
    return null;
  }
}
