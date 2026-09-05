import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getGoldPrices } from "@/lib/gold/goldService";
import { errorResponse } from "@/lib/api/handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Requires a session: a public force-refresh endpoint let anyone hammer the
 *  upstream price providers on the app's behalf. */
export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const force = new URL(req.url).searchParams.get("force") === "true";
    return NextResponse.json(await getGoldPrices(force));
  } catch (error) {
    return errorResponse(error);
  }
}

/** "Fiyatları Yenile" button. */
export async function POST() {
  try {
    await requireSession();
    return NextResponse.json(await getGoldPrices(true));
  } catch (error) {
    return errorResponse(error);
  }
}
