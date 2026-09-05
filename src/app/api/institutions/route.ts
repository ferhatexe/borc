import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { createInstitution, getInstitutions } from "@/lib/db/institutions";
import { createInstitutionSchema } from "@/lib/validation/transaction";
import { errorResponse, parseJsonBody } from "@/lib/api/handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requireSession();
    return NextResponse.json(await getInstitutions(session.userId));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const input = await parseJsonBody(req, createInstitutionSchema);
    const created = await createInstitution(input);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
