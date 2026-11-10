import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Play, CloudRain, Check, X as XIcon, FlaskConical } from "lucide-react";
import { api, type EvalResults, type EvalRow } from "../lib/api.ts";
import type { Meta } from "../lib/types.ts";

const COND_LABEL: Record<string, string> = { clean: "Clean 8 kHz line", "10dB": "Heavy rain · 10 dB SNR", "5dB": "Cyclone · 5 dB SNR" };

function Bar({ value, color, delay }: { value: number; color: string; delay: number }) {
  return (
    <div className="relative h-full w-full rounded-t-lg bg-ink-700/40">
      <motion.div initial={{ height: 0 }} animate={{ height: `${value * 100}%` }} transition={{ delay, type: "spring", stiffness: 60, damping: 16 }} className="absolute bottom-0 left-0 right-0 rounded-t-lg" style={{ background: color, boxShadow: `0 0 24px -4px ${color}` }} />
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: delay + 0.4 }} className="absolute inset-x-0 text-center font-display text-[22px] font-extrabold" style={{ bottom: `calc(${value * 100}% + 4px)` }}>
        {Math.round(value * 100)}%
      </motion.div>
    </div>
  );
}

function RowAudio({ url }: { url: string }) {
  return (
    <button onClick={() => new Audio(url).play()} className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-line text-mist hover:border-marigold hover:text-marigold" title="Hear what Prisma heard">
      <Play size={11} fill="currentColor" />
    </button>
  );
}

