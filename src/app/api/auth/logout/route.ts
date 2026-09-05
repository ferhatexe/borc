import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ success: true, message: "Çıkış yapıldı" });
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    maxAge: 0,
    ...SESSION_COOKIE_OPTIONS,
  });
  return response;
}
