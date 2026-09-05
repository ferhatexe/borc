"use client";

import Decimal from "decimal.js";
import { CountUpNumber } from "./CountUpNumber";
import { formatCurrency } from "@/lib/formatters";

interface MoneyDisplayProps {
  amount: number | string | Decimal | null | undefined;
  currency?: "TRY" | "USD" | "EUR" | "XAU" | string;
  type?: "debt" | "income" | "gold" | "neutral";
  animated?: boolean;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
}

export function MoneyDisplay({
  amount = 0,
  currency = "TRY",
  type = "neutral",
  animated = true,
  size = "md",
  className = "",
}: MoneyDisplayProps) {
  const numValue = Number(amount?.toString() || 0);

  const colorClass =
    type === "debt"
      ? "text-red-400"
      : type === "income"
      ? "text-emerald-400"
      : type === "gold"
      ? "text-amber-400"
      : "text-zinc-100";

  const sizeClass =
    size === "sm"
      ? "text-sm"
      : size === "md"
      ? "text-base font-medium"
      : size === "lg"
      ? "text-lg font-semibold"
      : size === "xl"
      ? "text-2xl font-bold"
      : "text-3xl md:text-4xl font-extrabold";

  const symbol =
    currency === "TRY"
      ? " ₺"
      : currency === "USD"
      ? " $"
      : currency === "EUR"
      ? " €"
      : currency === "XAU"
      ? " Gr Altın"
      : ` ${currency}`;

  if (!animated) {
    return (
      <span className={`tabular-nums ${colorClass} ${sizeClass} ${className}`}>
        {formatCurrency(amount, currency)}
      </span>
    );
  }

  return (
    <span className={`tabular-nums ${colorClass} ${sizeClass} ${className}`}>
      <CountUpNumber value={numValue} suffix={symbol} decimals={2} />
    </span>
  );
}
