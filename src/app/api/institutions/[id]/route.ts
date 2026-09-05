import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { deleteInstitution } from "@/lib/db/institutions";
import { errorResponse } from "@/lib/api/handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await props.params;
    await deleteInstitution(id);
    return NextResponse.json({ success: true, message: "Kurum silindi" });
  } catch (error) {
    return errorResponse(error);
  }
}
