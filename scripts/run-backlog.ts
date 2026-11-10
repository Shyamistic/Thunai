// Sends the voice-note backlog through one Prisma v3.0 Batch job (with_denoise) and caches the
// transcripts so the board can replay them instantly during a demo.
import { runBatch } from "../server/backlog.ts";

const t0 = Date.now();
const res = await runBatch((p) => {
  const job = (p.job ?? {}) as Record<string, unknown>;
  console.log(`[${Math.round((Date.now() - t0) / 1000)}s] ${p.stage}${p.jobId && p.stage === "started" ? ` ${p.jobId}` : ""}${p.status ? ` ${p.status}` : ""}${job.completed_files !== undefined ? ` ${job.completed_files}/${job.total_files}` : ""}`);
});
for (const f of res.files) console.log(`${f.file} [${f.lang}] ${f.transcript}`);
console.log(`\njob ${res.jobId}: ${res.files.length} transcripts in ${Math.round(res.elapsedMs / 1000)} s`);
