import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { deleteCategory, updateCategory } from "@/lib/db/categories";
import { createCategorySchema } from "@/lib/validation/transaction";
import { errorResponse, parseJsonBody } from "@/lib/api/handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, props: Ctx) {
  try {
    const session = await requireSession();
    const { id } = await props.params;
    const input = await parseJsonBody(req, createCategorySchema.partial());
    return NextResponse.json(await updateCategory(session.userId, id, input));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_req: NextRequest, props: Ctx) {
  try {
    const session = await requireSession();
    const { id } = await props.params;
    await deleteCategory(session.userId, id);
    return NextResponse.json({ success: true, message: "Kategori silindi" });
  } catch (error) {
    return errorResponse(error);
  }
}
