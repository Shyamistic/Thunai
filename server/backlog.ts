// Overnight WhatsApp voice notes → one Prisma v3.0 Batch job (with_denoise) → tickets.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ticketFromVoiceNote } from "./call.ts";
import { DATA_DIR } from "./env.ts";
import { buildKeyterms, STT_TOPIC } from "./gazetteer.ts";
import { createBatchJob, fetchJson, getBatchFiles, getBatchJob } from "./gnani.ts";
import { store } from "./store.ts";

export const BACKLOG_DIR = path.join(DATA_DIR, "backlog");
const MANIFEST = path.join(BACKLOG_DIR, "manifest.json");
const RESULTS = path.join(BACKLOG_DIR, "results.json");

export interface ManifestItem {
  file: string;
  text: string;
  lang: string;
  minutesAgo: number;
  noiseDb: number;
  voice: string;
}

export interface BacklogResult {
  jobId: string;
  ranAt: number;
  elapsedMs: number;
  config: Record<string, unknown>;
  files: { file: string; transcript: string; lang: string; duration?: number; segments?: unknown[] }[];
}

export function manifest(): ManifestItem[] {
  return existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : [];
}

export function results(): BacklogResult | null {
  return existsSync(RESULTS) ? JSON.parse(readFileSync(RESULTS, "utf8")) : null;
}

let running = false;

export async function runBatch(onProgress: (p: Record<string, unknown>) => void): Promise<BacklogResult> {
  if (running) throw new Error("A batch job is already running");
  running = true;
  try {
    const items = manifest();
    if (!items.length) throw new Error("No voice notes yet. Run: npm run voicenotes");
    const files = items.map((i) => ({ name: i.file, data: readFileSync(path.join(BACKLOG_DIR, "audio", i.file)) }));
    const config = { model: "prisma-v3.0", language_code: "ta-IN,en-IN,hi-IN,te-IN", format: "codemix", with_denoise: true, keyterms: `${buildKeyterms().length} terms`, topic: "flood helpline" };
    const t0 = Date.now();
    onProgress({ stage: "upload", files: files.length });
    const jobId = await createBatchJob(files, { keyterms: buildKeyterms(), topic: STT_TOPIC, denoise: true });
    onProgress({ stage: "started", jobId });
    let job: Record<string, unknown> = {};
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 8000));
      job = await getBatchJob(jobId);
      onProgress({ stage: "polling", jobId, status: job.status, job });
      if (["COMPLETED", "FAILED", "PARTIAL_FAILURE", "PARTIALLY_COMPLETED", "CANCELLED"].includes(String(job.status))) break;
    }
    await new Promise((r) => setTimeout(r, 2000));
    const listing = (await getBatchFiles(jobId)) as { data?: { original_path: string; status: string; transcript_url?: string; duration_seconds?: string }[] };
    const out: BacklogResult = { jobId, ranAt: Date.now(), elapsedMs: Date.now() - t0, config, files: [] };
    for (const f of listing.data ?? []) {
      if (f.status !== "COMPLETED" || !f.transcript_url) continue;
      const doc = (await fetchJson(f.transcript_url)) as { full_transcript?: string; language_code?: string; segments?: unknown[] };
      out.files.push({ file: path.basename(f.original_path), transcript: doc.full_transcript ?? "", lang: doc.language_code ?? "ta-IN", duration: Number(f.duration_seconds), segments: doc.segments });
    }
    writeFileSync(RESULTS, JSON.stringify(out, null, 2));
    onProgress({ stage: "done", jobId, files: out.files.length, elapsedMs: out.elapsedMs });
    return out;
  } finally {
    running = false;
  }
}

/** Turn cached batch transcripts into tickets, one every ~350 ms so the board visibly fills. */
export async function replay(): Promise<number> {
  const res = results();
  if (!res) throw new Error("No batch results yet");
  const items = new Map(manifest().map((m) => [m.file, m]));
  let n = 0;
  for (const f of res.files) {
    const m = items.get(f.file);
    const t = await ticketFromVoiceNote(f.transcript, f.lang, {
      file: f.file,
      audio: `/api/backlog/audio/${encodeURIComponent(f.file)}`,
      createdAt: Date.now() - (m?.minutesAgo ?? 30) * 60_000,
    });
    store.upsert(t);
    n++;
    await new Promise((r) => setTimeout(r, 350));
  }
  return n;
}
