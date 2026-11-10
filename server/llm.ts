// Optional second opinion from any OpenAI-compatible chat endpoint (Groq, Gemini, or Evon
// served with vLLM). It can only fill fields the rules left empty, and a locality it proposes
// must exist in the gazetteer. Priority is never taken from the model.
import { env } from "./env.ts";
import { LOCALITIES } from "./gazetteer.ts";
import type { Extraction, Hazard, Need, Vulnerable, WaterLevel } from "./extract.ts";

export const llmEnabled = () => Boolean(env.llmBaseUrl && env.llmModel);

const SYSTEM = `You extract facts from a flood distress call transcript from Chennai. The transcript mixes Tamil script and English words.
Return JSON only: {"locality": string|null (English name of the Chennai area), "landmark": string|null, "water_level": "ankle"|"knee"|"waist"|"chest"|"neck"|null,
"people": number|null, "vulnerable": string[] subset of [elderly,bedridden,infant,child,pregnant,dialysis,disabled,oxygen,sick],
"hazards": string[] subset of [trapped,stranded,medical,liveWire,treeFall,powerCut,insideHome], "needs": string[] subset of [rescue,food,water,medicine]}.
Only include facts the caller actually said. Do not guess.`;

export async function llmAssist(transcript: string, ex: Extraction): Promise<{ used: boolean; ms: number }> {
  if (!llmEnabled()) return { used: false, ms: 0 };
  const t0 = performance.now();
  try {
    const res = await fetch(`${env.llmBaseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(env.llmKey ? { Authorization: `Bearer ${env.llmKey}` } : {}) },
      body: JSON.stringify({
        model: env.llmModel,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: transcript },
        ],
      }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return { used: false, ms: Math.round(performance.now() - t0) };
    const json = await res.json();
    const out = JSON.parse(json.choices?.[0]?.message?.content ?? "{}");
    if (!ex.locality && typeof out.locality === "string") {
      const q = out.locality.toLowerCase();
      const loc = LOCALITIES.find((l) => l.en.toLowerCase() === q || l.aliases.some((a) => a.toLowerCase() === q));
      if (loc) {
        ex.locality = loc;
        ex.evidence.push({ field: "locality", value: loc.en, match: `model: ${out.locality}` });
      }
    }
    if (!ex.landmark && typeof out.landmark === "string" && out.landmark.length < 60) ex.landmark = out.landmark;
    if (!ex.waterLevel && typeof out.water_level === "string") ex.waterLevel = out.water_level as WaterLevel;
    if (ex.people === undefined && Number.isFinite(out.people) && out.people > 0 && out.people < 200) ex.people = out.people;
    const merge = <T extends string>(dst: T[], src: unknown, allowed: readonly string[]) => {
      if (Array.isArray(src)) for (const s of src) if (allowed.includes(s) && !dst.includes(s as T)) dst.push(s as T);
    };
    merge<Vulnerable>(ex.vulnerable, out.vulnerable, ["elderly", "bedridden", "infant", "child", "pregnant", "dialysis", "disabled", "oxygen", "sick"]);
    merge<Hazard>(ex.hazards, out.hazards, ["trapped", "stranded", "medical", "liveWire", "treeFall", "powerCut", "insideHome"]);
    merge<Need>(ex.needs, out.needs, ["rescue", "food", "water", "medicine"]);
    return { used: true, ms: Math.round(performance.now() - t0) };
  } catch {
    return { used: false, ms: Math.round(performance.now() - t0) };
  }
}
