// Thin clients for Gnani Prisma v3.0 (STT REST + Batch) and Timbre v3.0 (TTS REST).
// Docs: https://docs.gnani.ai/llms.txt
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CACHE_DIR, env } from "./env.ts";

const BASE = "https://api.vachana.ai";

export type Lang = "ta-IN" | "en-IN" | "hi-IN" | "te-IN";
export const CANDIDATE_LANGS: Lang[] = ["ta-IN", "en-IN", "hi-IN", "te-IN"];

export interface SttOptions {
  languages?: string[];
  format?: "codemix" | "transcribe" | "verbatim" | "transliterate";
  keyterms?: string[];
  topic?: string;
  previousText?: string;
  filename?: string;
  mime?: string;
}

export interface SttResult {
  transcript: string;
  detectedLanguage: string | null;
  requestId: string | null;
  serverMs: number | null;
  roundTripMs: number;
  raw: unknown;
}

export class GnaniError extends Error {
  constructor(message: string, public status: number, public body: string) {
    super(message);
  }
}

async function withRetry<T>(fn: () => Promise<T>, label: string, attempts = 4): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const retryable = err instanceof GnaniError ? err.status === 429 || err.status >= 500 : true;
      if (!retryable || i === attempts - 1) break;
      const wait = 400 * 2 ** i + Math.random() * 200;
      console.warn(`[gnani] ${label} failed (${err instanceof GnaniError ? err.status : "network"}), retrying in ${Math.round(wait)}ms`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

/** Prisma v3.0 REST: clips up to 30 s. */
export async function transcribe(audio: Buffer, opts: SttOptions = {}): Promise<SttResult> {
  return withRetry(async () => {
    const fd = new FormData();
    fd.append("audio_file", new Blob([new Uint8Array(audio)], { type: opts.mime ?? "audio/wav" }), opts.filename ?? "turn.wav");
    fd.append("model", "prisma-v3.0");
    fd.append("language_code", (opts.languages ?? CANDIDATE_LANGS).join(","));
    fd.append("format", opts.format ?? "codemix");
    if (opts.keyterms?.length) fd.append("keyterms", JSON.stringify(opts.keyterms.slice(0, 200)));
    if (opts.topic) fd.append("topic", opts.topic.slice(0, 1600));
    if (opts.previousText && opts.previousText.trim().length >= 12) fd.append("previous_text", opts.previousText.slice(-600));
    const t0 = performance.now();
    const res = await fetch(`${BASE}/stt/v3`, { method: "POST", headers: { "X-API-Key-ID": env.gnaniKey }, body: fd });
    const body = await res.text();
    const roundTripMs = Math.round(performance.now() - t0);
    if (!res.ok) throw new GnaniError(`Prisma STT ${res.status}`, res.status, body.slice(0, 500));
    const json = JSON.parse(body) as Record<string, unknown>;
    return {
      transcript: String(json.transcript ?? ""),
      detectedLanguage: (json.detected_language_code as string) ?? null,
      requestId: (json.request_id as string) ?? null,
      serverMs: typeof json.processing_time === "number" ? Math.round((json.processing_time as number) * 1000) : null,
      roundTripMs,
      raw: json,
    };
  }, "STT");
}

// ---------------------------------------------------------------- TTS
// Accounts may allow only one active TTS request per key (HTTP 429 RATE_LIMITED),
// so every synthesis goes through this queue.
let ttsChain: Promise<unknown> = Promise.resolve();
function serialised<T>(fn: () => Promise<T>): Promise<T> {
  const run = ttsChain.then(fn, fn);
  ttsChain = run.catch(() => undefined);
  return run;
}

export interface TtsOptions {
  voice?: string;
  language?: string;
  speed?: number;
  container?: "wav" | "mulaw";
  sampleRate?: number;
}

const TTS_DIR = path.join(CACHE_DIR, "tts");
mkdirSync(TTS_DIR, { recursive: true });

export function ttsKey(text: string, o: TtsOptions): string {
  return createHash("sha1")
    .update(JSON.stringify([text, o.voice ?? "Kalpana", o.language ?? "ta-IN", o.speed ?? 1, o.container ?? "wav", o.sampleRate ?? 24000]))
    .digest("hex")
    .slice(0, 20);
}

export function ttsPath(key: string, container: "wav" | "mulaw" = "wav"): string {
  return path.join(TTS_DIR, `${key}.${container === "mulaw" ? "ulaw" : "wav"}`);
}

/** Timbre v3.0 REST. Cached on disk by text+voice+language so repeated prompts cost nothing. */
export async function synthesize(text: string, o: TtsOptions = {}): Promise<{ key: string; file: string; cached: boolean; ms: number }> {
  const container = o.container ?? "wav";
  const key = ttsKey(text, o);
  const file = ttsPath(key, container);
  if (existsSync(file)) return { key, file, cached: true, ms: 0 };
  return serialised(() =>
    withRetry(async () => {
      if (existsSync(file)) return { key, file, cached: true, ms: 0 };
      const t0 = performance.now();
      const audio_config =
        container === "mulaw"
          ? { num_channels: 1, sample_width: 2, encoding: "linear_pcm", container: "mulaw", sample_rate: 8000 }
          : { num_channels: 1, sample_width: 2, encoding: "linear_pcm", container: "wav", sample_rate: o.sampleRate ?? 24000 };
      const res = await fetch(`${BASE}/api/v1/tts/inference`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key-ID": env.gnaniKey },
        body: JSON.stringify({
          text,
          voice: o.voice ?? "Kalpana",
          model: "timbre-v3.0",
          language: o.language ?? "ta-IN",
          speed: o.speed ?? 1,
          audio_config,
        }),
      });
      if (!res.ok) throw new GnaniError(`Timbre TTS ${res.status}`, res.status, (await res.text()).slice(0, 500));
      const buf = Buffer.from(await res.arrayBuffer());
      writeFileSync(file, buf);
      return { key, file, cached: false, ms: Math.round(performance.now() - t0) };
    }, "TTS"),
  );
}

