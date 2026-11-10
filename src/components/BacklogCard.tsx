import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { MessageSquareText, Sparkles, Loader2, Check } from "lucide-react";
import { api, type BacklogEvent } from "../lib/api.ts";

const STAGES = ["ingest", "transcode", "denoise", "sad", "diarize", "recognize", "assemble"];

export function BacklogCard({ event }: { event: BacklogEvent | null }) {
  const [info, setInfo] = useState<Awaited<ReturnType<typeof api.backlog>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const [stageIdx, setStageIdx] = useState(-1);

  useEffect(() => {
    api.backlog().then(setInfo).catch(() => undefined);
  }, [event?.stage]);

  useEffect(() => {
    if (event?.stage === "replayed") {
      setBusy(false);
      setDone(Number(event.n));
    }
    if (event?.stage === "error") setBusy(false);
  }, [event]);

  // animate the Batch pipeline stages while tickets land
  useEffect(() => {
    if (!busy) return;
    setStageIdx(0);
    const id = setInterval(() => setStageIdx((i) => Math.min(STAGES.length - 1, i + 1)), 420);
    return () => clearInterval(id);
  }, [busy]);

  const run = async () => {
    setBusy(true);
    setDone(null);
    try {
      if (info?.results) await api.replayBacklog();
      else await api.runBacklog();
    } catch {
      setBusy(false);
    }
  };

  if (!info?.notes) return null;
  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="absolute left-3 top-3 z-[500] w-[300px] rounded-2xl border border-line bg-ink-950/85 p-3 backdrop-blur">
      <div className="flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-p3/15 text-p3">
          <MessageSquareText size={16} />
        </div>
        <div className="leading-tight">
          <div className="text-[13px] font-medium">{info.notes} overnight WhatsApp voice notes</div>
          <div className="text-[11px] text-fog">Prisma v3.0 Batch · with_denoise · keyterms</div>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1">
        {STAGES.map((s, i) => (
          <span key={s} className={`rounded px-1.5 py-[1px] font-mono text-[9.5px] transition ${busy && i <= stageIdx ? "bg-marigold text-ink-950" : done !== null ? "bg-p3/20 text-p3" : "bg-ink-700 text-fog"}`}>
            {s}
          </span>
        ))}
      </div>
      {event?.stage === "polling" && <div className="mt-1.5 font-mono text-[10px] text-fog">job {String(event.status ?? "")}</div>}
      {event?.stage === "error" && <div className="mt-1.5 text-[11px] text-p2">{String(event.error)}</div>}
      <button onClick={run} disabled={busy} className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-chalk py-2 text-[12px] font-medium text-ink-950 disabled:opacity-70">
        {busy ? <Loader2 size={13} className="animate-spin" /> : done !== null ? <Check size={13} /> : <Sparkles size={13} />}
        {busy ? "Triaging…" : done !== null ? `${done} tickets ranked · run again` : "Triage the backlog"}
      </button>
      {info.results && (
        <div className="mt-1.5 text-center font-mono text-[9.5px] text-fog">
          last batch job {info.results.jobId.slice(0, 8)}… · {info.results.files} files · {(info.results.elapsedMs / 1000).toFixed(0)} s end to end
        </div>
      )}
    </motion.div>
  );
}
