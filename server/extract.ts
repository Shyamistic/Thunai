// Deterministic slot extraction from Prisma v3.0 codemix transcripts.
// Tamil words arrive in Tamil script, English words in Latin script, numbers mostly as words.
// Every match records the words that triggered it, so the board can show evidence.
import { LOCALITIES, type Locality } from "./gazetteer.ts";

export const WATER_LEVELS = ["none", "ankle", "knee", "waist", "chest", "neck"] as const;
export type WaterLevel = (typeof WATER_LEVELS)[number];
export type Vulnerable = "elderly" | "bedridden" | "infant" | "child" | "pregnant" | "dialysis" | "disabled" | "oxygen" | "sick";
export type Hazard = "trapped" | "stranded" | "medical" | "liveWire" | "treeFall" | "powerCut" | "insideHome";
export type Need = "rescue" | "food" | "water" | "medicine";

export interface Evidence {
  field: string;
  value: string;
  match: string;
}

export interface Extraction {
  locality?: Locality;
  localityMatch?: string;
  otherLocalities: Locality[];
  landmark?: string;
  waterLevel?: WaterLevel;
  people?: number;
  vulnerable: Vulnerable[];
  vulnerableNone: boolean;
  hazards: Hazard[];
  needs: Need[];
  confirm?: "yes" | "no";
  evidence: Evidence[];
}

