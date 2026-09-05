import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { restoreBackup } from "@/lib/db/reports";
import { invalidateSettingsCache } from "@/lib/db/settings";
import { backupRestoreSchema } from "@/lib/validation/settings";
import { errorResponse } from "@/lib/api/handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Restores a backup produced by /api/reports/backup (şartname §6.8).
 *
 * `?mode=replace` clears the user's own rows first and needs an explicit
 * confirm token, because it is destructive. The default merges additively.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const url = new URL(req.url);
    const replace = url.searchParams.get("mode") === "replace";

    if (replace && url.searchParams.get("confirm") !== "VERILERIMI_DEGISTIR") {
      return NextResponse.json(
        {
          error:
            "Değiştirmeli geri yükleme mevcut kayıtlarınızı siler. Onaylamak için confirm=VERILERIMI_DEGISTIR ekleyin.",
        },
        { status: 428 }
      );
    }

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return NextResponse.json({ error: "Yedek dosyası geçerli bir JSON değil" }, { status: 400 });
    }

    const payload = backupRestoreSchema.parse(raw);
    const report = await restoreBackup(session.userId, payload, { replace });
    invalidateSettingsCache(session.userId);

    return NextResponse.json({
      success: true,
      mode: replace ? "replace" : "merge",
      report,
      message: `Geri yükleme tamamlandı: ${report.debts} borç, ${report.incomes} gelir, ${report.expenses} gider.`,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
