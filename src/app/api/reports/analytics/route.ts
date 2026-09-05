import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getAnalyticsSummary } from "@/lib/db/reports";
import { errorResponse } from "@/lib/api/handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requireSession();
    return NextResponse.json(await getAnalyticsSummary(session.userId));
  } catch (error) {
    return errorResponse(error);
  }
}
