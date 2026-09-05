"use client";

import { useEffect, useRef, useState } from "react";
import Decimal from "decimal.js";

interface CountUpNumberProps {
  value: number | string | Decimal;
  durationMs?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export function CountUpNumber({
  value,
  durationMs = 800,
  decimals = 2,
  prefix = "",
  suffix = "",
  className = "",
}: CountUpNumberProps) {
  const targetNum = Number(value?.toString() || 0);
  const [displayValue, setDisplayValue] = useState<number>(0);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const prevTargetRef = useRef<number>(0);

  useEffect(() => {
    const startVal = prevTargetRef.current;
    startTimeRef.current = null;

    const easeOutExpo = (x: number): number => {
      return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
    };

    const animate = (time: number) => {
      if (!startTimeRef.current) startTimeRef.current = time;
      const elapsed = time - startTimeRef.current;
      const progress = Math.min(elapsed / durationMs, 1);
      const eased = easeOutExpo(progress);

      const current = startVal + (targetNum - startVal) * eased;
      setDisplayValue(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(targetNum);
        prevTargetRef.current = targetNum;
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [targetNum, durationMs]);

  // Türkçe format (1.234,56)
  const isNegative = displayValue < 0;
  const abs = Math.abs(displayValue);
  const parts = abs.toFixed(decimals).split(".");
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const decPart = decimals > 0 ? `,${parts[1]}` : "";

  return (
    <span className={`tabular-nums font-medium ${className}`}>
      {prefix}
      {isNegative ? "-" : ""}
      {intPart}
      {decPart}
      {suffix}
    </span>
  );
}
