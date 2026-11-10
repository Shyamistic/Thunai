import { useEffect, useRef } from "react";

/** Mirrored bar waveform drawn from a live AnalyserNode. */
export function Waveform({ analyser, color, active, height = 64 }: { analyser: AnalyserNode | null; color: string; active: boolean; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const bars = useRef<number[]>(Array(48).fill(0));

  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    let raf = 0;
    const data = new Uint8Array(1024);
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = c.clientWidth;
      const h = c.clientHeight;
      if (c.width !== w * dpr) {
        c.width = w * dpr;
        c.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const n = bars.current.length;
      let level = 0;
      if (analyser && active) {
        analyser.getByteTimeDomainData(data);
        let s = 0;
        for (let i = 0; i < analyser.fftSize; i++) {
          const v = (data[i] - 128) / 128;
          s += v * v;
        }
        level = Math.min(1, Math.sqrt(s / analyser.fftSize) * 5.5);
      }
      bars.current.shift();
      bars.current.push(active ? Math.max(0.04, level * (0.6 + Math.random() * 0.5)) : 0.03 + Math.sin(performance.now() / 600) * 0.01);
      const gap = 3;
      const bw = (w - gap * (n - 1)) / n;
      for (let i = 0; i < n; i++) {
        const v = bars.current[i];
        const bh = Math.max(2, v * h * 0.9);
        const x = i * (bw + gap);
        const alpha = 0.25 + (i / n) * 0.75;
        ctx.fillStyle = color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.roundRect(x, (h - bh) / 2, bw, bh, bw / 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [analyser, color, active]);

  return <canvas ref={ref} className="w-full" style={{ height }} />;
}
