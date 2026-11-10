import { AnimatePresence, motion } from "motion/react";
import { Check, MapPin, Users, HeartPulse, LifeBuoy, AlertTriangle } from "lucide-react";
import { HAZARD_LABEL, LEVELS, NEED_LABEL, PRIORITY, VULN_LABEL, type Ticket } from "../lib/types.ts";
import { WaterGauge } from "./WaterGauge.tsx";

function Field({ icon, label, filled, children }: { icon: React.ReactNode; label: string; filled: boolean; children: React.ReactNode }) {
  return (
    <motion.div layout className={`flex min-h-[46px] items-start gap-2.5 rounded-xl border px-3 py-2 transition-colors ${filled ? "border-line bg-ink-800/80" : "border-dashed border-line/70 bg-transparent"}`}>
      <div className={`mt-0.5 ${filled ? "text-marigold" : "text-fog"}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="label flex items-center gap-1.5 !text-[9px]">
          {label}
          {filled && (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-p3">
              <Check size={10} strokeWidth={3} />
            </motion.span>
          )}
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={String(filled)} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="text-[13px] leading-snug">
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export function LiveTicket({ ticket }: { ticket: Ticket | null }) {
  const p = ticket ? PRIORITY[ticket.priority] : null;
  const level = LEVELS.find((l) => l.id === ticket?.waterLevel);
  const extras = ticket ? [...ticket.hazards.map((h) => HAZARD_LABEL[h]), ...ticket.needs.map((n) => NEED_LABEL[n])].filter(Boolean) : [];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="label">Live ticket</div>
        {ticket && <div className="font-mono text-[11px] text-mist">{ticket.id}</div>}
      </div>

      <Field icon={<MapPin size={15} />} label="Area · landmark" filled={Boolean(ticket?.locality)}>
        {ticket?.locality ? (
          <div>
            <span className="ta font-semibold text-jasmine">{ticket.locality.ta}</span> <span className="text-mist">{ticket.locality.en}</span>
            {ticket.landmark && <div className="truncate text-[12px] text-fog">near {ticket.landmark}</div>}
            <div className={`mt-0.5 text-[11px] ${ticket.localityConfirmed ? "text-p3" : "text-p2"}`}>{ticket.localityConfirmed ? "Read back · caller confirmed" : "Awaiting read-back"}</div>
          </div>
        ) : (
          <span className="text-fog">listening…</span>
        )}
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field icon={<WaterGauge level={ticket?.waterLevel} size={26} />} label="Water" filled={Boolean(level)}>
          {level ? (
            <span>
              {level.en} <span className="ta text-fog">· {level.ta}</span>
            </span>
          ) : (
            <span className="text-fog">—</span>
          )}
        </Field>
        <Field icon={<Users size={15} />} label="People" filled={ticket?.people !== undefined}>
          {ticket?.people !== undefined ? <span className="font-display text-[20px] font-extrabold leading-none">{ticket.people}</span> : <span className="text-fog">—</span>}
        </Field>
      </div>

      <Field icon={<HeartPulse size={15} />} label="Vulnerable" filled={Boolean(ticket?.vulnerable.length)}>
        {ticket?.vulnerable.length ? (
          <div className="flex flex-wrap gap-1">
            {ticket.vulnerable.map((v) => (
              <span key={v} className="rounded-md bg-p1/15 px-1.5 py-0.5 text-[11.5px] text-p1">
                {VULN_LABEL[v]?.en ?? v}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-fog">—</span>
        )}
      </Field>

      <Field icon={<LifeBuoy size={15} />} label="Hazards · needs" filled={extras.length > 0}>
        {extras.length ? (
          <div className="flex flex-wrap gap-1">
            {extras.map((x) => (
              <span key={x} className="rounded-md border border-line bg-ink-700/60 px-1.5 py-0.5 text-[11.5px]">
                {x}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-fog">—</span>
        )}
      </Field>

      <AnimatePresence>
        {ticket && ticket.rules[0]?.id !== "R0" && p && (
          <motion.div
            key={ticket.priority}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative overflow-hidden rounded-xl border px-3 py-2.5"
            style={{ borderColor: p.color, background: `color-mix(in oklab, ${p.hex} 12%, transparent)` }}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} style={{ color: p.color }} />
              <span className="font-display text-[20px] font-extrabold tracking-wide" style={{ color: p.color }}>
                P{ticket.priority} · {p.label.toUpperCase()}
              </span>
              <span className="ta ml-auto text-[12px] text-mist">{p.ta}</span>
            </div>
            <div className="mt-1 space-y-0.5">
              {ticket.rules.slice(0, 3).map((r) => (
                <div key={r.id} className="flex gap-2 font-mono text-[10.5px] text-mist">
                  <span style={{ color: PRIORITY[r.priority].color }}>{r.id}</span>
                  <span className="truncate">{r.label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
