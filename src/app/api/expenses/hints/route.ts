import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api/handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Kategori önerisi için kullanıcının son harcama tanımları ve kategorileri.
 * Yalnızca tanım ve kategori kimliği döner; tutar ve tarih gönderilmez.
 */
export async function GET() {
  try {
    const session = await requireSession();
    const rows = await prisma.expense.findMany({
      where: { userId: session.userId, isArchived: false, merchant: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 400,
      select: { merchant: true, categoryId: true },
    });
    return NextResponse.json(rows.filter((r) => r.merchant && r.merchant.trim()));
  } catch (error) {
    return errorResponse(error);
  }
}
