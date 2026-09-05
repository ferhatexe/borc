import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { getGoldPrices } from "@/lib/gold/goldService";
import { errorResponse } from "@/lib/api/handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Manual/scheduled refresh trigger.
 *
 * The cron script now writes prices through the database directly, so this
 * endpoint exists for manual triggers and external schedulers. It is excluded
 * from the middleware session check and therefore enforces its own auth: either
 * a matching CRON_SECRET header or a normal signed-in session.
 */
async function authorize(req: NextRequest): Promise<boolean> {
  const configured = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret");
  if (configured && provided && provided === configured) return true;
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
