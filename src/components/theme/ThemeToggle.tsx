"use client";

import { motion, AnimatePresence } from "motion/react";
import { Sun, Moon } from "@phosphor-icons/react";
import { haptics } from "@/lib/haptics";
import { useTheme } from "./ThemeProvider";

/**
 * Koyu / açık tema düğmesi (masaüstü başlık çubuğu).
 *
 * Telefonda aynı işi alt çubuktaki hücre yapıyor; burada olması şart çünkü
 * `md` ve üstünde alt çubuk gizli.
 */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={() => {
        haptics.tap();
        toggleTheme();
      }}
      aria-label={theme === "dark" ? "Açık temaya geç" : "Koyu temaya geç"}
      title={theme === "dark" ? "Açık tema" : "Koyu tema"}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-300 transition-colors hover:bg-white/10 touch-feedback"
    >
      <span className="relative flex h-4 w-4 items-center justify-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={theme}
            initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="absolute"
          >
            {theme === "dark" ? (
              <Sun size={16} weight="fill" className="text-amber-400" />
            ) : (
              <Moon size={16} weight="fill" className="text-indigo-400" />
            )}
          </motion.span>
        </AnimatePresence>
      </span>
    </button>
  );
}
