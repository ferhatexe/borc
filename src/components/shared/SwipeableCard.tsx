"use client";

import { useState } from "react";
import { motion, useMotionValue, useTransform } from "motion/react";
import { CheckCircle, ArrowRight } from "@phosphor-icons/react";
import { triggerHaptic } from "@/lib/haptics";

interface SwipeableCardProps {
  children: React.ReactNode;
  onSwipeRight?: () => void; // Hızlı Ödeme
  onSwipeLeft?: () => void;  // Detay / Sil
  rightActionLabel?: string;
  leftActionLabel?: string;
}

export function SwipeableCard({
  children,
  onSwipeRight,
  onSwipeLeft,
  rightActionLabel = "Öde",
  leftActionLabel = "Detay",
}: SwipeableCardProps) {
  const x = useMotionValue(0);
  const [hasHapticFired, setHasHapticFired] = useState(false);

  // Sağa kaydırma (yeşil zemin) opaklığı: 0 -> 100px
  const rightActionOpacity = useTransform(x, [20, 70], [0, 1]);
  // Sola kaydırma (mavi/kırmızı zemin) opaklığı: 0 -> -100px
  const leftActionOpacity = useTransform(x, [-20, -70], [0, 1]);

  const handleDrag = (_: any, info: any) => {
    const offset = info.offset.x;
    if (Math.abs(offset) > 60 && !hasHapticFired) {
      triggerHaptic("selection");
      setHasHapticFired(true);
    } else if (Math.abs(offset) <= 60 && hasHapticFired) {
      setHasHapticFired(false);
    }
  };

  const handleDragEnd = (_: any, info: any) => {
    const offset = info.offset.x;
    setHasHapticFired(false);

    if (offset > 80 && onSwipeRight) {
      triggerHaptic("success");
      onSwipeRight();
    } else if (offset < -80 && onSwipeLeft) {
      triggerHaptic("selection");
      onSwipeLeft();
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl select-none group">
      {/* Sol Arka Plan: Sağa kaydırıldığında görünen "Hızlı Öde" */}
      <motion.div
        style={{ opacity: rightActionOpacity }}
        className="absolute inset-y-0 left-0 w-1/2 flex items-center gap-2 pl-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-bold text-xs rounded-l-2xl pointer-events-none"
      >
        <CheckCircle size={20} weight="fill" />
        <span>{rightActionLabel}</span>
      </motion.div>

      {/* Sağ Arka Plan: Sola kaydırıldığında görünen "Detay" */}
      <motion.div
        style={{ opacity: leftActionOpacity }}
        className="absolute inset-y-0 right-0 w-1/2 flex items-center justify-end gap-2 pr-5 bg-gradient-to-l from-cyan-600 to-blue-700 text-white font-bold text-xs rounded-r-2xl pointer-events-none"
      >
        <span>{leftActionLabel}</span>
        <ArrowRight size={20} weight="bold" />
      </motion.div>

      {/* Ön Katman: Sürüklenebilir Kart */}
      <motion.div
        style={{ x }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.25}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        className="relative z-10 bg-zinc-900/90 rounded-2xl touch-pan-y"
      >
        {children}
      </motion.div>
    </div>
  );
}
