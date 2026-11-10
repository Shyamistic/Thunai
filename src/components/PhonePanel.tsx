import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Phone, PhoneOff, Mic, CloudRain, CloudLightning, Sun, Radio, Bot, Square, Loader2 } from "lucide-react";
import { api } from "../lib/api.ts";
import { encodeWav, Mic as MicCapture, mixNoise, resample, Speaker, telephoneBand, NOISE_SNR, type NoisePreset } from "../lib/audio.ts";
import { LANG_LABEL, type Ticket } from "../lib/types.ts";
import { Waveform } from "./Waveform.tsx";
import { LiveTicket } from "./LiveTicket.tsx";

type CallState = "idle" | "connecting" | "speaking" | "listening" | "thinking" | "ended";

interface Caption {
  id: number;
  role: "caller" | "thunai";
  text: string;
  lang?: string | null;
  meta?: string;
}

interface Scenario {
  id: string;
  title: string;
  voice: string;
  lang: string;
  lines: number;
}

const NOISES: { id: NoisePreset; label: string; icon: typeof Sun }[] = [
  { id: "off", label: "Clear", icon: Sun },
  { id: "rain", label: "Rain · 10 dB", icon: CloudRain },
  { id: "cyclone", label: "Cyclone · 5 dB", icon: CloudLightning },
];

