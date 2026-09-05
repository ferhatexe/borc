import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { createDebt, getDebts } from "@/lib/db/debts";
import { getSettings } from "@/lib/db/settings";
import { getGoldPrices } from "@/lib/gold/goldService";
import { buildPortfolioSummary } from "@/lib/finance/debtValuation";
import { createDebtSchema, DEBT_TYPES } from "@/lib/validation/debt";
import { errorResponse, parseJsonBody, parseSearchParams } from "@/lib/api/handler";
import type { GoldSyncResult } from "@/lib/gold/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const listQuerySchema = z.object({
  institutionId: z.string().trim().min(1).optional(),
  type: z.enum(DEBT_TYPES).optional(),
  status: z.enum(["AKTIF", "KAPANDI", "GECIKMIS", "ERTELENDI"]).optional(),
  includeArchived: z.coerce.boolean().optional(),
  /** Adds computed balances, accrued interest and due dates to the response. */
  withValuation: z.coerce.boolean().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const filters = parseSearchParams(req.url, listQuerySchema);
    const debts = await getDebts(session.userId, filters);

    if (!filters.withValuation) return NextResponse.json(debts);

    let gold: GoldSyncResult | null = null;
    try {
      gold = await getGoldPrices();
    } catch {
      gold = null;
    }
    const settings = await getSettings(session.userId);
    const portfolio = buildPortfolioSummary(debts, gold, settings);

    return NextResponse.json({
      debts,
      valuations: portfolio.valuations,
      totals: {
        totalDebtTL: portfolio.totalDebtTL,
        dueThisMonthTL: portfolio.dueThisMonthTL,
        overdueTL: portfolio.overdueTL,
        totalAccruedInterestTL: portfolio.totalAccruedInterestTL,
      },
      goldWarning: gold?.warning ?? null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const input = await parseJsonBody(req, createDebtSchema);
    const created = await createDebt(session.userId, input);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
