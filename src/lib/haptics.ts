/**
 * Dokunsal geri bildirim.
 *
 * İki yol var:
 *  - Android: Web Vibration API (`navigator.vibrate`), desenli titreşim.
 *  - iPhone: Safari Vibration API'yi hiç desteklemiyor; bu yüzden titreşim
 *    iPhone'da hiç çalışmıyordu. Safari 17.4+ `<input type="checkbox" switch>`
 *    değişince sistemin kendi hafif tıkını veriyor. Görünmez bir anahtarı
 *    tıklatarak o tık alınır; desenler art arda tıklarla taklit edilir.
 *    Yalnızca kullanıcı dokunuşunun içinden çağrılınca çalışır.
 */

export type HapticType = "tap" | "success" | "error" | "warning" | "selection" | "celebrate";

const HAPTIC_PATTERNS: Record<HapticType, number | number[]> = {
  tap: 10,
  selection: 6,
  success: [15, 45, 15],
  warning: [30, 30, 30],
  error: [50, 40, 50, 40, 50],
  celebrate: [12, 50, 12, 50, 12, 70, 40],
};

/** iPhone'da her desen için kaç tık ve aralarındaki süre (ms). */
const IOS_TICKS: Record<HapticType, number[]> = {
  tap: [0],
  selection: [0],
  success: [0, 110],
  warning: [0, 130, 260],
  error: [0, 90, 180],
  celebrate: [0, 100, 200, 340],
};

function iosTick(): void {
  const label = document.createElement("label");
  label.setAttribute("aria-hidden", "true");
  label.style.display = "none";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  label.appendChild(input);
  document.head.appendChild(label);
  label.click();
  document.head.removeChild(label);
}

function supportsIosTick(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches &&
    /iP(hone|ad|od)|Macintosh/.test(navigator.userAgent) &&
    "ontouchstart" in window
  );
}

export function triggerHaptic(type: HapticType = "tap"): boolean {
  if (typeof window === "undefined") return false;

  try {
    if ("vibrate" in navigator) return navigator.vibrate(HAPTIC_PATTERNS[type]);
    if (supportsIosTick()) {
      for (const delay of IOS_TICKS[type]) {
        if (delay === 0) iosTick();
        else window.setTimeout(iosTick, delay);
      }
      return true;
    }
    return false;
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
  celebrate: () => triggerHaptic("celebrate"),
};
