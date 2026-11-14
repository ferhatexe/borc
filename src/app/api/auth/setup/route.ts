import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_COOKIE_NAME, SESSION_COOKIE_OPTIONS, SESSION_MAX_AGE_SECONDS, signSessionToken } from "@/lib/auth";
import { completeSetup, MIN_PASSWORD_LENGTH } from "@/lib/db/accounts";
import { ensureDefaultSettings } from "@/lib/db/settings";
import { errorResponse, parseJsonBody } from "@/lib/api/handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  token: z.string().min(10).max(200),
  password: z.string().min(MIN_PASSWORD_LENGTH, `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı`).max(200),
});

/** Kurulum bağlantısıyla ilk şifreyi belirler ve oturumu açar. */
export async function POST(req: NextRequest) {
  try {
    const { token, password } = await parseJsonBody(req, schema);
    const user = await completeSetup(token, password);
    await ensureDefaultSettings(user.id);

    const session = await signSessionToken({ userId: user.id, email: user.email, name: user.name });
    const response = NextResponse.json({ success: true });
    response.cookies.set({ name: AUTH_COOKIE_NAME, value: session, maxAge: SESSION_MAX_AGE_SECONDS, ...SESSION_COOKIE_OPTIONS });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
