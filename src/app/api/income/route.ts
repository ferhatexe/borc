import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { createIncome, getIncomes } from "@/lib/db/transactions";
import { createIncomeSchema, listFilterSchema } from "@/lib/validation/transaction";
import { errorResponse, parseJsonBody, parseSearchParams } from "@/lib/api/handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const filters = parseSearchParams(req.url, listFilterSchema);
    return NextResponse.json(await getIncomes(session.userId, filters));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const input = await parseJsonBody(req, createIncomeSchema);
    const created = await createIncome(session.userId, input);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
