import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  AUTH_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  SESSION_MAX_AGE_SECONDS,
  signSessionToken,
  verifyPassword,
} from "@/lib/auth";
import { ensureDefaultSettings } from "@/lib/db/settings";
import { errorResponse, parseJsonBody } from "@/lib/api/handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Geçerli bir e-posta adresi giriniz"),
  password: z.string().min(1, "Şifre alanı boş bırakılamaz"),
});

/**
 * Credentials are checked against the database only. The previous version fell
 * back to comparing the plaintext password against SEED_USER_PASSWORD, which
 * had a compiled-in default value, so any deployment that had not set that
 * variable was left with a publicly known login.
 */
export async function POST(req: NextRequest) {
  try {
    const { email, password } = await parseJsonBody(req, loginSchema);

    const user = await prisma.user.findUnique({ where: { email } });

    // Always run a comparison so a missing user and a wrong password take the
    // same amount of time.
    const passwordHash = user?.passwordHash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidiu";
    const isValid = await verifyPassword(password, passwordHash);

    if (!user || !isValid) {
      return NextResponse.json({ error: "E-posta veya şifre hatalı" }, { status: 401 });
    }

    await ensureDefaultSettings(user.id);

    const token = await signSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, currency: user.currency },
    });

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      maxAge: SESSION_MAX_AGE_SECONDS,
      ...SESSION_COOKIE_OPTIONS,
    });

    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
