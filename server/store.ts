import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Response } from "express";
import { CACHE_DIR } from "./env.ts";
import type { Hazard, Need, Vulnerable, WaterLevel } from "./extract.ts";
import type { RuleHit } from "./triage.ts";

export interface TurnLog {
  role: "caller" | "thunai";
  text: string;
  lang: string;
  at: number;
  audio?: string; // url
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
  vulnerable: Vulnerable[];
  hazards: Hazard[];
  needs: Need[];
  priority: 1 | 2 | 3;
  score: number;
  rules: RuleHit[];
  transcript: TurnLog[];
  evidence: { field: string; value: string; match: string }[];
  cluster?: { key: string; size: number };
  synthetic: true;
}

const FILE = path.join(CACHE_DIR, "tickets.json");
mkdirSync(CACHE_DIR, { recursive: true });

class Store {
  tickets = new Map<string, Ticket>();
  seq = 41;
  private clients = new Set<Response>();

  constructor() {
    if (existsSync(FILE)) {
      try {
        const saved = JSON.parse(readFileSync(FILE, "utf8")) as { seq: number; tickets: Ticket[] };
        this.seq = saved.seq;
        for (const t of saved.tickets) this.tickets.set(t.id, t);
      } catch {
        /* start clean */
      }
    }
  }

  nextId(): { id: string; seq: number } {
    this.seq += 1;
    return { id: `SYN-1913-${String(this.seq).padStart(4, "0")}`, seq: this.seq };
  }

  list(): Ticket[] {
    return [...this.tickets.values()].sort((a, b) => b.score - a.score || a.createdAt - b.createdAt);
  }

  upsert(t: Ticket): void {
    t.updatedAt = Date.now();
    this.tickets.set(t.id, t);
    this.recluster();
    this.persist();
    this.emit("ticket", t);
    for (const other of this.tickets.values()) if (other.id !== t.id && other.cluster?.key === t.cluster?.key) this.emit("ticket", other);
  }

  reset(): void {
    this.tickets.clear();
    this.seq = 41;
    this.persist();
    this.emit("reset", {});
  }

  /** Reports from the same locality and landmark within 90 minutes count as one incident. */
  private recluster(): void {
    const groups = new Map<string, Ticket[]>();
    for (const t of this.tickets.values()) {
      if (!t.locality) continue;
      const lm = (t.landmark ?? "").toLowerCase().replace(/\s+/g, " ").slice(0, 18);
      const key = `${t.locality.id}|${lm}`;
      groups.set(key, [...(groups.get(key) ?? []), t]);
    }
    for (const [key, ts] of groups) {
      ts.sort((a, b) => a.createdAt - b.createdAt);
      const recent = ts.filter((t) => Math.abs(t.createdAt - ts[ts.length - 1].createdAt) < 90 * 60_000);
      for (const t of ts) t.cluster = recent.length > 1 && recent.includes(t) ? { key, size: recent.length } : undefined;
    }
  }

  private persistTimer: NodeJS.Timeout | null = null;
  private persist(): void {
    if (this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      writeFileSync(FILE, JSON.stringify({ seq: this.seq, tickets: [...this.tickets.values()] }));
    }, 300);
  }

  subscribe(res: Response): void {
    this.clients.add(res);
    res.on("close", () => this.clients.delete(res));
  }

  emit(type: string, data: unknown): void {
    const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const c of this.clients) c.write(payload);
  }
}

export const store = new Store();

/** Spread pins inside a locality so separate reports don't stack on one point. */
export function jitter(lat: number, lng: number, seq: number): [number, number] {
  const a = (seq * 137.508 * Math.PI) / 180;
  const r = 0.0012 + ((seq * 7919) % 100) / 100 * 0.0028;
  return [lat + Math.sin(a) * r, lng + Math.cos(a) * r];
}

export function syntheticCaller(seq: number): string {
  return `+91 00000 ${String(10000 + ((seq * 7349) % 89999)).padStart(5, "0")}`;
}
