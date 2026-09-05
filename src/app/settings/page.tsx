import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { getRawSettings } from "@/lib/db/settings";
import { getCategories } from "@/lib/db/categories";
import { getInstitutions } from "@/lib/db/institutions";
import { getGoldPrices } from "@/lib/gold/goldService";
import { SettingsClient } from "@/components/settings/SettingsClient";
import { DEFAULT_SETTINGS } from "@/lib/settings/defaults";
import type { GoldSyncResult } from "@/lib/gold/types";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const [raw, categories, institutions] = await Promise.all([
    getRawSettings(session.userId),
    getCategories(session.userId),
    getInstitutions(session.userId),
  ]);

  let gold: GoldSyncResult | null = null;
  try {
    gold = await getGoldPrices();
  } catch {
    gold = null;
  }

  const settings = {
    taxRates: { ...DEFAULT_SETTINGS.taxRates, ...(raw.tax_rates as object) },
    goldMargins: { ...DEFAULT_SETTINGS.goldMargins, ...(raw.gold_margins as object) },
    goldMillesimal: {
      ...DEFAULT_SETTINGS.goldMillesimal,
      ...(raw.gold_karat_millesimal as object),
    },
    goldUnitGrams: { ...DEFAULT_SETTINGS.goldUnitGrams, ...(raw.gold_unit_grams as object) },
    goldManualPrices: {
      ...DEFAULT_SETTINGS.goldManualPrices,
      ...(raw.gold_manual_prices as object),
    },
    appPreferences: { ...DEFAULT_SETTINGS.appPreferences, ...(raw.app_preferences as object) },
  };

  return (
    <SettingsClient
      initialSettings={settings}
      categories={categories.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        parentId: c.parentId,
        color: c.color,
        icon: c.icon,
        isSystem: c.isSystem,
      }))}
      institutions={institutions}
      goldStatus={
        gold
          ? {
              source: gold.source,
              sourceKind: gold.sourceKind,
              fetchedAt: gold.fetchedAt,
              warning: gold.warning,
              pureGramSellTL: gold.pureGramSellTL,
            }
          : null
      }
    />
  );
}
