import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { getCurrentSession } from "@/lib/auth";
import { getDebts } from "@/lib/db/debts";
import { getSettings } from "@/lib/db/settings";
import { getGoldPrices } from "@/lib/gold/goldService";
import { buildPortfolioSummary } from "@/lib/finance/debtValuation";
import { OverduePageClient } from "@/components/live/OverduePageClient";
import type { GoldSyncResult } from "@/lib/gold/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Gecikmiş Ödemeler | Borç Ölçme",
};

export default async function OverduePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const [debts, settings] = await Promise.all([
    getDebts(session.userId),
    getSettings(session.userId),
  ]);

  let gold: GoldSyncResult | null = null;
  try {
    gold = await getGoldPrices();
  } catch {
    gold = null;
  }

  const portfolio = buildPortfolioSummary(debts, gold, settings);

  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          aria-label="Geri"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-300 transition-colors hover:text-white active:scale-95"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
            Gecikmiş Ödemeler
          </h1>
          <p className="text-xs text-zinc-400">
            Vadesi geçmiş ve hâlâ ödenmemiş tüm kalemler
          </p>
        </div>
      </div>

      <OverduePageClient
        initialPayments={portfolio.overduePayments}
        initialUpcoming={portfolio.upcomingPayments.filter((p) => !p.isOverdue)}
        initialOverdueTL={portfolio.overdueTL}
      />
    </div>
  );
}
