"use client";

import { useEffect, useRef } from "react";

interface Dot {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  a: number;
}

/**
 * Sayfanın arkasında yavaşça süzülen noktalar.
 *
 * Birkaç büyük, çok sayıda küçük nokta; imleçle hafif bir derinlik kayması
 * (büyük nokta daha çok kayar). Renk `--dot` değişkeninden okunur, tema
 * değişince güncellenir.
 *
 * Maliyet: tek canvas, ~60-110 nokta. Sekme gizliyken döngü durur;
 * `prefers-reduced-motion` açıksa noktalar bir kez çizilir ve kıpırdamaz.
 * Mobilde adres çubuğu açılıp kapandıkça yükseklik değişir - noktalar o
 * yüzden yalnızca genişlik değişince yeniden dağıtılır, yoksa her
 * kaydırmada yerinden zıplarlardı.
 */
export function DotField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    let raf = 0;
    let dots: Dot[] = [];
    let mx = 0;
    let my = 0;
    let tx = 0;
    let ty = 0;

    const readColor = () =>
      getComputedStyle(document.documentElement).getPropertyValue("--dot").trim() || "20,20,20";
    let rgb = readColor();

    const seed = () => {
      const n = Math.round(Math.max(40, Math.min(110, (w * h) / 14000)));
      dots = Array.from({ length: n }, () => {
        const big = Math.random() < 0.16;
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          r: big ? 2.2 + Math.random() * 2 : 0.6 + Math.random() * 0.9,
          vx: (Math.random() - 0.5) * 0.12,
          vy: (Math.random() - 0.5) * 0.12,
          a: big ? 0.85 : 0.3 + Math.random() * 0.35,
        };
      });
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const d of dots) {
        const depth = d.r / 3;
        ctx.beginPath();
        ctx.arc(d.x + mx * depth, d.y + my * depth, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb},${d.a})`;
        ctx.fill();
      }
    };

    const resize = () => {
      const widthChanged = window.innerWidth !== w;
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (widthChanged || dots.length === 0) seed();
      draw();
    };

    const step = () => {
      mx += (tx - mx) * 0.05;
      my += (ty - my) * 0.05;
      for (const d of dots) {
        d.x += d.vx;
        d.y += d.vy;
        if (d.x < -6) d.x = w + 6;
        else if (d.x > w + 6) d.x = -6;
        if (d.y < -6) d.y = h + 6;
        else if (d.y > h + 6) d.y = -6;
      }
      draw();
      raf = requestAnimationFrame(step);
    };

    const onMove = (e: PointerEvent) => {
      tx = (e.clientX / w - 0.5) * 14;
      ty = (e.clientY / h - 0.5) * 14;
    };

    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduce) raf = requestAnimationFrame(step);
    };

    const themeObserver = new MutationObserver(() => {
      rgb = readColor();
      draw();
    });

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    if (!reduce) raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVisibility);
      themeObserver.disconnect();
    };
  }, []);

  return <canvas ref={ref} className="dot-field" aria-hidden="true" />;
}
