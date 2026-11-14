import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { changePassword, MIN_PASSWORD_LENGTH } from "@/lib/db/accounts";
import { errorResponse, parseJsonBody } from "@/lib/api/handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  currentPassword: z.string().min(1, "Mevcut şifreyi giriniz").max(200),
  newPassword: z.string().min(MIN_PASSWORD_LENGTH, `Yeni şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı`).max(200),
});

/** Oturumdaki kullanıcının şifresini değiştirir. */
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const { currentPassword, newPassword } = await parseJsonBody(req, schema);
    await changePassword(session.userId, currentPassword, newPassword);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
