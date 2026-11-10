import { haptics } from "@/lib/haptics";

/**
 * Kısa bir konfeti patlaması + kutlama titreşimi.
 *
 * Taksit ödendiğinde ve kumarsız gün işaretlendiğinde çağrılır. Kendi
 * tuvalini açar, ~1,6 sn sonra kaldırır; kütüphane yok. "Hareketi azalt"
 * tercihi açıksa yalnızca titreşim verir.
 */
export function celebrate(origin?: { x: number; y: number }): void {
  if (typeof window === "undefined") return;
  haptics.celebrate();
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const canvas = document.createElement("canvas");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    zIndex: "100",
  });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }
  ctx.scale(dpr, dpr);

  const ox = origin?.x ?? w / 2;
  const oy = origin?.y ?? h * 0.4;
  const colors = ["#10b981", "#f59e0b", "#141414", "#38bdf8", "#f43f5e", "#a78bfa"];
  const parts = Array.from({ length: 90 }, (_, i) => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 9;
    return {
      x: ox,
      y: oy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 5,
      size: 4 + Math.random() * 5,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      color: colors[i % colors.length],
    };
  });

  const DURATION = 1600;
  const start = performance.now();
  const frame = (now: number) => {
    const t = (now - start) / DURATION;
    ctx.clearRect(0, 0, w, h);
    if (t >= 1) {
      canvas.remove();
      return;
    }
    for (const p of parts) {
      p.vy += 0.32; // yerçekimi
      p.vx *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t * t);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
