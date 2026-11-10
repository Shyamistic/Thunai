import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X, Play, PhoneOutgoing, Truck, CheckCircle2, MapPin, Quote } from "lucide-react";
import { api, ago, useNow } from "../lib/api.ts";
import { HAZARD_LABEL, LANG_LABEL, LEVELS, NEED_LABEL, PRIORITY, VULN_LABEL, type Ticket } from "../lib/types.ts";
import { WaterGauge } from "./WaterGauge.tsx";

/** Underline the words that triggered each extracted field. */
function Highlighted({ text, marks }: { text: string; marks: string[] }) {
  const lower = text.toLowerCase();
  const spans: [number, number][] = [];
  for (const m of marks) {
    if (!m || m.startsWith("model:")) continue;
    const i = lower.indexOf(m.toLowerCase());
    if (i >= 0) spans.push([i, i + m.length]);
  }
  spans.sort((a, b) => a[0] - b[0]);
  const out: React.ReactNode[] = [];
  let pos = 0;
  spans.forEach(([s, e], k) => {
    if (s < pos) return;
    // never split a Tamil letter from its vowel sign (இல்ல|ை)
    while (e < text.length && /\p{M}/u.test(text[e])) e++;
    out.push(text.slice(pos, s));
    out.push(
      <mark key={k} className="rounded bg-marigold/20 px-0.5 text-jasmine underline decoration-marigold decoration-2 underline-offset-4">
        {text.slice(s, e)}
      </mark>,
    );
    pos = e;
  });
  out.push(text.slice(pos));
  return <span className="ta">{out}</span>;
}