export function LabPage({ meta }: { meta: Meta | null }) {
  const [res, setRes] = useState<EvalResults | null | undefined>(undefined);
  const [cond, setCond] = useState("5dB");
  useEffect(() => {
    api.evalResults().then(setRes).catch(() => setRes(null));
  }, []);

  const byCond = useMemo(() => {
    const m = new Map<string, { on?: EvalResults["summary"][number]; off?: EvalResults["summary"][number] }>();
    for (const s of res?.summary ?? []) {
      const e = m.get(s.condition) ?? {};
      if (s.keyterms) e.on = s;
      else e.off = s;
      m.set(s.condition, e);
    }
    return m;
  }, [res]);

  const rows: EvalRow[] = useMemo(() => (res?.rows ?? []).filter((r) => r.condition === cond && r.keyterms), [res, cond]);
  const rowsOff = useMemo(() => new Map((res?.rows ?? []).filter((r) => r.condition === cond && !r.keyterms).map((r) => [`${r.id}|${r.voice}`, r])), [res, cond]);

  return (
    <main className="scroll-thin min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1280px] px-6 py-6">
        <div className="grid grid-cols-[1.1fr_1fr] gap-6">
          <div>
            <div className="label flex items-center gap-2">
              <FlaskConical size={12} /> Noise lab
            </div>
            <h1 className="mt-2 font-display text-[54px] font-extrabold leading-[0.95] tracking-wide">
              CAN IT HEAR <span className="text-marigold">PALLIKARANAI</span>
              <br />
              THROUGH A <span className="text-monsoon">CYCLONE?</span>
            </h1>
            <p className="mt-4 max-w-[560px] text-[14px] leading-relaxed text-mist">
              Synthetic Tanglish, English and Hindi distress lines are spoken by Timbre v3.0 voices, rendered straight to <b className="text-chalk">G.711 µ-law at 8 kHz</b> (a real phone codec), band-limited to 300–3400 Hz, then buried under procedural rain, traffic rumble and horns at 10 dB and 5 dB SNR. Prisma v3.0 transcribes each one twice: with and without Thunai's {meta?.keyterms.length ?? 175} Chennai keyterms. The same rule extractor that runs the live line then scores the result.
            </p>
            <div className="mt-4 grid max-w-[560px] grid-cols-3 gap-2 text-[12px]">
              <div className="rounded-xl border border-line bg-ink-800/70 p-3">
                <div className="label !text-[9px]">STT model</div>
                <div className="mt-1 font-mono">prisma-v3.0</div>
              </div>
              <div className="rounded-xl border border-line bg-ink-800/70 p-3">
                <div className="label !text-[9px]">format</div>
                <div className="mt-1 font-mono">codemix</div>
              </div>
              <div className="rounded-xl border border-line bg-ink-800/70 p-3">
                <div className="label !text-[9px]">languages</div>
                <div className="mt-1 font-mono">ta,en,hi,te</div>
              </div>
            </div>
          </div>

          <div className="panel p-5">
            <div className="flex items-center justify-between">
              <div className="label">Locality named correctly</div>
              <div className="flex items-center gap-3 text-[11px] text-mist">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-ink-600" /> no keyterms
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-marigold" /> with keyterms
                </span>
              </div>
            </div>
            {res === undefined && <div className="mt-20 text-center text-fog">Loading…</div>}
            {res === null && (
              <div className="mt-12 text-center text-[13px] leading-relaxed text-fog">
                No eval results yet.
                <br />
                Run <code className="rounded bg-ink-700 px-1.5 py-0.5 font-mono text-chalk">npm run eval</code> to generate them.
              </div>
            )}
            {res && (
              <>
                <div className="mt-8 grid h-[230px] grid-cols-3 gap-6">
                  {res.conditions.map((c, i) => {
                    const e = byCond.get(c);
                    return (
                      <div key={c} className="flex flex-col">
                        <div className="flex flex-1 items-end gap-2">
                          <Bar value={e?.off?.localityAcc ?? 0} color="#1f3440" delay={i * 0.15} />
                          <Bar value={e?.on?.localityAcc ?? 0} color="#f4b23f" delay={i * 0.15 + 0.08} />
                        </div>
                        <div className="mt-2 text-center text-[11.5px] text-mist">{COND_LABEL[c] ?? c}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3 border-t hairline pt-4 text-center">
                  {res.conditions.map((c) => {
                    const e = byCond.get(c);
                    return (
                      <div key={c}>
                        <div className="label !text-[9px]">all fields · keyterms on</div>
                        <div className="font-display text-[24px] font-extrabold">{Math.round((e?.on?.fieldAcc ?? 0) * 100)}%</div>
                        <div className="font-mono text-[10px] text-fog">median Prisma {e?.on?.medianSttMs ?? "?"} ms</div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 text-center font-mono text-[10px] text-fog">
                  {res.lines} lines × {res.voices.length} voices ({res.voices.join(", ")}) · run {new Date(res.ranAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST
                </div>
              </>
            )}
          </div>
        </div>

        {res && (
          <section className="mt-8">
            <div className="flex items-center gap-2">
              <div className="label">What Prisma heard</div>
              <div className="ml-auto flex rounded-full border border-line bg-ink-900 p-1">
                {res.conditions.map((c) => (
                  <button key={c} onClick={() => setCond(c)} className={`flex items-center gap-1 rounded-full px-3 py-1 text-[11.5px] ${cond === c ? "bg-chalk text-ink-950" : "text-mist"}`}>
                    {c !== "clean" && <CloudRain size={11} />} {COND_LABEL[c]}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3 overflow-hidden rounded-2xl border border-line">
              <div className="grid grid-cols-[36px_150px_1fr_1fr_90px] gap-3 border-b hairline bg-ink-800 px-3 py-2 label !text-[9.5px]">
                <span />
                <span>Truth</span>
                <span>With keyterms</span>
                <span>Without keyterms</span>
                <span className="text-right">Fields</span>
              </div>
              {rows.map((r) => {
                const off = rowsOff.get(`${r.id}|${r.voice}`);
                return (
                  <div key={`${r.id}-${r.voice}`} className="grid grid-cols-[36px_150px_1fr_1fr_90px] items-start gap-3 border-b hairline bg-ink-900/60 px-3 py-2.5 text-[12.5px] last:border-0">
                    <RowAudio url={r.audio} />
                    <div>
                      <div className="font-medium">{r.truth.locality}</div>
                      <div className="font-mono text-[10px] text-fog">
                        {r.voice} · {r.truth.water ?? "—"}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {r.localityOk ? <Check size={14} className="mt-0.5 shrink-0 text-p3" /> : <XIcon size={14} className="mt-0.5 shrink-0 text-p1" />}
                      <span className="ta leading-relaxed">{r.transcript}</span>
                    </div>
                    <div className="flex gap-2 text-mist">
                      {off ? off.localityOk ? <Check size={14} className="mt-0.5 shrink-0 text-p3" /> : <XIcon size={14} className="mt-0.5 shrink-0 text-p1" /> : null}
                      <span className="ta leading-relaxed">{off?.transcript ?? "—"}</span>
                    </div>
                    <div className="text-right font-mono text-[11px]">
                      {r.fieldsOk}/{r.fieldsTotal}
                      <div className="text-[10px] text-fog">{r.sttMs ?? "?"} ms</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 max-w-[900px] text-[12px] leading-relaxed text-fog">
              Caveats: Timbre voices are cleaner and more regular than a frightened caller, and the noise is synthetic, so these numbers are an upper bound for real calls. The test set is small. It measures one thing well: whether Chennai place names survive a bad phone line, and how much the keyterm list helps.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