// ------------------------------------------------------------------ helpers
const PUNCT = /[.,!?;:"“”'‘’()[\]{}…।॥|/\\]+/g;

export function normalise(text: string): string {
  return ` ${text.normalize("NFC").replace(/-/g, " ").replace(PUNCT, " ").replace(/\s+/g, " ").toLowerCase().trim()} `;
}

const isLatin = (s: string) => /^[\x00-\x7F]+$/.test(s);
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Find a phrase. Latin phrases need word boundaries; Indic phrases match as substrings
 *  because case endings attach to the word (பள்ளிக்கரணையில், வேளச்சேரில). */
function find(text: string, phrase: string): number {
  const p = phrase.toLowerCase();
  if (isLatin(p)) {
    const m = new RegExp(`(?<![a-z0-9])${escapeRe(p)}(?![a-z0-9])`).exec(text);
    return m ? m.index : -1;
  }
  // Indic: the phrase must start a word (so "தி நகர்" does not match inside "காந்தி நகர்"),
  // but may run into a case ending at the end.
  let at = text.indexOf(p);
  while (at >= 0) {
    const prev = text[at - 1];
    if (at === 0 || prev === " " || /[\x00-\x7F]/.test(prev)) return at;
    at = text.indexOf(p, at + 1);
  }
  return -1;
}

function firstHit(text: string, phrases: string[]): { phrase: string; at: number } | null {
  let best: { phrase: string; at: number } | null = null;
  for (const ph of phrases) {
    const at = find(text, ph);
    if (at >= 0 && (!best || at < best.at)) best = { phrase: ph, at };
  }
  return best;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

// ------------------------------------------------------------------ locality
// Hindi and Telugu callers get place names written in their own script.
const OTHER_SCRIPTS: Record<string, string[]> = {
  sholinganallur: ["शोलिंगनल्लूर", "शोलिंगनल्लुर", "సోళింగనల్లూర్"],
  perungudi: ["पेरुंगुडी", "पेरुंगुड़ी", "పెరుంగుడి"],
  thoraipakkam: ["थोरैपक्कम", "తొరైపాక్కం"],
  velachery: ["वेलाचेरी", "वेलचेरी", "వేలచేరి"],
  tambaram: ["तांबरम", "ताम्बरम", "తాంబరం"],
  guindy: ["गिंडी", "గిండీ"],
  ambattur: ["अंबत्तूर", "అంబత్తూర్"],
  porur: ["पोरूर", "పోరూర్"],
  madipakkam: ["मडिपक्कम", "మడిపాక్కం"],
  pallikaranai: ["पल्लीकरनई", "पल्लिकरणै", "పల్లికరణై"],
  tnagar: ["टी नगर", "టి నగర్"],
  annanagar: ["अन्ना नगर", "అన్నా నగర్"],
  manali: ["मनाली", "మనాలి", "మణలి"],
  ennore: ["एन्नोर", "ఎన్నూర్"],
  kodungaiyur: ["कोडुंगैयूर", "కొడుంగైయూర్"],
  perambur: ["पेरम्बूर", "పెరంబూర్"],
  egmore: ["एग्मोर", "ఎగ్మోర్"],
  semmencherry: ["सेम्मनचेरी", "సెమ్మంచేరి"],
  karapakkam: ["करपक्कम", "కారపాక్కం"],
  kannaginagar: ["कन्नगी नगर", "కన్నగి నగర్"],
};

interface Cand {
  loc: Locality;
  phrase: string;
}
const CANDIDATES: Cand[] = LOCALITIES.flatMap((loc) => {
  const phrases = [loc.en, loc.ta, ...loc.aliases, ...(OTHER_SCRIPTS[loc.id] ?? [])];
  // Tamil case endings change the last letter: தாம்பரம் → தாம்பரத்துல, கொளத்தூர் → கொளத்தூரில்,
  // புளியந்தோப்பு → புளியந்தோப்பில். Match a stem without the final ம், virama or உ sign as well.
  const stems = phrases
    .filter((p) => /[\u0B80-\u0BFF]$/.test(p) && p.length > 4)
    .map((p) => (p.endsWith("ம்") ? p.slice(0, -2) : p.endsWith("\u0BCD") || p.endsWith("\u0BC1") ? p.slice(0, -1) : p))
    .filter((s) => s.length >= 4);
  // candidates go through the same normalisation as transcripts ("கே.கே.நகர்" → "கே கே நகர்")
  return [...new Set([...phrases, ...stems].map((p) => normalise(p).trim()))].filter((p) => p.length >= 3).map((phrase) => ({ loc, phrase }));
}).sort((a, b) => b.phrase.length - a.phrase.length);

export function findLocalities(text: string): { loc: Locality; match: string; at: number }[] {
  const t = normalise(text);
  const hits: { loc: Locality; match: string; at: number; len: number }[] = [];
  const taken: [number, number][] = [];
  for (const c of CANDIDATES) {
    const at = find(t, c.phrase);
    if (at < 0) continue;
    const end = at + c.phrase.length;
    if (taken.some(([s, e]) => at < e && end > s)) continue; // longer phrase already claimed this span
    taken.push([at, end]);
    if (!hits.some((h) => h.loc.id === c.loc.id)) hits.push({ loc: c.loc, match: c.phrase, at, len: c.phrase.length });
  }
  // Fuzzy fallback for Latin spellings the recogniser bends (Pallikarnai, Velacheri).
  if (!hits.length) {
    const tokens = t.trim().split(" ").filter((w) => isLatin(w) && w.length >= 5);
    for (const tok of tokens) {
      let best: { c: Cand; d: number } | null = null;
      for (const c of CANDIDATES) {
        if (!isLatin(c.phrase) || c.phrase.includes(" ") || c.phrase.length < 6) continue;
        // a Latin name with a case ending glued on: "perungudiyil", "velacheryla"
        if (tok.startsWith(c.phrase) && tok.length - c.phrase.length <= 4) {
          best = { c, d: 0 };
          break;
        }
        const d = levenshtein(tok, c.phrase);
        if (d <= Math.max(1, Math.floor(c.phrase.length * 0.18)) && (!best || d < best.d)) best = { c, d };
      }
      if (best && !hits.some((h) => h.loc.id === best!.c.loc.id)) hits.push({ loc: best.c.loc, match: tok, at: t.indexOf(tok), len: tok.length });
    }
  }
  return hits.sort((a, b) => a.at - b.at);
}

// ------------------------------------------------------------------ landmark
const NEAR_TA = ["பக்கத்துல", "பக்கத்தில்", "பக்கத்தில", "பக்கம்", "அருகில்", "அருகே", "கிட்ட", "எதிர்ல", "எதிரில்", "எதிரே", "பின்னாடி", "பின்னால்"];
const NEAR_EN = ["near", "opposite", "behind", "next to", "beside", "close to", "opp"];
const NEAR_HI = ["के पास", "के सामने", "के पीछे"];
const NEAR_TE = ["దగ్గర", "ఎదురుగా", "వెనుక"];
const STREET = ["main road", "cross street", "street", "road", "nagar", "colony", "avenue", "lane", "salai", "block", "apartment", "apartments", "flats", "school", "church", "temple", "kovil", "masjid", "bus stand", "bus stop", "signal", "subway", "bridge", "hospital", "தெரு", "சாலை", "ரோடு", "நகர்", "காலனி", "கோவில்", "பள்ளி", "மசூதி", "பாலம்"];

const STOP_BEFORE_STREET = new Set(["our", "the", "my", "this", "that", "a", "எங்க", "எங்கள்", "அந்த", "இந்த", "அறுந்து", "விழுந்து", "full", "முழுக்க", "हमारे", "हमारी", "మా"]);

function landmarkFrom(text: string, locs: Locality[], primaryMatch?: string): string | undefined {
  let raw = text.normalize("NFC").replace(/\s+/g, " ").trim();
  if (primaryMatch) {
    // take the caller's own area out first, so "கண்ணகி நகரில் எங்கள் block" doesn't become a landmark
    const i = raw.toLowerCase().indexOf(primaryMatch.toLowerCase());
    if (i >= 0) {
      let j = i + primaryMatch.length;
      while (j < raw.length && raw[j] !== " " && raw[j] !== ",") j++;
      raw = `${raw.slice(0, i)} , ${raw.slice(j)}`.replace(/\s+/g, " ").trim();
    }
  }
  const words = raw.split(" ");
  // only the caller's own area is dropped from the landmark; a second area ("Velachery main road") is the landmark
  const placeWords = locs.slice(0, 1).flatMap((l) => [l.en, l.ta, ...l.aliases]).map((p) => p.toLowerCase());
  const isPlaceTok = (w: string) => {
    const x = w.toLowerCase().replace(PUNCT, "").split("-")[0];
    return x.length > 2 && placeWords.some((p) => p === x || (p.length > 4 && x.startsWith(p)) || (x.length > 4 && p.startsWith(x)));
  };
  const clean = (s: string) =>
    s
      .split(" ")
      .filter((w) => w && !isPlaceTok(w))
      .join(" ")
      .replace(/-(ல|இல்|யில்|ல்ல|லே|ல்)$/u, "")
      .replace(/(-ல|-இல்|-யில்)\b/gu, "")
      .replace(/^[,.\s-]+|[,.\s-]+$/g, "");
  const isPlace = (s: string) => locs.some((l) => s.toLowerCase().includes(l.en.toLowerCase()) || s.includes(l.ta));

  // "X Y பக்கத்துல" — up to three words before the Tamil/Hindi/Telugu marker
  for (let i = 0; i < words.length; i++) {
    const w = words[i].replace(PUNCT, "");
    const hit = [...NEAR_TA, ...NEAR_TE].find((m) => w.endsWith(m) || w === m);
    if (hit) {
      const head = w === hit ? [] : [w.slice(0, w.length - hit.length)];
      const span = words.slice(Math.max(0, i - 3), i).concat(head).join(" ");
      const out = clean(span.split(/[,.]/).pop() ?? span);
      if (out.length >= 3) return out;
    }
  }
  for (const m of NEAR_HI) {
    const idx = raw.indexOf(m);
    if (idx > 0) {
      const out = clean(raw.slice(0, idx).split(/[,.।]/).pop()!.split(" ").slice(-3).join(" "));
      if (out.length >= 3) return out;
    }
  }
  // "near Velachery main road"
  const lower = raw.toLowerCase();
  for (const m of NEAR_EN) {
    const re = new RegExp(`(?<![a-z])${escapeRe(m)}\\s+([^,.;]{3,40})`, "i");
    const mm = re.exec(lower);
    if (mm) {
      const span = raw.slice(mm.index + m.length).trim().split(/[,.;]/)[0].split(" ").slice(0, 4).join(" ");
      const out = clean(span);
      if (out.length >= 3) return out;
    }
  }
  // "... Gandhi street", "... கோவில் தெரு"
  for (let i = 1; i < words.length; i++) {
    const w = words[i].replace(PUNCT, "").toLowerCase().split("-")[0];
    const st = STREET.find((s) => w === s || (s.includes(" ") && `${words[i - 1] ?? ""} ${w}`.toLowerCase().endsWith(s)));
    if (st && /^(block|jam|full|close|closed)/i.test(words[i + 1] ?? "")) continue;
    if (st && STOP_BEFORE_STREET.has((words[i - 1] ?? "").toLowerCase().replace(PUNCT, ""))) continue;
    if (st) {
      const span = words.slice(Math.max(0, i - 2), i + 1).join(" ");
      const out = clean(span.split(/[,.]/).pop() ?? span);
      if (out.length >= 4 && !(isPlace(out) && out.split(" ").length === 1)) return out;
    }
  }
  return undefined;
}

// ------------------------------------------------------------------ numbers
const NUM: Record<string, number> = {
  // Tamil
  "ஒரு": 1, "ஒன்று": 1, "ஒண்ணு": 1, "ரெண்டு": 2, "இரண்டு": 2, "மூணு": 3, "மூன்று": 3, "நாலு": 4, "நான்கு": 4,
  "அஞ்சு": 5, "ஐந்து": 5, "ஆறு": 6, "ஏழு": 7, "எட்டு": 8, "ஒன்பது": 9, "பத்து": 10, "பதினொன்று": 11,
  "பன்னிரண்டு": 12, "பதினைந்து": 15, "இருபது": 20, "முப்பது": 30, "நாற்பது": 40, "ஐம்பது": 50,
  // English
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  // Hindi
  "एक": 1, "दो": 2, "तीन": 3, "चार": 4, "पांच": 5, "पाँच": 5, "छह": 6, "छः": 6, "सात": 7, "आठ": 8, "नौ": 9, "दस": 10, "बीस": 20,
  // Telugu
  "ఒక": 1, "ఒకటి": 1, "రెండు": 2, "మూడు": 3, "నాలుగు": 4, "ఐదు": 5, "ఆరు": 6, "ఏడు": 7, "ఎనిమిది": 8, "పది": 10,
};
const PERSON_WORDS_TE: Record<string, number> = { "ఇద్దరు": 2, "ముగ్గురు": 3, "నలుగురు": 4, "ఐదుగురు": 5, "ఆరుగురు": 6, "ఏడుగురు": 7, "పదిమంది": 10 };
const PEOPLE_UNIT = ["பேர்", "பேரு", "பேரும்", "பேர்கள்", "ஆட்கள்", "ஆளுங்க", "people", "persons", "person", "members", "member", "of us", "workers", "labourers", "लोग", "लोगों", "जन", "मजदूर", "మంది"];

function numberAt(token: string): number | undefined {
  const t = token.replace(PUNCT, "");
  if (/^\d{1,3}$/.test(t)) return Number(t);
  return NUM[t];
}

function peopleFrom(text: string): { n: number; match: string } | undefined {
  const words = normalise(text).trim().split(" ");
  for (let i = 0; i < words.length; i++) {
    if (PERSON_WORDS_TE[words[i]]) return { n: PERSON_WORDS_TE[words[i]], match: words[i] };
    const n = numberAt(words[i]);
    if (n === undefined || n === 0 || n > 200) continue;
    const next = words.slice(i + 1, i + 3).join(" ");
    const unit = PEOPLE_UNIT.find((u) => next.startsWith(u) || words[i + 1]?.startsWith(u));
    if (unit) return { n, match: `${words[i]} ${unit}` };
    if (["families", "family", "குடும்பம்", "குடும்பங்கள்", "परिवार", "కుటుంబాలు"].includes(words[i + 1] ?? "") && n > 1) {
      return { n: n * 4, match: `${words[i]} ${words[i + 1]}` };
    }
  }
  const fam = /family of (\w+)/.exec(normalise(text));
  if (fam) {
    const n = numberAt(fam[1]);
    if (n) return { n, match: fam[0] };
  }
  return undefined;
}

// ------------------------------------------------------------------ water
const LEVEL_WORDS: [WaterLevel, string[]][] = [
  // Tamil entries are stems: the recogniser writes நெஞ்சு / நெஞ்ச / நெஞ்சளவு for the same word
  ["neck", ["கழுத்", "neck level", "neck deep", "neck", "गले", "गर्दन", "మెడ"]],
  ["chest", ["நெஞ்ச", "மார்பு", "chest level", "chest deep", "chest", "छाती", "सीने", "ఛాతీ"]],
  // "waste level" is how the recogniser often hears "waist level" in Tanglish; both mean the same here
  ["waist", ["இடுப்", "waist level", "waist deep", "waist", "waste level", "waste deep", "வேஸ்ட் லெவல்", "hip level", "कमर", "నడుము"]],
  ["knee", ["முட்டி", "முழங்கால", "knee level", "knee deep", "knee", "knees", "घुटन", "घुटने", "మోకాలి", "మోకాళ్ల", "మోకాలు"]],
  ["ankle", ["கணுக்கால்", "ankle level", "ankle deep", "ankle", "टखने", "చీలమండ"]],
];
const WATER_WORDS = ["தண்ணி", "தண்ணீர்", "வெள்ளம்", "water", "flood", "flooded", "flooding", "पानी", "बाढ़", "నీళ్ళు", "నీరు", "నీళ్లు", "వరద"];

function waterFrom(text: string): { level: WaterLevel; match: string } | undefined {
  const t = normalise(text);
  for (const [level, words] of LEVEL_WORDS) {
    for (const w of words) {
      const at = find(t, w);
      if (at < 0) continue;
      const after = t.slice(at + w.length, at + w.length + 12);
      if ((level === "chest" || level === "neck") && /pain|வலி|दर्द|నొప్పి/.test(after)) continue; // chest pain is medical
      return { level, match: w };
    }
  }
  const feet = /(\d+(?:\.\d+)?|அரை|ஒரு|ஒன்று|ரெண்டு|இரண்டு|மூணு|மூன்று|நாலு|நான்கு|அஞ்சு|ஐந்து|ஆறு|half|one|two|three|four|five|six)\s*(அடி|feet|foot|ft)(?![a-z])/.exec(t);
  if (feet) {
    const v = feet[1] === "அரை" || feet[1] === "half" ? 0.5 : numberAt(feet[1]) ?? Number(feet[1]);
    const level: WaterLevel = v <= 1 ? "ankle" : v <= 2 ? "knee" : v <= 3 ? "waist" : v <= 4 ? "chest" : "neck";
    return { level, match: feet[0].trim() };
  }
  if (find(t, "ground floor") >= 0 && /(full|முழுக்க|fully|submerged|மூழ்கி|போயிடுச்சு)/.test(t)) return { level: "chest", match: "ground floor full" };
  return undefined;
}

// ------------------------------------------------------------------ lexicons
const VULN: [Vulnerable, string[]][] = [
  ["bedridden", ["படுத்த படுக்கை", "படுக்கையிலேயே", "படுக்கையில", "bedridden", "bed ridden", "bed-ridden", "paralysed", "paralyzed", "stroke patient", "பக்கவாதம்", "बिस्तर", "మంచాన"]],
  ["infant", ["கைக்குழந்தை", "பச்ச குழந்தை", "பச்சக் குழந்தை", "பச்சை குழந்தை", "பச்சைக் குழந்தை", "மாச குழந்தை", "மாசக் குழந்தை", "baby", "infant", "newborn", "new born", "शिशु", "नवजात", "పసిబిడ్డ", "పసి పాప"]],
  ["child", ["குழந்தை", "குழந்தைங்க", "கொழந்த", "பசங்க", "kids", "children", "child", "बच्चा", "बच्चे", "పిల్లలు", "పాప", "బాబు"]],
  ["elderly", ["வயசானவங்க", "வயசானவர்", "வயசான", "வயதான", "வயதானவர்", "முதியவர்", "பாட்டி", "தாத்தா", "ஆயா", "elderly", "old age", "old man", "old woman", "old lady", "senior citizen", "grandmother", "grandfather", "grandma", "grandpa", "paati", "thatha", "बुजुर्ग", "बूढ़", "दादी", "दादा", "नानी", "नाना", "వృద్ధ", "ముసలి", "తాత", "అవ్వ", "బామ్మ", "ముసలావిడ"]],
  ["pregnant", ["கர்ப்பிணி", "கர்ப்பமா", "கர்ப்பம்", "மாசமா", "pregnant", "pregnancy", "गर्भवती", "प्रेग्नेंट", "గర్భిణి", "ప్రెగ్నెంట్"]],
  ["dialysis", ["dialysis", "டயாலிசிஸ்", "டயாலிஸிஸ்", "kidney patient", "डायलिसिस", "డయాలసిస్"]],
  ["disabled", ["மாற்றுத்திறனாளி", "wheelchair", "வீல்சேர்", "disabled", "handicapped", "நடக்க முடியாது", "நடக்க முடியாத", "विकलांग", "व्हीलचेयर", "వికలాంగ", "దివ్యాంగ"]],
  ["oxygen", ["oxygen", "ஆக்சிஜன்", "ஆக்ஸிஜன்", "ventilator", "ऑक्सीजन", "ఆక్సిజన్"]],
  ["sick", ["உடம்பு சரியில்ல", "உடம்பு சரியில்லை", "sugar patient", "heart patient", "bp patient", "காய்ச்சல்", "fever", "बीमार", "జ్వరం"]],
];
const NONE_WORDS = ["யாரும் இல்ல", "யாரும் இல்லை", "அப்படி யாரும்", "no one", "nobody", "none", "no elderly", "everyone is fine", "எல்லாரும் நல்லா", "कोई नहीं", "ఎవరూ లేరు"];

const HAZ: [Hazard, string[]][] = [
  ["trapped", ["மாட்டிக்கிட்டோம்", "மாட்டிகிட்டோம்", "மாட்டிக்கிட்டு", "மாட்டிட்டோம்", "மாட்டிருக்கோம்", "சிக்கிட்டோம்", "சிக்கியிருக்கோம்", "சிக்கி", "வெளியே வர முடியல", "வெளிய வர முடியல", "வெளியே போக முடியல", "வெளிய போக முடியல", "stuck", "trapped", "can't get out", "cannot get out", "no way out", "फंस", "फँस", "बाहर नहीं निकल", "చిక్కుకు", "బయటకు రాలేక"]],
  ["stranded", ["மொட்டை மாடி", "terrace", "மாடி மேல", "roof", "छत", "డాబా"]],
  ["medical", ["மூச்சு விட முடியல", "மூச்சு திணறல்", "மூச்சு வாங்குது", "breathing problem", "can't breathe", "breathless", "chest pain", "நெஞ்சு வலி", "heart attack", "மயக்கம்", "மயங்கி", "unconscious", "fainted", "bleeding", "ரத்தம்", "வலிப்பு", "fits", "seizure", "ambulance", "பாம்பு கடி", "snake bite", "सांस", "बेहोश", "खून", "ఊపిరి", "స్పృహ"]],
  // "EV wire" is a frequent mishearing of "EB wire" (Electricity Board) on noisy lines
  ["liveWire", ["current wire", "கரண்ட் wire", "current கம்பி", "கரண்ட் கம்பி", "மின் கம்பி", "மின்சார கம்பி", "eb wire", "ev wire", "ev wires", "eb wires", "live wire", "wire அறுந்து", "wire விழுந்து", "wire fallen", "wire fell", "shock", "ஷாக்", "transformer", "spark", "बिजली का तार", "करंट", "కరెంట్ తీగ", "వైర్"]],
  ["treeFall", ["மரம் விழுந்து", "மரம் விழுந்துடுச்சு", "மரம் சாய்ஞ்சு", "மரம் சாஞ்சு", "மரம் முறிஞ்சு", "tree fell", "tree fall", "tree fallen", "fallen tree", "tree has fallen", "पेड़ गिर", "చెట్టు పడి", "చెట్టు విరిగి"]],
  ["powerCut", ["current இல்ல", "கரண்ட் இல்ல", "current இல்லை", "கரண்ட் இல்லை", "current illa", "power இல்ல", "power cut", "no power", "no current", "no electricity", "eb cut", "மின்சாரம் இல்ல", "बिजली नहीं", "लाइट नहीं", "కరెంట్ లేదు", "పవర్ లేదు"]],
  ["insideHome", ["வீட்டுக்குள்ள", "வீட்டுக்குள்", "வீட்டுக்குள்ளே", "inside the house", "inside house", "inside our house", "into the house", "into our house", "घर में पानी", "घर के अंदर", "ఇంట్లోకి"]],
];

const NEEDS: [Need, string[]][] = [
  ["rescue", ["boat", "படகு", "rescue", "காப்பாத்துங்க", "காப்பாத்த", "காப்பாற்ற", "evacuate", "evacuation", "shift பண்ண", "வெளியே கொண்டு", "relief camp", "नाव", "बचाओ", "बचाइए", "निकालो", "బోటు", "కాపాడండి"]],
  ["food", ["சாப்பாடு", "உணவு", "food", "பால்", "milk", "biscuit", "bread", "खाना", "दूध", "భోజనం", "ఆహారం", "పాలు"]],
  ["water", ["குடிநீர்", "குடிக்க தண்ணி", "குடிக்க தண்ணீர்", "drinking water", "water bottle", "पीने का पानी", "తాగు నీరు", "తాగడానికి నీళ్ళు"]],
  ["medicine", ["மருந்து", "மாத்திரை", "medicine", "medicines", "tablet", "tablets", "insulin", "inhaler", "दवा", "दवाई", "మందు", "మాత్రలు"]],
];

// Short Hindi answers ("हाँ, सही है") are sometimes written in Tamil script on a Tamil-first line: ஆ, சஹி.
const YES = ["ஆமா", "ஆமாம்", "ஆம்", "ஆ", "சரி", "சரிதான்", "கரெக்ட்", "சஹி", "ஹான்", "ஹாங்", "ஹா", "correct", "yes", "yeah", "yep", "right", "haan", "ha", "हाँ", "हां", "जी", "सही", "అవును", "సరే", "ఔను", "అదే"];
const NO = ["இல்ல", "இல்லை", "இல்லீங்க", "இல்லங்க", "தப்பு", "no", "nope", "wrong", "not correct", "नहीं", "ना", "गलत", "కాదు", "లేదు", "తప్పు"];

function collect<T extends string>(t: string, table: [T, string[]][], evidence: Evidence[], field: string): T[] {
  const out: T[] = [];
  for (const [tag, words] of table) {
    const hit = firstHit(t, words);
    if (hit) {
      out.push(tag);
      evidence.push({ field, value: tag, match: hit.phrase });
    }
  }
  return out;
}

// ------------------------------------------------------------------ main
export function extract(text: string): Extraction {
  const t = normalise(text);
  const evidence: Evidence[] = [];
  const locs = findLocalities(text);
  const ex: Extraction = { otherLocalities: [], vulnerable: [], vulnerableNone: false, hazards: [], needs: [], evidence };

  if (locs.length) {
    ex.locality = locs[0].loc;
    ex.localityMatch = locs[0].match;
    ex.otherLocalities = locs.slice(1).map((l) => l.loc);
    evidence.push({ field: "locality", value: locs[0].loc.en, match: locs[0].match });
  }
  const lm = landmarkFrom(text, locs.map((l) => l.loc), locs[0]?.match);
  if (lm) {
    ex.landmark = lm;
    evidence.push({ field: "landmark", value: lm, match: lm });
  } else if (ex.otherLocalities.length) {
    ex.landmark = ex.otherLocalities[0].en;
  }

  const w = waterFrom(text);
  if (w && (WATER_WORDS.some((x) => find(t, x) >= 0) || /level|deep|அளவு|வரை|వరకు|तक/.test(t) || w.match.includes(" "))) {
    ex.waterLevel = w.level;
    evidence.push({ field: "water", value: w.level, match: w.match });
  } else if (w) {
    ex.waterLevel = w.level;
    evidence.push({ field: "water", value: w.level, match: w.match });
  }

  const p = peopleFrom(text);
  if (p) {
    ex.people = p.n;
    evidence.push({ field: "people", value: String(p.n), match: p.match });
  }

  ex.vulnerable = collect(t, VULN, evidence, "vulnerable");
  // a baby is also a child; keep the stronger tag only
  if (ex.vulnerable.includes("infant")) ex.vulnerable = ex.vulnerable.filter((v) => v !== "child");
  if (!ex.vulnerable.length && firstHit(t, NONE_WORDS)) ex.vulnerableNone = true;

  ex.hazards = collect(t, HAZ, evidence, "hazard");
  ex.needs = collect(t, NEEDS, evidence, "need");

  const head = t.trim().split(" ").slice(0, 3).join(" ");
  const yes = firstHit(` ${head} `, YES);
  const no = firstHit(` ${head} `, NO);
  if (yes && (!no || yes.at <= no.at)) ex.confirm = "yes";
  else if (no) ex.confirm = "no";
  // "current இல்ல" is a power cut, not a "no"
  if (ex.confirm === "no" && ex.hazards.includes("powerCut") && !/^\s*(இல்ல|இல்லை|no|नहीं|లేదు)/.test(t)) ex.confirm = undefined;

  return ex;
}

export const LEVEL_RANK: Record<WaterLevel, number> = { none: 0, ankle: 1, knee: 2, waist: 3, chest: 4, neck: 5 };
