import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { createCategory, getCategories } from "@/lib/db/categories";
import { createCategorySchema } from "@/lib/validation/transaction";
import { errorResponse, parseJsonBody, parseSearchParams } from "@/lib/api/handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const querySchema = z.object({
  type: z.enum(["GELIR", "GIDER"]).optional(),
  topLevelOnly: z.coerce.boolean().optional(),
});

// Previously this endpoint had no session check at all.
export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const filters = parseSearchParams(req.url, querySchema);
    return NextResponse.json(await getCategories(session.userId, filters));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const input = await parseJsonBody(req, createCategorySchema);
    const created = await createCategory(session.userId, input);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
