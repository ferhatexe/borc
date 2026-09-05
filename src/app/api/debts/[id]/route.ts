import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import {
  archiveDebt,
  deleteDebtPermanently,
  getDebtById,
  restoreDebt,
  updateDebt,
} from "@/lib/db/debts";
import { getSettings } from "@/lib/db/settings";
import { getGoldPrices } from "@/lib/gold/goldService";
import { valuateDebt } from "@/lib/finance/debtValuation";
import { calculateEarlyPayoff } from "@/lib/finance/earlyPayoff";
import { updateDebtSchema } from "@/lib/validation/debt";
import { errorResponse, parseJsonBody } from "@/lib/api/handler";
import type { GoldSyncResult } from "@/lib/gold/types";
import { NotFoundError } from "@/lib/db/debts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, props: Ctx) {
  try {
    const session = await requireSession();
    const { id } = await props.params;

    // Scoped by userId: an id on its own is never enough to read a record.
    const debt = await getDebtById(session.userId, id);
    if (!debt) throw new NotFoundError("Borç kaydı bulunamadı");

    let gold: GoldSyncResult | null = null;
    try {
      gold = await getGoldPrices();
    } catch {
      gold = null;
    }
    const settings = await getSettings(session.userId);
    const valuation = valuateDebt(debt, gold, settings);

    let earlyPayoff = null;
    if (debt.type === "TAKSITLI_KREDI" && debt.installmentSchedules.length > 0) {
      const rows = debt.installmentSchedules.map((s) => ({
        installmentNo: s.installmentNo,
        dueDate: new Date(s.dueDate),
        totalPayment: s.totalAmount as never,
        principalPayment: s.principalPart as never,
        interestPayment: s.interestPart as never,
        kkdfPayment: 0 as never,
        bsmvPayment: 0 as never,
        remainingPrincipal: s.remainingPrincipal as never,
      }));
      earlyPayoff = calculateEarlyPayoff({
        remainingPrincipal: valuation.principalTL,
        amortizationSchedule: rows,
        paidInstallmentCount: valuation.paidInstallments ?? 0,
        penaltyRate: settings.taxRates.earlyPayoffPenaltyRate,
      });
    }

    return NextResponse.json({
      debt,
      valuation,
      earlyPayoff,
      goldWarning: gold?.warning ?? null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(req: NextRequest, props: Ctx) {
  try {
    const session = await requireSession();
    const { id } = await props.params;
    const input = await parseJsonBody(req, updateDebtSchema);
    const updated = await updateDebt(session.userId, id, input);
    return NextResponse.json(updated);
  } catch (error) {
    return errorResponse(error);
  }
}

const deleteQuerySchema = z.object({
  /** Soft delete unless `permanent=true`; the UI asks a second time first. */
  permanent: z.coerce.boolean().default(false),
  confirm: z.string().optional(),
});

export async function DELETE(req: NextRequest, props: Ctx) {
  try {
    const session = await requireSession();
    const { id } = await props.params;
    const { permanent, confirm } = deleteQuerySchema.parse(
      Object.fromEntries(new URL(req.url).searchParams.entries())
    );

    if (permanent) {
      if (confirm !== "KALICI_SIL") {
        return NextResponse.json(
          {
            error:
              "Kalıcı silme için ikinci onay gerekir. İsteğe confirm=KALICI_SIL parametresini ekleyin.",
          },
          { status: 428 }
        );
      }
      await deleteDebtPermanently(session.userId, id);
      return NextResponse.json({ success: true, message: "Borç kalıcı olarak silindi" });
    }

    await archiveDebt(session.userId, id);
    return NextResponse.json({ success: true, message: "Borç arşive kaldırıldı" });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(_req: NextRequest, props: Ctx) {
  try {
    const session = await requireSession();
    const { id } = await props.params;
    await restoreDebt(session.userId, id);
    return NextResponse.json({ success: true, message: "Borç arşivden geri alındı" });
  } catch (error) {
    return errorResponse(error);
  }
}
