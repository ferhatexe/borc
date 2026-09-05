import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { getRawSettings, updateSetting } from "@/lib/db/settings";
import { resetGoldCache } from "@/lib/gold/goldService";
import { updateSettingsSchema } from "@/lib/validation/settings";
import { SETTING_KEYS, type SettingKey } from "@/lib/settings/defaults";
import { errorResponse, parseJsonBody } from "@/lib/api/handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Every configurable rate, margin and table the app reads at runtime. */
export async function GET() {
  try {
    const session = await requireSession();
    return NextResponse.json(await getRawSettings(session.userId));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireSession();
    const input = await parseJsonBody(req, updateSettingsSchema);

    const written: string[] = [];
    for (const [key, value] of Object.entries(input)) {
      if (value === undefined) continue;

      // Stamp the manual price block so the UI can show when it was last set.
      const payload =
        key === SETTING_KEYS.GOLD_MANUAL_PRICES
          ? { ...(value as Record<string, unknown>), updatedAt: new Date().toISOString() }
          : value;

      await updateSetting(session.userId, key as SettingKey, payload);
      written.push(key);
    }

    // Margins, millesimals and manual prices all feed the gold catalogue.
    if (written.some((k) => k.startsWith("gold_"))) resetGoldCache();

    return NextResponse.json({
      success: true,
      updated: written,
      settings: await getRawSettings(session.userId),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
