// Priority is decided by fixed rules, never by a model. Each rule is listed on the ticket
// so an officer (or an interviewer) can see exactly why a call is P1.
import { LEVEL_RANK, type Hazard, type Need, type Vulnerable, type WaterLevel } from "./extract.ts";

export interface TriageInput {
  waterLevel?: WaterLevel;
  people?: number;
  vulnerable: Vulnerable[];
  hazards: Hazard[];
  needs: Need[];
  localityKnown: boolean;
}

export interface RuleHit {
  id: string;
  priority: 1 | 2 | 3;
  label: string;
}

export interface Triage {
  priority: 1 | 2 | 3;
  score: number;
  rules: RuleHit[];
}

const HIGH_RISK: Vulnerable[] = ["bedridden", "infant", "pregnant", "dialysis", "disabled", "oxygen"];

export function triage(i: TriageInput): Triage {
  const has = (h: Hazard) => i.hazards.includes(h);
  // water inside the home counts as at least ankle level until the caller says how high
  const lvl = Math.max(i.waterLevel ? LEVEL_RANK[i.waterLevel] : 0, has("insideHome") ? LEVEL_RANK.ankle : 0);
  const lvlName = i.waterLevel ?? (has("insideHome") ? "ankle (inside home)" : "unknown");
  const highRisk = i.vulnerable.filter((v) => HIGH_RISK.includes(v));
  const anyVuln = i.vulnerable.length > 0;
  const rules: RuleHit[] = [];
  const add = (id: string, priority: 1 | 2 | 3, label: string) => rules.push({ id, priority, label });

  if (has("trapped")) add("R1", 1, "People trapped, cannot get out");
  if (has("medical")) add("R2", 1, "Medical emergency reported");
  if (lvl >= LEVEL_RANK.chest) add("R3", 1, `Water at ${lvlName} level`);
  if (highRisk.length && lvl >= LEVEL_RANK.waist) add("R4", 1, `${highRisk.join(", ")} with water at ${lvlName}`);
  if (has("liveWire") && (lvl >= LEVEL_RANK.ankle || has("insideHome"))) add("R5", 1, "Live wire in flood water");

  if (lvl >= LEVEL_RANK.waist && !rules.some((r) => r.id === "R3")) add("R6", 2, `Water at ${lvlName} level`);
  if (anyVuln && (lvl >= LEVEL_RANK.knee || has("insideHome")) && !rules.some((r) => r.id === "R4")) add("R7", 2, `${i.vulnerable.join(", ")} present, water at ${lvlName}`);
  if (highRisk.length && lvl < LEVEL_RANK.waist) add("R8", 2, `${highRisk.join(", ")} needs priority evacuation`);
  if (has("liveWire") && !rules.some((r) => r.id === "R5")) add("R9", 2, "Fallen or live electric wire");
  if (has("treeFall")) add("R10", 2, "Fallen tree blocking access");
  if (has("stranded")) add("R11", 2, "Family stranded on terrace");
  if ((i.people ?? 0) >= 10) add("R12", 2, `${i.people} people at one location`);
  if (i.needs.includes("medicine") && anyVuln) add("R13", 2, "Medicine needed for a vulnerable person");

  if (i.needs.includes("rescue") && !rules.length) add("R14", 3, "Evacuation requested");
  if (i.needs.includes("food") || i.needs.includes("water")) add("R15", 3, "Food or drinking water needed");
  if (has("powerCut")) add("R16", 3, "Power cut");
  if (lvl >= LEVEL_RANK.ankle && lvl < LEVEL_RANK.waist && !anyVuln) add("R17", 3, `Waterlogging at ${lvlName} level`);
  if (!rules.length) add("R0", 3, "Information pending");

  const priority = Math.min(...rules.map((r) => r.priority)) as 1 | 2 | 3;
  const score =
    (4 - priority) * 100 +
    lvl * 6 +
    highRisk.length * 10 +
    i.vulnerable.length * 4 +
    Math.min(i.people ?? 1, 20) +
    rules.filter((r) => r.priority === 1).length * 8 +
    (i.localityKnown ? 0 : -5);
  return { priority, score, rules };
}
