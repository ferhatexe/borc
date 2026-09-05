/**
 * Web Vibration API (Haptik) Wrapper
 * Mobil cihazlarda dokunmatik geri bildirim sağlar.
 */

export type HapticType = "tap" | "success" | "error" | "warning" | "selection";

const HAPTIC_PATTERNS: Record<HapticType, number | number[]> = {
  tap: 10,
  selection: 6,
  success: [15, 45, 15],
  warning: [30, 30, 30],
  error: [50, 40, 50, 40, 50],
};

export function triggerHaptic(type: HapticType = "tap"): boolean {
  if (typeof window === "undefined" || !("vibrate" in navigator)) {
    return false;
  }

  try {
    const pattern = HAPTIC_PATTERNS[type];
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}

export const haptics = {
  tap: () => triggerHaptic("tap"),
  selection: () => triggerHaptic("selection"),
  success: () => triggerHaptic("success"),
  warning: () => triggerHaptic("warning"),
  error: () => triggerHaptic("error"),
};
