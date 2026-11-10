import { motion } from "motion/react";
import { Mic, AudioLines, ListChecks, Scale, MapPinned, Volume2, MessageSquareText, ShieldCheck, GitBranch } from "lucide-react";
import type { Meta } from "../lib/types.ts";

const STEPS = [
  { icon: Mic, title: "Caller speaks", body: "Tamil, Tanglish, English, Hindi or Telugu, on an 8 kHz line in the rain. The browser captures each turn with an energy VAD.", tag: "browser" },
  { icon: AudioLines, title: "Prisma v3.0", body: "language_code = ta-IN,en-IN,hi-IN,te-IN · format = codemix · 175 Chennai keyterms · topic · previous_text from earlier turns.", tag: "Gnani STT" },
  { icon: ListChecks, title: "Rules extract", body: "Area, landmark, water level, people, vulnerable people, hazards and needs. Tamil case endings handled. Every field keeps the words it came from.", tag: "deterministic" },
  { icon: Scale, title: "Rules rank", body: "R1–R17 decide P1 / P2 / P3. No model sets priority. The ticket lists every rule that fired.", tag: "deterministic" },
  { icon: Volume2, title: "Timbre v3.0 replies", body: "Scripted prompts only, in the caller's detected language. Voice Kalpana, <pauses> before questions, <slow> for safety advice. Reads the area back for confirmation.", tag: "Gnani TTS" },
  { icon: MapPinned, title: "Board updates", body: "The pin drops, the queue reorders, and reports from the same street group together. Officers dispatch, resolve, or send a spoken update.", tag: "live" },
];

const RULES: [string, string, 1 | 2 | 3][] = [
  ["R1", "People trapped, cannot get out", 1],
  ["R2", "Medical emergency (breathing, chest pain, unconscious, bleeding, snake bite)", 1],
  ["R3", "Water at chest level or above", 1],
  ["R4", "Bedridden, infant, pregnant, dialysis, disabled or on oxygen, with water at waist or above", 1],
  ["R5", "Live wire in flood water", 1],
  ["R6", "Water at waist level", 2],
  ["R7", "Elderly, children or unwell present, water at knee or inside the home", 2],
  ["R8", "High-risk person present at lower water levels", 2],
  ["R9 · R10", "Fallen or live electric wire · fallen tree blocking access", 2],
  ["R11 · R12", "Family stranded on a terrace · 10 or more people at one location", 2],
  ["R13", "Medicine needed for a vulnerable person", 2],
  ["R14–R17", "Evacuation request, food or drinking water, power cut, ankle or knee waterlogging", 3],
];

const COLORS = { 1: "#ff4b2b", 2: "#ffab1f", 3: "#3fb8af" } as const;

export function HowPage({ meta }: { meta: Meta | null }) {
  return (
    <main className="scroll-thin min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1240px] px-6 py-7">
        <div className="label">How Thunai works</div>
        <h1 className="mt-2 max-w-[900px] font-display text-[50px] font-extrabold leading-[0.95] tracking-wide">
          GNANI HEARS AND SPEAKS. <span className="text-marigold">PLAIN CODE DECIDES.</span>
        </h1>
        <p className="mt-3 max-w-[760px] text-[14px] leading-relaxed text-mist">
          On an emergency line, the model's job is to listen and speak clearly in the caller's language. Ranking a life-or-death call and choosing what to tell a frightened person are left to rules and a reviewed script, so every decision can be read, tested and explained.
        </p>

        <div className="mt-7 grid grid-cols-6 gap-3">
          {STEPS.map((s, i) => (
            <motion.div key={s.title} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="panel relative flex flex-col p-4">
              <div className="flex items-center justify-between">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-marigold/15 text-marigold">
                  <s.icon size={18} />
                </div>
                <span className="font-mono text-[10px] text-fog">0{i + 1}</span>
              </div>
              <div className="mt-3 font-display text-[19px] font-extrabold leading-tight tracking-wide">{s.title.toUpperCase()}</div>
              <p className="mt-1.5 flex-1 text-[12px] leading-relaxed text-mist">{s.body}</p>
              <span className={`mt-3 w-fit rounded-md px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wider ${s.tag.startsWith("Gnani") ? "bg-marigold text-ink-950" : "bg-ink-700 text-mist"}`}>{s.tag}</span>
              {i < STEPS.length - 1 && <div className="absolute -right-2.5 top-1/2 z-10 h-px w-2 bg-marigold/60" />}
            </motion.div>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-[1.15fr_1fr] gap-4">
          <section className="panel p-5">
            <div className="label mb-3">Priority rules (server/triage.ts)</div>
            <div className="space-y-1.5">
              {RULES.map(([id, label, p]) => (
                <div key={id} className="flex items-center gap-3 rounded-lg border border-line bg-ink-800/60 px-3 py-1.5 text-[12.5px]">
                  <span className="w-16 font-mono text-[11px]" style={{ color: COLORS[p] }}>
                    {id}
                  </span>
                  <span className="flex-1">{label}</span>
                  <span className="font-mono text-[11px]" style={{ color: COLORS[p] }}>
                    P{p}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <div className="flex flex-col gap-4">
            <section className="panel p-5">
              <div className="label mb-3 flex items-center gap-2">
                <MessageSquareText size={12} /> Overnight voice notes
              </div>
              <p className="text-[12.5px] leading-relaxed text-mist">
                WhatsApp voice notes that piled up overnight go to <b className="text-chalk">one Prisma v3.0 Batch job</b> with <code className="font-mono text-chalk">with_denoise: true</code>, codemix output and the same keyterms and topic. The recorded run took 20 files from upload to transcripts in 25 seconds, through ingest → transcode → denoise → sad → diarize → recognize → assemble.
              </p>
            </section>
            <section className="panel p-5">
              <div className="label mb-3 flex items-center gap-2">
                <ShieldCheck size={12} /> Safety and data
              </div>
              <ul className="space-y-1.5 text-[12.5px] leading-relaxed text-mist">
                <li>• Synthetic data only: placeholder caller numbers, Timbre-voiced demo callers, no real recordings.</li>
                <li>• The Gnani key stays on the server; the browser never sees it.</li>
                <li>• Timbre serves one request at a time per key, so all speech is queued and fixed prompts are pre-rendered.</li>
                <li>• An optional LLM (OpenAI-compatible, Evon-ready) may only fill empty fields. Any area it proposes must exist in the gazetteer, and it never sets priority.</li>
                <li>• Not connected to emergency services. A real deployment needs a telephony trunk, GCC ward data and a human on every P1.</li>
              </ul>
            </section>
            <section className="panel p-5">
              <div className="label mb-2">Keyterms sent to Prisma</div>
              <div className="flex max-h-[96px] flex-wrap gap-1 overflow-hidden">
                {(meta?.keyterms ?? []).slice(0, 80).map((k) => (
                  <span key={k} className="ta rounded bg-ink-700/70 px-1.5 py-[1px] text-[10.5px] text-mist">
                    {k}
                  </span>
                ))}
              </div>
              <div className="mt-2 font-mono text-[10px] text-fog">{meta?.keyterms.length ?? 175} terms · Chennai localities in Latin and Tamil script, plus flood vocabulary</div>
            </section>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-2 text-[12px] text-fog">
          <GitBranch size={13} /> Source, eval scripts and README in the project repository. Built for the Gnani AI Great Indian AI Internship Challenge 2026 · #GnaniAI #GreatIndianAIInternshipChallenge
        </div>
      </div>
    </main>
  );
}