export function PhonePanel({ ticket, onTicket }: { ticket: Ticket | null; onTicket: (t: Ticket | null) => void }) {
  const [state, setState] = useState<CallState>("idle");
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [noise, setNoise] = useState<NoisePreset>("rain");
  const [phoneLine, setPhoneLine] = useState(true);
  const [scripted, setScripted] = useState<string | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [lastTiming, setLastTiming] = useState<string | null>(null);

  const mic = useRef(new MicCapture());
  const speaker = useRef(new Speaker());
  const callId = useRef<string | null>(null);
  const capture = useRef<ReturnType<MicCapture["capture"]> | null>(null);
  const lineIdx = useRef(0);
  const startedAt = useRef(0);
  const capId = useRef(0);
  const alive = useRef(false);
  const settings = useRef({ noise, phoneLine, scripted });
  settings.current = { noise, phoneLine, scripted };
  const captionBox = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = captionBox.current;
    if (el) setTimeout(() => el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }), 60);
  }, [captions, state]);

  useEffect(() => {
    fetch("/api/demo/scenarios").then((r) => r.json()).then(setScenarios).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (state === "idle" || state === "ended") return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 500);
    return () => clearInterval(id);
  }, [state]);

  const push = (c: Omit<Caption, "id">) => setCaptions((cs) => [...cs, { ...c, id: ++capId.current }]);

  const speak = async (url: string) => {
    setState("speaking");
    await speaker.current.play(url);
  };

  /** Caller audio for one turn: the live mic, or a scripted Timbre caller played aloud. */
  const callerTurn = async (): Promise<{ wav: Blob; hadSpeech: boolean }> => {
    const s = settings.current;
    if (s.scripted) {
      const n = lineIdx.current++;
      const url = `/api/demo/line/${s.scripted}/${n}`;
      setState("listening");
      setSpeaking(true);
      const ctx = new AudioContext();
      const buf = await ctx.decodeAudioData(await (await fetch(url)).arrayBuffer());
      await speaker.current.play(url);
      setSpeaking(false);
      const target = s.phoneLine ? 8000 : 16000;
      let pcm = resample(buf.getChannelData(0), buf.sampleRate, target);
      if (s.phoneLine) pcm = telephoneBand(pcm, target);
      const snr = NOISE_SNR[s.noise];
      if (snr !== null) pcm = mixNoise(pcm, target, snr);
      ctx.close();
      return { wav: encodeWav(pcm, target), hadSpeech: true };
    }
    setState("listening");
    const cap = mic.current.capture({ phoneLine: s.phoneLine, noise: s.noise, onSpeech: setSpeaking });
    capture.current = cap;
    const r = await cap.done;
    capture.current = null;
    setSpeaking(false);
    return r;
  };

  const loop = useCallback(async () => {
    let quiet = 0;
    while (alive.current && callId.current) {
      let turn: { wav: Blob; hadSpeech: boolean };
      try {
        turn = await callerTurn();
      } catch {
        return; // cancelled
      }
      if (!alive.current) return;
      if (!turn.hadSpeech) {
        quiet += 1;
        if (quiet >= 2) {
          setError("No speech heard. Tap the mic and speak, or end the call.");
          setState("listening");
          return;
        }
        continue;
      }
      quiet = 0;
      setState("thinking");
      try {
        const r = await api.turn(callId.current!, turn.wav, settings.current.noise === "off" ? "off" : `${NOISE_SNR[settings.current.noise]} dB`);
        push({ role: "caller", text: r.caller.transcript || "…", lang: r.caller.lang, meta: `Prisma v3.0 · ${r.caller.sttMs ?? "?"} ms` });
        setLastTiming(`STT ${r.caller.sttMs ?? "?"} ms server · ${r.caller.roundTripMs} ms round trip · TTS ${r.reply.audio.cached ? "cached" : `${r.reply.audio.ttsMs} ms`}`);
        onTicket(r.ticket);
        push({ role: "thunai", text: r.reply.text, lang: r.reply.lang });
        await speak(r.reply.audio.url);
        if (r.done) {
          setState("ended");
          alive.current = false;
          await api.endCall(callId.current!);
          callId.current = null;
          mic.current.close();
          return;
        }
      } catch (e) {
        setError((e as Error).message);
        setState("listening");
        return;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = async () => {
    setError(null);
    setCaptions([]);
    setLastTiming(null);
    onTicket(null);
    lineIdx.current = 0;
    setState("connecting");
    try {
      if (!settings.current.scripted) await mic.current.open();
      const r = await api.startCall();
      callId.current = r.callId;
      alive.current = true;
      startedAt.current = Date.now();
      setElapsed(0);
      onTicket(r.ticket);
      push({ role: "thunai", text: r.reply.text, lang: r.reply.lang });
      await speak(r.reply.audio.url);
      loop();
    } catch (e) {
      setError(e instanceof DOMException ? "Microphone permission is needed for a live call. Or pick a scripted caller." : (e as Error).message);
      setState("idle");
    }
  };

  const hangup = async () => {
    alive.current = false;
    capture.current?.cancel();
    speaker.current.stop();
    if (callId.current) await api.endCall(callId.current).catch(() => undefined);
    callId.current = null;
    mic.current.close();
    setState("ended");
  };

  const resume = () => {
    setError(null);
    if (callId.current && !capture.current) {
      alive.current = true;
      loop();
    }
  };

  const inCall = state !== "idle" && state !== "ended";
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  const accent = state === "speaking" && !speaking ? "#f4b23f" : "#ede6d6";
  const analyser = state === "speaking" || (scripted && speaking) ? speaker.current.analyser : mic.current.analyser;

  return (
    <div className="panel flex h-full min-h-0 flex-col overflow-hidden">
      {/* phone screen */}
      <div className="relative m-3 mb-0 overflow-hidden rounded-[26px] border border-line bg-gradient-to-b from-ink-800 to-ink-900">
        <div className="kolam-dots absolute inset-0 opacity-60" />
        <div className="relative px-4 pb-3 pt-3">
          <div className="flex items-center justify-between font-mono text-[10.5px] text-fog">
            <span className="flex items-center gap-1.5">
              <Radio size={12} className={inCall ? "text-p1" : ""} /> {phoneLine ? "PSTN · 8 kHz" : "VoIP · 16 kHz"}
            </span>
            <span>{inCall || state === "ended" ? `${mm}:${ss}` : "READY"}</span>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <div className="relative grid h-12 w-12 place-items-center rounded-full border border-line bg-ink-700">
              {inCall && <span className="absolute inset-0 rounded-full border-2 border-marigold/60" style={{ animation: "var(--animate-ping-slow)" }} />}
              <Phone size={18} className="text-marigold" />
            </div>
            <div className="min-w-0">
              <div className="font-display text-[22px] font-extrabold leading-none tracking-wide">1913 · FLOOD LINE</div>
              <div className="mt-1 truncate text-[12px] text-mist">
                {state === "idle" && "Overflow calls routed to Thunai"}
                {state === "connecting" && "Connecting…"}
                {state === "speaking" && (scripted && speaking ? "Caller speaking (scripted)" : "Thunai speaking · Timbre v3.0")}
                {state === "listening" && (speaking ? "Caller speaking…" : "Listening for caller…")}
                {state === "thinking" && "Prisma v3.0 transcribing…"}
                {state === "ended" && "Call ended · ticket filed"}
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-2xl border border-line/70 bg-ink-950/50 px-3 py-2">
            <Waveform analyser={analyser} active={state === "speaking" || state === "listening"} color={state === "listening" || (scripted && speaking) ? "#ede6d6" : accent} height={46} />
          </div>

          {/* captions */}
          <div ref={captionBox} className="scroll-thin mt-3 flex h-[164px] flex-col gap-2 overflow-y-auto pr-1">
            <AnimatePresence initial={false}>
              {captions.slice(-6).map((c) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  className={`max-w-[92%] rounded-2xl px-3 py-2 text-[13px] leading-snug ${c.role === "caller" ? "self-end rounded-br-md bg-chalk text-ink-950" : "self-start rounded-bl-md border border-marigold/30 bg-marigold/10 text-jasmine"}`}
                >
                  <div className={`mb-0.5 font-mono text-[9.5px] uppercase tracking-wider ${c.role === "caller" ? "text-ink-600" : "text-marigold"}`}>
                    {c.role === "caller" ? "Caller" : "Thunai"} · {LANG_LABEL[c.lang ?? ""] ?? c.lang}
                    {c.meta && <span className="normal-case"> · {c.meta}</span>}
                  </div>
                  <span className="ta">{c.text}</span>
                </motion.div>
              ))}
            </AnimatePresence>
            {state === "thinking" && (
              <div className="flex items-center gap-2 self-end text-[12px] text-fog">
                <Loader2 size={13} className="animate-spin" /> transcribing
              </div>
            )}
            {state === "idle" && !captions.length && (
              <div className="m-auto max-w-[240px] text-center text-[12px] leading-relaxed text-fog">
                Start a call and speak in Tamil, Tanglish, English, Hindi or Telugu. Prisma v3.0 detects the language; Thunai replies in it.
              </div>
            )}
          </div>

          {/* controls */}
          <div className="mt-3 flex items-center justify-center gap-3">
            {!inCall ? (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={start}
                className="flex items-center gap-2 rounded-full bg-p3 px-5 py-2.5 font-medium text-ink-950 shadow-[0_0_30px_-6px_var(--color-p3)]"
              >
                <Phone size={16} /> {state === "ended" ? "Take next call" : "Answer overflow call"}
              </motion.button>
            ) : (
              <>
                {state === "listening" && !scripted && (
                  <button onClick={() => (capture.current ? capture.current.stop() : resume())} className="flex items-center gap-1.5 rounded-full border border-line bg-ink-700 px-4 py-2 text-[12px]" title="Finish speaking">
                    {capture.current ? <Square size={13} /> : <Mic size={13} />} {capture.current ? "Done" : "Speak"}
                  </button>
                )}
                <motion.button whileTap={{ scale: 0.92 }} onClick={hangup} className="grid h-11 w-11 place-items-center rounded-full bg-p1 text-ink-950 shadow-[0_0_24px_-4px_var(--color-p1)]" title="End call">
                  <PhoneOff size={18} />
                </motion.button>
              </>
            )}
          </div>
          {error && <div className="mt-2 text-center text-[11.5px] text-p2">{error}</div>}
        </div>
      </div>

      {/* line conditions */}
      <div className="mx-3 mt-3 grid grid-cols-3 gap-1 rounded-xl border border-line bg-ink-900 p-1">
        {NOISES.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setNoise(id)} className={`flex items-center justify-center gap-1 rounded-lg px-1 py-1.5 text-[11px] transition ${noise === id ? "bg-ink-700 text-chalk" : "text-fog hover:text-mist"}`}>
            <Icon size={12} className={noise === id && id !== "off" ? "text-monsoon" : ""} /> {label}
          </button>
        ))}
      </div>
      <div className="mx-3 mt-1.5 flex items-center gap-2 text-[11px] text-fog">
        <label className="flex cursor-pointer items-center gap-1.5">
          <input type="checkbox" checked={phoneLine} onChange={(e) => setPhoneLine(e.target.checked)} className="accent-marigold" /> 8 kHz phone line
        </label>
        <select
          value={scripted ?? ""}
          onChange={(e) => setScripted(e.target.value || null)}
          disabled={inCall}
          className="ml-auto max-w-[190px] truncate rounded-md border border-line bg-ink-900 px-1.5 py-1 text-[11px] text-mist"
          title="Use a Timbre voice as the caller"
        >
          <option value="">Caller: live microphone</option>
          {scenarios.map((s) => (
            <option key={s.id} value={s.id}>
              Scripted: {s.title}
            </option>
          ))}
        </select>
      </div>
      {scripted && (
        <div className="mx-3 mt-1 flex items-center gap-1.5 text-[10.5px] text-fog">
          <Bot size={11} /> Simulated caller voice (Timbre v3.0), mixed with noise before Prisma hears it.
        </div>
      )}
      {lastTiming && <div className="mx-3 mt-1 font-mono text-[10px] text-fog">{lastTiming}</div>}

      <div className="scroll-thin mt-3 min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <LiveTicket ticket={ticket} />
      </div>
    </div>
  );
}
