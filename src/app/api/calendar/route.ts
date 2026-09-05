import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { getMonthCalendarEvents } from "@/lib/db/calendar";
import { errorResponse, parseSearchParams } from "@/lib/api/handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const now = () => new Date();

const querySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2200).default(() => now().getFullYear()),
  month: z.coerce.number().int().min(1).max(12).default(() => now().getMonth() + 1),
});

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const { year, month } = parseSearchParams(req.url, querySchema);
    return NextResponse.json(await getMonthCalendarEvents(session.userId, year, month));
  } catch (error) {
    return errorResponse(error);
  }
}
