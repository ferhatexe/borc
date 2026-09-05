import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { archiveExpense, deleteExpensePermanently } from "@/lib/db/transactions";
import { errorResponse } from "@/lib/api/handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const deleteQuerySchema = z.object({
  permanent: z.coerce.boolean().default(false),
  confirm: z.string().optional(),
});

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await props.params;
    const { permanent, confirm } = deleteQuerySchema.parse(
      Object.fromEntries(new URL(req.url).searchParams.entries())
    );

    if (permanent) {
      if (confirm !== "KALICI_SIL") {
        return NextResponse.json(
          { error: "Kalıcı silme için confirm=KALICI_SIL onayı gerekir." },
          { status: 428 }
        );
      }
      await deleteExpensePermanently(session.userId, id);
      return NextResponse.json({ success: true, message: "Gider kaydı kalıcı olarak silindi" });
    }

    await archiveExpense(session.userId, id);
    return NextResponse.json({ success: true, message: "Gider kaydı arşive kaldırıldı" });
  } catch (error) {
    return errorResponse(error);
  }
}
