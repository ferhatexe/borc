"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Lightbulb } from "@phosphor-icons/react";
import { haptics } from "@/lib/haptics";
import type { Insight } from "@/lib/coach/insights";

const DOT: Record<Insight["tone"], string> = {
  urgent: "bg-rose-500",
  warn: "bg-amber-400",
  info: "bg-zinc-400",
  good: "bg-emerald-500",
};

/**
 * Rakamlardan hesaplanan bilgi kartları.
 *
 * Telefonda yatay, tek parmakla kaydırılan bir şerit (her kart ekrana oturur);
 * masaüstünde ızgara. Kartlar olgu söyler, ne ödeneceğine karar vermez.
 */
export function InsightCards({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null;

  return (
    <section aria-labelledby="insights-heading">
      <h2
        id="insights-heading"
        className="mb-2.5 flex items-center gap-1.5 px-0.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400"
      >
        <Lightbulb size={14} weight="fill" />
        Bugün bilmen gerekenler
      </h2>

      <div
        role="list"
        className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3 [&::-webkit-scrollbar]:hidden"
      >
        {insights.map((insight, index) => (
          <motion.article
            key={insight.id}
            role="listitem"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index, 5) * 0.05, duration: 0.25 }}
            className="glass-card flex w-[82%] shrink-0 snap-center flex-col p-4 sm:w-auto"
          >
            <div className="flex items-start gap-2">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[insight.tone]}`} />
              <h3 className="text-[13px] font-semibold leading-snug text-white">{insight.title}</h3>
            </div>
            {insight.figure && (
              <p className="mt-2 font-mono text-xl font-bold tabular-nums text-white">
                {insight.figure}
              </p>
            )}
            <p className="mt-1.5 flex-1 text-xs leading-relaxed text-zinc-400">{insight.body}</p>
            {insight.href && (
              <Link
                href={insight.href}
                onClick={() => haptics.selection()}
                className="mt-3 inline-flex items-center gap-1 self-start text-xs font-semibold text-white underline-offset-4 hover:underline"
              >
                {insight.linkLabel ?? "Aç"} <ArrowRight size={12} weight="bold" />
              </Link>
            )}
          </motion.article>
        ))}
      </div>

      <p className="mt-2 px-0.5 text-[10px] text-zinc-500">
        Bu kartlar kendi kayıtlarından hesaplanan bilgilerdir; yatırım ya da finans tavsiyesi
        değildir.
      </p>
    </section>
  );
}
