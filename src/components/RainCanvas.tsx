import { useEffect, useRef } from "react";

/** Slanted monsoon rain over the map. Purely decorative, pointer-events off. */
export function RainCanvas({ intensity = 1 }: { intensity?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    let raf = 0;
    type Drop = { x: number; y: number; l: number; v: number; a: number };
    let drops: Drop[] = [];
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      c.width = c.clientWidth * dpr;
      c.height = c.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.floor((c.clientWidth * c.clientHeight) / 5200 * intensity);
      drops = Array.from({ length: n }, () => ({
        x: Math.random() * c.clientWidth,
        y: Math.random() * c.clientHeight,
        l: 8 + Math.random() * 16,
        v: 7 + Math.random() * 9,
        a: 0.08 + Math.random() * 0.22,
      }));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(c);
    const slant = 0.28;
    const tick = () => {
      const w = c.clientWidth;
      const h = c.clientHeight;
      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = "round";
      for (const d of drops) {
        ctx.strokeStyle = `rgba(170, 205, 220, ${d.a})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - d.l * slant, d.y + d.l);
        ctx.stroke();
        d.y += d.v;
        d.x -= d.v * slant;
        if (d.y > h) {
          d.y = -d.l;
          d.x = Math.random() * (w + 100);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [intensity]);
  return <canvas ref={ref} className="pointer-events-none absolute inset-0 z-[400] h-full w-full" />;
}
