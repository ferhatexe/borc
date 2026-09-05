import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { getGoldPrices } from "@/lib/gold/goldService";
import { errorResponse } from "@/lib/api/handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Scheduled/manual gold price refresh.
 *
 * Excluded from the proxy session check, so it enforces its own auth. Three
 * callers are accepted:
 *   1. Vercel Cron, which sends `Authorization: Bearer $CRON_SECRET`
 *   2. Any external scheduler sending `x-cron-secret`
 *   3. A signed-in user pressing "Fiyatları Yenile"
 */
async function authorize(req: NextRequest): Promise<boolean> {
  const configured = process.env.CRON_SECRET;

  if (configured) {
    // Vercel Cron sets this header automatically when CRON_SECRET is defined.
    if (req.headers.get("authorization") === `Bearer ${configured}`) return true;
    if (req.headers.get("x-cron-secret") === configured) return true;
  }

  return (await getCurrentSession()) !== null;
}

async function handle(req: NextRequest) {
  try {
    if (!(await authorize(req))) {
      return NextResponse.json(
        { error: "Bu uç nokta için geçerli bir CRON_SECRET veya oturum gerekir" },
        { status: 401 }
      );
    }

    const result = await getGoldPrices(true);
    return NextResponse.json({
      success: true,
      message: "Altın fiyatları güncellendi.",
      source: result.source,
      sourceKind: result.sourceKind,
      fetchedAt: result.fetchedAt,
      itemCount: result.prices.length,
      warning: result.warning,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export const GET = handle;
export const POST = handle;