export function readTts(key: string): Buffer | null {
  const f = ttsPath(key, "wav");
  return existsSync(f) ? readFileSync(f) : null;
}

// ---------------------------------------------------------------- Batch
export interface BatchConfig {
  languages?: string[];
  keyterms?: string[];
  topic?: string;
  denoise?: boolean;
}

export async function createBatchJob(files: { name: string; data: Buffer }[], cfg: BatchConfig): Promise<string> {
  const fd = new FormData();
  const config = {
    model: "prisma-v3.0",
    language_code: (cfg.languages ?? CANDIDATE_LANGS).join(","),
    format: "codemix",
    mode: "transcribe",
    with_denoise: cfg.denoise ?? true,
    ...(cfg.keyterms?.length ? { keyterms: cfg.keyterms.slice(0, 200) } : {}),
    ...(cfg.topic ? { topic: cfg.topic } : {}),
  };
  // a plain string field: a Blob would be sent as a file part (filename="blob"), which the API rejects
  fd.append("config", JSON.stringify(config));
  for (const f of files) fd.append("files", new Blob([new Uint8Array(f.data)], { type: "audio/wav" }), f.name);
  const res = await fetch(`${BASE}/stt/v3/batch/jobs`, { method: "POST", headers: { "X-API-Key-ID": env.gnaniKey }, body: fd });
  const body = await res.text();
  if (!res.ok) throw new GnaniError(`Batch create ${res.status}`, res.status, body.slice(0, 800));
  const json = JSON.parse(body);
  const jobId = json.job_id as string;
  const start = await fetch(`${BASE}/stt/v3/batch/jobs/${jobId}/start`, { method: "POST", headers: { "X-API-Key-ID": env.gnaniKey } });
  if (!start.ok) throw new GnaniError(`Batch start ${start.status}`, start.status, (await start.text()).slice(0, 500));
  return jobId;
}

export async function getBatchJob(jobId: string): Promise<Record<string, unknown>> {
  return withRetry(async () => {
    const res = await fetch(`${BASE}/stt/v3/batch/jobs/${jobId}`, { headers: { "X-API-Key-ID": env.gnaniKey } });
    const body = await res.text();
    if (!res.ok) throw new GnaniError(`Batch status ${res.status}`, res.status, body.slice(0, 500));
    return JSON.parse(body);
  }, "batch status", 6);
}

export async function getBatchFiles(jobId: string): Promise<Record<string, unknown>> {
  return withRetry(async () => {
    const res = await fetch(`${BASE}/stt/v3/batch/jobs/${jobId}/files?limit=100`, { headers: { "X-API-Key-ID": env.gnaniKey } });
    const body = await res.text();
    if (!res.ok) throw new GnaniError(`Batch files ${res.status}`, res.status, body.slice(0, 500));
    return JSON.parse(body);
  }, "batch files", 6);
}

export async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${res.status} ${url.slice(0, 80)}`);
  return res.json();
}
