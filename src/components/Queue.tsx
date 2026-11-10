import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Phone, MessageSquareText, Users, Layers, Download } from "lucide-react";
import { ago, useNow } from "../lib/api.ts";
import { HAZARD_LABEL, NEED_LABEL, PRIORITY, VULN_LABEL, type Ticket } from "../lib/types.ts";
import { WaterGauge } from "./WaterGauge.tsx";

function Card({ t, now, selected, onClick }: { t: Ticket; now: number; selected: boolean; onClick: () => void }) {
  const p = PRIORITY[t.priority];
  const resolved = t.status === "resolved";
  const chips = [...t.vulnerable.map((v) => ({ k: v, label: VULN_LABEL[v]?.en ?? v, hot: true })), ...t.hazards.map((h) => ({ k: h, label: HAZARD_LABEL[h], hot: h === "trapped" || h === "medical" || h === "liveWire" })), ...t.needs.map((n) => ({ k: n, label: NEED_LABEL[n], hot: false }))];
  return (
    <motion.button
      layout
      initial={{ opacity: 0, x: 40, scale: 0.96 }}
      animate={{ opacity: resolved ? 0.5 : 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      onClick={onClick}
      className={`group relative w-full overflow-hidden rounded-2xl border text-left transition ${selected ? "border-marigold bg-ink-700/80" : "border-line bg-ink-800/70 hover:border-ink-600"}`}
    >
      <div className="absolute inset-y-0 left-0 w-1.5" style={{ background: p.hex, boxShadow: `0 0 18px ${p.hex}` }} />
      {t.status === "live" && <div className="absolute inset-0 animate-pulse bg-marigold/[0.04]" />}
      <div className="flex gap-3 py-3 pl-4 pr-3">
        <div className="flex w-12 shrink-0 flex-col items-center gap-1">
          <div className="font-display text-[22px] font-extrabold leading-none" style={{ color: t.rules[0]?.id === "R0" ? "var(--color-fog)" : p.hex }}>
            {t.rules[0]?.id === "R0" ? "P?" : `P${t.priority}`}
          </div>
          <WaterGauge level={t.waterLevel} size={34} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {t.locality ? (
              <div className="min-w-0 truncate">
                <span className="ta text-[15px] font-semibold text-jasmine">{t.locality.ta}</span>
                <span className="ml-1.5 text-[12px] text-mist">{t.locality.en}</span>
              </div>
            ) : (
              <span className="text-[13px] text-p2">{t.source === "voicenote" ? "Area unclear · call back" : "Locating caller…"}</span>
            )}
            <span className="ml-auto shrink-0 font-mono text-[10.5px] text-fog">{ago(t.createdAt, now)}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-fog">
            {t.source === "call" ? <Phone size={11} /> : <MessageSquareText size={11} />}
            <span className="truncate">{t.landmark ? `near ${t.landmark}` : t.locality?.zone ?? "—"}</span>
            {t.people !== undefined && (
              <span className="ml-auto flex shrink-0 items-center gap-1 text-mist">
                <Users size={11} /> {t.people}
              </span>
            )}
          </div>
          {chips.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {chips.slice(0, 5).map((c) => (
                <span key={c.k} className={`rounded-md px-1.5 py-[1px] text-[10.5px] ${c.hot ? "bg-p1/15 text-p1" : "bg-ink-600/60 text-mist"}`}>
                  {c.label}
                </span>
              ))}
            </div>
          )}
          <div className="mt-1.5 flex items-center gap-2 font-mono text-[10px] text-fog">
            <span>{t.id}</span>
            {t.status === "live" && <span className="rounded bg-marigold px-1 text-ink-950">ON CALL</span>}
            {t.status === "dispatched" && <span className="rounded bg-p3/20 px-1 text-p3">DISPATCHED</span>}
            {t.status === "resolved" && <span className="rounded bg-ink-600 px-1 text-mist">RESOLVED</span>}
            {t.cluster && t.cluster.size > 1 && (
              <span className="flex items-center gap-0.5 text-p2">
                <Layers size={10} /> {t.cluster.size} reports
              </span>
            )}
            <span className="ml-auto truncate text-[9.5px]">{t.rules[0]?.id !== "R0" ? t.rules.map((r) => r.id).join(" ") : ""}</span>
          </div>
        </div>
      </div>
    </motion.button>
  );
}

export function Queue({ tickets, selected, onSelect, zones }: { tickets: Ticket[]; selected: string | null; onSelect: (id: string) => void; zones: string[] }) {
  const now = useNow(5000);
  const [filter, setFilter] = useState<0 | 1 | 2 | 3>(0);
  const [zone, setZone] = useState("");
  const shown = useMemo(
    () =>
      tickets
        .filter((t) => (filter ? t.priority === filter : true))
        .filter((t) => (zone ? t.locality?.zone === zone : true))
        .sort((a, b) => Number(a.status === "resolved") - Number(b.status === "resolved") || Number(b.status === "live") - Number(a.status === "live") || b.score - a.score),
    [tickets, filter, zone],
  );
  return (
    <div className="panel flex h-full min-h-0 flex-col overflow-hidden">
      <div className="border-b hairline px-4 pb-3 pt-3.5">
        <div className="flex items-end justify-between">
          <div>
            <div className="label">Triage queue</div>
            <div className="font-display text-[24px] font-extrabold leading-none tracking-wide">RANKED BY RULES</div>
          </div>
          <div className="flex flex-col items-end gap-1 text-right font-mono text-[10.5px] text-fog">
            <span>{shown.length} shown</span>
            <a href="/api/tickets.csv" className="flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-mist hover:border-marigold hover:text-marigold" title="Download the queue for field teams">
              <Download size={11} /> Export CSV
            </a>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-1">
          {([0, 1, 2, 3] as const).map((p) => (
            <button
              key={p}
              onClick={() => setFilter(p)}
              className={`rounded-full border px-2.5 py-1 text-[11px] transition ${filter === p ? "border-chalk bg-chalk text-ink-950" : "border-line text-mist hover:text-chalk"}`}
              style={filter !== p && p ? { color: PRIORITY[p].hex } : undefined}
            >
              {p ? `P${p}` : "All"}
            </button>
          ))}
          <select value={zone} onChange={(e) => setZone(e.target.value)} className="ml-auto max-w-[150px] truncate rounded-full border border-line bg-ink-900 px-2 py-1 text-[11px] text-mist">
            <option value="">All zones</option>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="scroll-thin min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        <AnimatePresence initial={false}>
          {shown.map((t) => (
            <Card key={t.id} t={t} now={now} selected={selected === t.id} onClick={() => onSelect(t.id)} />
          ))}
        </AnimatePresence>
        {!shown.length && (
          <div className="mt-16 text-center text-[12.5px] leading-relaxed text-fog">
            No tickets yet.
            <br />
            Answer a call, or triage the overnight voice notes.
          </div>
        )}
      </div>
    </div>
  );
}
