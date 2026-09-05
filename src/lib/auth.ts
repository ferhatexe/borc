import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import {
  SESSION_MAX_AGE_SECONDS,
  SessionPayload,
  getJwtSecret,
  signSessionToken,
  verifySessionToken,
} from "./auth/jwt";

export const AUTH_COOKIE_NAME = "borcolcme_session";
export type { SessionPayload };
export { SESSION_MAX_AGE_SECONDS, signSessionToken, verifySessionToken, getJwtSecret };

const BCRYPT_ROUNDS = 12;

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Active session inside Server Components and Route Handlers.
 *
 * There is no "seed user" shortcut here any more. The old fallback let anyone
 * sign in with a compiled-in default password whenever SEED_USER_PASSWORD was
 * unset, and minted a token for a userId that did not exist in the database.
 */
export async function getCurrentSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    return await verifySessionToken(token);
  } catch {
    // A missing or too-short JWT_SECRET throws; treat it as "not signed in".
    return null;
  }
}

/** Session or a thrown 401 - convenience for route handlers. */
export class UnauthorizedError extends Error {
  constructor(message = "Yetkisiz erişim") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getCurrentSession();
  if (!session) throw new UnauthorizedError();
  return session;
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};
