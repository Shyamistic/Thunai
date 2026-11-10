import { useEffect, useMemo, useRef, useState } from "react";
import type { Meta, Reply, Ticket, TurnResponse } from "./types.ts";

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  return body as T;
}

export const api = {
  meta: () => fetch("/api/meta").then((r) => json<Meta>(r)),
  health: () => fetch("/api/health").then((r) => json<{ ok: boolean; llm: boolean; keyterms: number }>(r)),
  startCall: () => fetch("/api/call/start", { method: "POST" }).then((r) => json<{ callId: string; ticketId: string; reply: Reply; ticket: Ticket }>(r)),
  turn: (callId: string, wav: Blob, noise: string) => {
    const fd = new FormData();
    fd.append("audio", wav, "turn.wav");
    fd.append("noise", noise);
    return fetch(`/api/call/${callId}/turn`, { method: "POST", body: fd }).then((r) => json<TurnResponse>(r));
  },
  endCall: (callId: string) => fetch(`/api/call/${callId}/end`, { method: "POST" }).then((r) => json<{ ok: boolean }>(r)),
  setStatus: (id: string, status: Ticket["status"]) =>
    fetch(`/api/tickets/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }).then((r) => json<Ticket>(r)),
  callback: (id: string) => fetch(`/api/tickets/${id}/callback`, { method: "POST" }).then((r) => json<{ text: string; audio: { url: string } }>(r)),
  reset: () => fetch("/api/reset", { method: "POST" }).then((r) => json<{ ok: boolean }>(r)),
  backlog: () => fetch("/api/backlog").then((r) => json<{ notes: number; results: null | { jobId: string; ranAt: number; elapsedMs: number; files: number } }>(r)),
  replayBacklog: () => fetch("/api/backlog/replay", { method: "POST" }).then((r) => json<{ n: number }>(r)),
  runBacklog: () => fetch("/api/backlog/run", { method: "POST" }).then((r) => json<{ started: boolean }>(r)),
  evalResults: () => fetch("/api/eval").then((r) => json<EvalResults | null>(r)),
};

export interface EvalRow {
  id: string;
  voice: string;
  condition: string;
  keyterms: boolean;
  truth: { locality: string; water?: string; people?: number; vulnerable?: string[] };
  transcript: string;
  got: { locality?: string; water?: string; people?: number; vulnerable?: string[] };
  localityOk: boolean;
  fieldsOk: number;
  fieldsTotal: number;
  sttMs: number | null;
  audio: string;
}
export interface EvalResults {
  ranAt: number;
  model: string;
  conditions: string[];
  lines: number;
  voices: string[];
  summary: { condition: string; keyterms: boolean; n: number; localityAcc: number; fieldAcc: number; medianSttMs: number }[];
  rows: EvalRow[];
}

export type BacklogEvent = { stage: string; [k: string]: unknown };

/** Live ticket board over Server-Sent Events. */
export function useTickets() {
  const [map, setMap] = useState<Map<string, Ticket>>(new Map());
  const [backlog, setBacklog] = useState<BacklogEvent | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    const es = new EventSource("/api/events");
    es.addEventListener("hello", (e) => {
      const { tickets } = JSON.parse((e as MessageEvent).data) as { tickets: Ticket[] };
      tickets.forEach((t) => seen.current.add(t.id));
      setMap(new Map(tickets.map((t) => [t.id, t])));
    });
    es.addEventListener("ticket", (e) => {
      const t = JSON.parse((e as MessageEvent).data) as Ticket;
      setMap((m) => new Map(m).set(t.id, t));
      if (t.locality && !seen.current.has(`${t.id}:loc`)) {
        seen.current.add(`${t.id}:loc`);
        setFresh(t.id);
      }
    });
    es.addEventListener("remove", (e) => {
      const { id } = JSON.parse((e as MessageEvent).data) as { id: string };
      setMap((m) => {
        const n = new Map(m);
        n.delete(id);
        return n;
      });
    });
    es.addEventListener("reset", () => setMap(new Map()));
    es.addEventListener("backlog", (e) => setBacklog(JSON.parse((e as MessageEvent).data)));
    return () => es.close();
  }, []);

  const tickets = useMemo(() => [...map.values()].sort((a, b) => b.score - a.score || a.createdAt - b.createdAt), [map]);
  return { tickets, backlog, fresh };
}

export function useNow(interval = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [interval]);
  return now;
}

export function ago(ts: number, now: number): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
