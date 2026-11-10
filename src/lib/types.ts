export type WaterLevel = "none" | "ankle" | "knee" | "waist" | "chest" | "neck";

export interface TurnLog {
  role: "caller" | "thunai";
  text: string;
  lang: string;
  at: number;
  audio?: string;
  sttMs?: number | null;
  roundTripMs?: number;
  noise?: string;
}

export interface Ticket {
  id: string;
  seq: number;
  source: "call" | "voicenote";
  status: "live" | "open" | "dispatched" | "resolved";
  createdAt: number;
  updatedAt: number;
  closedAt?: number;
  caller: string;
  lang: string;
  locality: { id: string; en: string; ta: string; zone: string; lat: number; lng: number } | null;
  localityConfirmed: boolean;
  landmark?: string;
  lat: number | null;
  lng: number | null;
  waterLevel?: WaterLevel;
  people?: number;
  vulnerable: string[];
  hazards: string[];
  needs: string[];
  priority: 1 | 2 | 3;
  score: number;
  rules: { id: string; priority: 1 | 2 | 3; label: string }[];
  transcript: TurnLog[];
  evidence: { field: string; value: string; match: string }[];
  cluster?: { key: string; size: number };
  synthetic: true;
}

export interface Meta {
  localities: { id: string; en: string; ta: string; lat: number; lng: number; zone: string; floodProne: boolean }[];
  zones: string[];
  keyterms: string[];
  topic: string;
  llm: boolean;
}

export interface Reply {
  text: string;
  lang: string;
  audio: { url: string; ttsMs: number; cached: boolean };
  step: string;
}

export interface TurnResponse {
  caller: { transcript: string; lang: string | null; sttMs: number | null; roundTripMs: number; requestId: string | null; audio: string };
  extraction: { evidence: { field: string; value: string; match: string }[]; confirm?: string };
  reply: Reply;
  done: boolean;
  ticket: Ticket;
  timings: { totalMs: number; llmMs: number };
}

export const PRIORITY = {
  1: { label: "Critical", ta: "அவசரம்", color: "var(--color-p1)", hex: "#ff4b2b" },
  2: { label: "Urgent", ta: "விரைவு", color: "var(--color-p2)", hex: "#ffab1f" },
  3: { label: "Relief", ta: "நிவாரணம்", color: "var(--color-p3)", hex: "#3fb8af" },
} as const;

export const LEVELS: { id: WaterLevel; en: string; ta: string; h: number }[] = [
  { id: "ankle", en: "Ankle", ta: "கணுக்கால்", h: 0.14 },
  { id: "knee", en: "Knee", ta: "முட்டி", h: 0.3 },
  { id: "waist", en: "Waist", ta: "இடுப்பு", h: 0.52 },
  { id: "chest", en: "Chest", ta: "நெஞ்சு", h: 0.72 },
  { id: "neck", en: "Neck", ta: "கழுத்து", h: 0.88 },
];

export const VULN_LABEL: Record<string, { en: string; ta: string }> = {
  elderly: { en: "Elderly", ta: "முதியவர்" },
  bedridden: { en: "Bedridden", ta: "படுக்கை நோயாளி" },
  infant: { en: "Infant", ta: "கைக்குழந்தை" },
  child: { en: "Children", ta: "குழந்தைகள்" },
  pregnant: { en: "Pregnant", ta: "கர்ப்பிணி" },
  dialysis: { en: "Dialysis", ta: "டயாலிசிஸ்" },
  disabled: { en: "Disabled", ta: "மாற்றுத்திறனாளி" },
  oxygen: { en: "On oxygen", ta: "ஆக்சிஜன்" },
  sick: { en: "Unwell", ta: "உடல்நலக்குறைவு" },
};

export const HAZARD_LABEL: Record<string, string> = {
  trapped: "Trapped",
  stranded: "On terrace",
  medical: "Medical",
  liveWire: "Live wire",
  treeFall: "Tree down",
  powerCut: "No power",
  insideHome: "Water inside",
};

export const NEED_LABEL: Record<string, string> = {
  rescue: "Boat / rescue",
  food: "Food",
  water: "Drinking water",
  medicine: "Medicine",
};

export const LANG_LABEL: Record<string, string> = {
  "ta-IN": "தமிழ் · Tanglish",
  "en-IN": "English",
  "hi-IN": "हिन्दी",
  "te-IN": "తెలుగు",
};
