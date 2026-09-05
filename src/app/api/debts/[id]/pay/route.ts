import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { payInstallment } from "@/lib/db/debts";
import { payInstallmentSchema } from "@/lib/validation/debt";
import { errorResponse, parseJsonBody } from "@/lib/api/handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await props.params;
    const input = await parseJsonBody(req, payInstallmentSchema);

    // Ownership, double-payment and expense creation are all handled inside a
    // single database transaction.
    const result = await payInstallment(session.userId, id, input);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
