import { motion } from "motion/react";

/** A pulli kolam: dots in a grid, one continuous loop around them. */
export function KolamMark({ size = 36, live = false }: { size?: number; live?: boolean }) {
  const dots = [
    [16, 6], [26, 16], [16, 26], [6, 16], [9, 9], [23, 9], [23, 23], [9, 23],
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      {dots.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={1.6} fill="var(--color-marigold)" opacity={0.9} />
      ))}
      <motion.path
        d="M16 3 C 24 3 29 8 29 16 C 29 24 24 29 16 29 C 8 29 3 24 3 16 C 3 10 7 5 12 4"
        fill="none"
        stroke="var(--color-chalk)"
        strokeWidth={1.6}
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.6, ease: "easeInOut" }}
      />
      <motion.circle
        cx={16}
        cy={16}
        r={3}
        fill="var(--color-p1)"
        animate={live ? { scale: [1, 1.5, 1], opacity: [1, 0.6, 1] } : { scale: 1 }}
        transition={{ duration: 1.4, repeat: live ? Infinity : 0 }}
      />
    </svg>
  );
}

export function Wordmark() {
  return (
    <div className="flex items-center gap-3">
      <KolamMark />
      <div className="leading-none">
        <div className="flex items-baseline gap-2">
          <span className="ta text-[22px] font-semibold text-jasmine">துணை</span>
          <span className="font-display text-[22px] font-extrabold tracking-wide text-chalk">THUNAI</span>
          <span className="font-display text-[22px] font-extrabold text-marigold">1913</span>
        </div>
        <div className="label mt-1 !text-[9.5px]">Greater Chennai flood line · AI call-taker</div>
      </div>
    </div>
  );
}
