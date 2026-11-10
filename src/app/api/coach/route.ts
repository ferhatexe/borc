import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { errorResponse, parseJsonBody } from "@/lib/api/handler";
import { getCoachState, saveCoachState } from "@/lib/db/coach";
import { buildStreakView, checkIn, istanbulDay, recordGamble } from "@/lib/coach/streak";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("checkin") }),
  z.object({
    action: z.literal("gamble"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    amountTL: z.coerce.number().positive().max(100_000_000).nullable().optional(),
  }),
]);

/** Kumarsız gün serisinin bugünkü görünümü. */
export async function GET() {
  try {
    const session = await requireSession();
    const state = await getCoachState(session.userId);
    return NextResponse.json(buildStreakView(state, istanbulDay()));
  } catch (error) {
    return errorResponse(error);
  }
}

/** "Bugün oynamadım" işareti ya da oynanan bir günün bildirimi. */
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const input = await parseJsonBody(req, actionSchema);
    const today = istanbulDay();
    const state = await getCoachState(session.userId);

    const next =
      input.action === "checkin"
        ? checkIn(state, today)
        : recordGamble(state, input.date, input.amountTL ?? null, today);

    if (next !== state) await saveCoachState(session.userId, next);
    return NextResponse.json(buildStreakView(next, today));
  } catch (error) {
    return errorResponse(error);
  }
}
