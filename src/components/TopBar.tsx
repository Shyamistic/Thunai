import { NavLink } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { Radio, FlaskConical, ShieldAlert, Workflow } from "lucide-react";
import { Wordmark } from "./Brand.tsx";
import { useNow } from "../lib/api.ts";
import type { Ticket } from "../lib/types.ts";

function Stat({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="flex flex-col items-end">
      <div className="label !text-[9px]">{label}</div>
      <AnimatePresence mode="popLayout">
        <motion.div
          key={String(value)}
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 10, opacity: 0 }}
          className="font-display text-[26px] font-extrabold leading-none tabular-nums"
          style={{ color }}
        >
          {value}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

const TICKER = [
  "CYCLONE WATCH · Bay of Bengal system may intensify into a cyclonic storm next week",
  "1913 lines at capacity · Thunai answering overflow calls",
  "Prisma v3.0 · codemix · ta-IN, en-IN, hi-IN, te-IN · 175 Chennai keyterms",
  "Timbre v3.0 · voice Kalpana · scripted replies only, never generated",
  "SYNTHETIC DEMO DATA · no real callers, numbers or recordings",
];

export function TopBar({ tickets }: { tickets: Ticket[] }) {
  const now = useNow();
  const ist = new Date(now).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const open = tickets.filter((t) => t.status !== "resolved");
  const live = tickets.filter((t) => t.status === "live").length;
  const p1 = open.filter((t) => t.priority === 1).length;
  const p2 = open.filter((t) => t.priority === 2).length;

  return (
    <header className="relative z-20 flex h-[64px] shrink-0 items-center gap-6 border-b hairline bg-ink-950/80 px-5 backdrop-blur">
      <Wordmark />

      <div className="relative mx-2 hidden h-8 flex-1 overflow-hidden rounded-full border hairline bg-ink-900/70 lg:block">
        <div className="absolute inset-y-0 left-0 z-10 flex items-center gap-2 rounded-full bg-[#2a120e] px-3 text-p1 shadow-[8px_0_12px_4px_#081016]">
          <ShieldAlert size={14} />
          <span className="font-mono text-[10.5px] tracking-[0.16em]">ALERT</span>
        </div>
        <div className="flex h-full w-max animate-marquee items-center whitespace-nowrap pl-28 font-mono text-[11px] tracking-wide text-mist">
          {[...TICKER, ...TICKER].map((t, i) => (
            <span key={i} className="mx-6 flex items-center gap-6">
              {t}
              <span className="text-marigold">◆</span>
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-6">
        <Stat label="On call" value={live} color="var(--color-marigold)" />
        <Stat label="P1 open" value={p1} color="var(--color-p1)" />
        <Stat label="P2 open" value={p2} color="var(--color-p2)" />
        <Stat label="Tickets" value={tickets.length} />
        <div className="h-9 w-px bg-line" />
        <div className="flex flex-col items-end">
          <div className="label !text-[9px]">Chennai · IST</div>
          <div className="font-mono text-[17px] tabular-nums text-chalk">{ist}</div>
        </div>
        <nav className="ml-1 flex rounded-full border hairline bg-ink-900 p-1">
          {[
            { to: "/", label: "Control room", icon: Radio },
            { to: "/lab", label: "Noise lab", icon: FlaskConical },
            { to: "/how", label: "How it works", icon: Workflow },
          ].map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                `flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition ${isActive ? "bg-marigold text-ink-950" : "text-mist hover:text-chalk"}`
              }
            >
              <Icon size={13} />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
