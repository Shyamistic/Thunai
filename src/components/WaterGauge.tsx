import { motion } from "motion/react";
import { LEVELS, type WaterLevel } from "../lib/types.ts";

/** A standing figure with the reported water level rising around it. */
export function WaterGauge({ level, size = 44 }: { level?: WaterLevel; size?: number }) {
  const h = LEVELS.find((l) => l.id === level)?.h ?? 0;
  const color = h >= 0.72 ? "var(--color-p1)" : h >= 0.52 ? "var(--color-p2)" : "var(--color-monsoon)";
  return (
    <svg width={size * 0.62} height={size} viewBox="0 0 31 50" aria-label={level ? `water at ${level}` : "water level unknown"}>
      <defs>
        <clipPath id="wg-body">
          <rect x="0" y="0" width="31" height="50" />
        </clipPath>
      </defs>
      <g fill="none" stroke="var(--color-mist)" strokeWidth="1.6" strokeLinecap="round">
        <circle cx="15.5" cy="6" r="4" />
        <path d="M15.5 10 v18 M15.5 14 l-8 8 M15.5 14 l8 8 M15.5 28 l-6 18 M15.5 28 l6 18" />
      </g>
      <motion.rect
        x="0"
        width="31"
        initial={{ y: 50, height: 0 }}
        animate={{ y: 50 - h * 50, height: h * 50 }}
        transition={{ type: "spring", stiffness: 60, damping: 14 }}
        fill={color}
        opacity={0.38}
        clipPath="url(#wg-body)"
      />
      <motion.line
        x1="0"
        x2="31"
        initial={{ y1: 50, y2: 50 }}
        animate={{ y1: 50 - h * 50, y2: 50 - h * 50 }}
        transition={{ type: "spring", stiffness: 60, damping: 14 }}
        stroke={color}
        strokeWidth="1.4"
        strokeDasharray="3 2"
        opacity={h ? 1 : 0}
      />
    </svg>
  );
}