function Player({ url }: { url: string }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  return (
    <button
      onClick={() => {
        if (!ref.current) {
          ref.current = new Audio(url);
          ref.current.onended = () => setPlaying(false);
        }
        if (playing) {
          ref.current.pause();
          setPlaying(false);
        } else {
          ref.current.currentTime = 0;
          ref.current.play();
          setPlaying(true);
        }
      }}
      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${playing ? "border-marigold text-marigold" : "border-line text-mist hover:text-chalk"}`}
      title="Play audio"
    >
      <Play size={11} fill="currentColor" />
    </button>
  );
}

export function TicketDrawer({ ticket, onClose }: { ticket: Ticket | null; onClose: () => void }) {
  const now = useNow(5000);
  const [busy, setBusy] = useState<string | null>(null);
  const p = ticket ? PRIORITY[ticket.priority] : null;
  const level = LEVELS.find((l) => l.id === ticket?.waterLevel);
  const marks = ticket?.evidence.map((e) => e.match) ?? [];

  const act = async (kind: "dispatched" | "resolved" | "callback") => {
    if (!ticket) return;
    setBusy(kind);
    try {
      if (kind === "callback") {
        const r = await api.callback(ticket.id);
        await new Audio(r.audio.url).play();
      } else await api.setStatus(ticket.id, kind);
    } finally {
      setBusy(null);
    }
  };

  return (
    <AnimatePresence>
      {ticket && p && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-[1000] bg-ink-950/50 backdrop-blur-[2px]" />
          <motion.aside
            initial={{ x: 560 }}
            animate={{ x: 0 }}
            exit={{ x: 560 }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            className="fixed bottom-3 right-3 top-[76px] z-[1001] flex w-[520px] flex-col overflow-hidden rounded-3xl border border-line bg-ink-900 shadow-2xl"
          >
            <div className="relative overflow-hidden border-b hairline px-5 pb-4 pt-4" style={{ background: `linear-gradient(135deg, color-mix(in oklab, ${p.hex} 18%, transparent), transparent 60%)` }}>
              <div className="pointer-events-none absolute -right-6 top-6 rotate-12 font-display text-[64px] font-extrabold tracking-widest text-chalk/[0.04]">SYNTHETIC</div>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-mono text-[11px] text-mist">
                    {ticket.id} · {ticket.source === "call" ? "1913 call" : "WhatsApp voice note"} · {ago(ticket.createdAt, now)} ago
                  </div>
                  <div className="mt-1 flex items-center gap-3">
                    <span className="font-display text-[34px] font-extrabold leading-none" style={{ color: p.hex }}>
                      P{ticket.priority}
                    </span>
                    <div>
                      <div className="ta text-[20px] font-semibold leading-tight text-jasmine">{ticket.locality?.ta ?? "Location pending"}</div>
                      <div className="text-[13px] text-mist">
                        {ticket.locality?.en} {ticket.locality && <span className="text-fog">· {ticket.locality.zone}</span>}
                      </div>
                    </div>
                  </div>
                </div>
                <button onClick={onClose} className="rounded-full border border-line p-1.5 text-mist hover:text-chalk">
                  <X size={16} />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11.5px]">
                <span className="flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-mist">
                  <MapPin size={11} /> {ticket.landmark ? `near ${ticket.landmark}` : "no landmark"}
                </span>
                <span className={`rounded-full px-2 py-0.5 ${ticket.localityConfirmed ? "bg-p3/15 text-p3" : "bg-p2/15 text-p2"}`}>{ticket.localityConfirmed ? "Location read back and confirmed" : "Location not yet confirmed"}</span>
                <span className="rounded-full border border-line px-2 py-0.5 font-mono text-fog">{ticket.caller}</span>
              </div>
            </div>

            <div className="scroll-thin min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
              <section className="grid grid-cols-[auto_1fr] gap-4">
                <div className="flex flex-col items-center rounded-2xl border border-line bg-ink-800 px-4 py-3">
                  <WaterGauge level={ticket.waterLevel} size={70} />
                  <div className="mt-1 text-[12px]">{level?.en ?? "Unknown"}</div>
                  <div className="ta text-[11px] text-fog">{level?.ta ?? ""}</div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[12.5px]">
                  <div className="rounded-xl border border-line bg-ink-800 p-2.5">
                    <div className="label !text-[9px]">People</div>
                    <div className="font-display text-[26px] font-extrabold leading-none">{ticket.people ?? "—"}</div>
                  </div>
                  <div className="rounded-xl border border-line bg-ink-800 p-2.5">
                    <div className="label !text-[9px]">Language</div>
                    <div className="mt-1">{LANG_LABEL[ticket.lang] ?? ticket.lang}</div>
                  </div>
                  <div className="col-span-2 rounded-xl border border-line bg-ink-800 p-2.5">
                    <div className="label !text-[9px]">Vulnerable · hazards · needs</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {ticket.vulnerable.map((v) => (
                        <span key={v} className="rounded-md bg-p1/15 px-1.5 py-0.5 text-[11px] text-p1">
                          {VULN_LABEL[v]?.en} <span className="ta opacity-70">{VULN_LABEL[v]?.ta}</span>
                        </span>
                      ))}
                      {ticket.hazards.map((h) => (
                        <span key={h} className="rounded-md bg-p2/15 px-1.5 py-0.5 text-[11px] text-p2">
                          {HAZARD_LABEL[h]}
                        </span>
                      ))}
                      {ticket.needs.map((n) => (
                        <span key={n} className="rounded-md bg-ink-600 px-1.5 py-0.5 text-[11px] text-mist">
                          {NEED_LABEL[n]}
                        </span>
                      ))}
                      {!ticket.vulnerable.length && !ticket.hazards.length && !ticket.needs.length && <span className="text-fog">none reported</span>}
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <div className="label mb-2">Why P{ticket.priority} · fixed rules, not a model</div>
                <div className="space-y-1.5">
                  {ticket.rules.map((r) => (
                    <div key={r.id} className="flex items-center gap-2 rounded-lg border border-line bg-ink-800/70 px-2.5 py-1.5 text-[12px]">
                      <span className="w-8 font-mono text-[11px]" style={{ color: PRIORITY[r.priority].hex }}>
                        {r.id}
                      </span>
                      <span className="flex-1">{r.label}</span>
                      <span className="font-mono text-[10px]" style={{ color: PRIORITY[r.priority].hex }}>
                        → P{r.priority}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <div className="label mb-2">Transcript · Prisma v3.0 codemix · highlighted words became fields</div>
                <div className="space-y-2">
                  {ticket.transcript.map((turn, i) => (
                    <div key={i} className={`flex gap-2 ${turn.role === "caller" ? "" : "opacity-80"}`}>
                      <div className={`mt-0.5 w-14 shrink-0 font-mono text-[9.5px] uppercase ${turn.role === "caller" ? "text-chalk" : "text-marigold"}`}>{turn.role === "caller" ? "Caller" : "Thunai"}</div>
                      <div className="min-w-0 flex-1 text-[13px] leading-relaxed">
                        {turn.role === "caller" ? <Highlighted text={turn.text} marks={marks} /> : <span className="ta text-mist">{turn.text}</span>}
                        {turn.role === "caller" && (
                          <div className="mt-0.5 font-mono text-[9.5px] text-fog">
                            {turn.lang}
                            {turn.sttMs != null && ` · ${turn.sttMs} ms`}
                            {turn.noise && turn.noise !== "off" && ` · storm noise ${turn.noise}`}
                          </div>
                        )}
                      </div>
                      {turn.audio && <Player url={turn.audio} />}
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <div className="label mb-2">Evidence</div>
                <div className="flex flex-wrap gap-1.5">
                  {ticket.evidence.map((e, i) => (
                    <span key={i} className="flex items-center gap-1 rounded-md border border-line px-1.5 py-0.5 text-[11px]">
                      <Quote size={9} className="text-marigold" />
                      <span className="ta text-jasmine">{e.match}</span>
                      <span className="text-fog">→ {e.field}: {e.value}</span>
                    </span>
                  ))}
                </div>
              </section>
            </div>

            <div className="grid grid-cols-3 gap-2 border-t hairline p-3">
              <button disabled={busy !== null} onClick={() => act("dispatched")} className="flex items-center justify-center gap-1.5 rounded-xl bg-marigold py-2.5 text-[12.5px] font-medium text-ink-950 disabled:opacity-50">
                <Truck size={14} /> Dispatch
              </button>
              <button disabled={busy !== null} onClick={() => act("callback")} className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-ink-800 py-2.5 text-[12.5px] disabled:opacity-50" title="Thunai calls back in the caller's language">
                <PhoneOutgoing size={14} /> {busy === "callback" ? "Calling…" : "Voice update"}
              </button>
              <button disabled={busy !== null} onClick={() => act("resolved")} className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-ink-800 py-2.5 text-[12.5px] disabled:opacity-50">
                <CheckCircle2 size={14} /> Resolve
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
