// Browser audio: microphone capture with a simple energy VAD, phone-line simulation
// (8 kHz, 300–3400 Hz), storm noise mixed at a chosen SNR, and WAV encoding.

export type NoisePreset = "off" | "rain" | "cyclone";
export const NOISE_SNR: Record<NoisePreset, number | null> = { off: null, rain: 10, cyclone: 5 };

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function stormNoise(rate: number, seconds: number, seed = Date.now()): Float32Array {
  const rnd = mulberry32(seed);
  const n = Math.floor(rate * seconds);
  const out = new Float32Array(n);
  let b0 = 0, b1 = 0, b2 = 0, brown = 0, drop = 0;
  for (let i = 0; i < n; i++) {
    const white = rnd() * 2 - 1;
    b0 = 0.99765 * b0 + white * 0.099046;
    b1 = 0.963 * b1 + white * 0.2965164;
    b2 = 0.57 * b2 + white * 1.0526913;
    const pink = (b0 + b1 + b2 + white * 0.1848) * 0.11;
    brown = (brown + white * 0.02) / 1.02;
    if (rnd() < 0.004) drop = (rnd() * 0.8 + 0.2) * (rnd() < 0.5 ? -1 : 1);
    drop *= 0.86;
    out[i] = pink + brown * 3.2 + drop * 0.5;
  }
  return out;
}

function rms(x: Float32Array) {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i] * x[i];
  return Math.sqrt(s / Math.max(1, x.length));
}

function speechRms(x: Float32Array, rate: number) {
  const frame = Math.floor(rate * 0.02);
  const e: number[] = [];
  for (let i = 0; i + frame <= x.length; i += frame) e.push(rms(x.subarray(i, i + frame)));
  e.sort((a, b) => b - a);
  const top = e.slice(0, Math.max(1, Math.floor(e.length * 0.5)));
  return Math.sqrt(top.reduce((a, v) => a + v * v, 0) / top.length) || rms(x);
}

export function resample(x: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return x;
  // average-then-interpolate keeps aliasing tolerable without a full FIR
  const ratio = from / to;
  const n = Math.floor(x.length / ratio);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const start = i * ratio;
    const a = Math.floor(start);
    const b = Math.min(x.length, Math.floor(start + ratio));
    let s = 0;
    for (let j = a; j < Math.max(a + 1, b); j++) s += x[j] ?? 0;
    out[i] = s / Math.max(1, b - a);
  }
  return out;
}

export function telephoneBand(x: Float32Array, rate: number): Float32Array {
  const out = new Float32Array(x.length);
  const hpA = Math.exp((-2 * Math.PI * 300) / rate);
  const lpA = Math.exp((-2 * Math.PI * 3400) / rate);
  let pi = 0, po = 0, lp = 0;
  for (let i = 0; i < x.length; i++) {
    const hp = hpA * (po + x[i] - pi);
    pi = x[i];
    po = hp;
    lp = (1 - lpA) * hp + lpA * lp;
    out[i] = lp;
  }
  return out;
}

export function mixNoise(x: Float32Array, rate: number, snrDb: number): Float32Array {
  const noise = stormNoise(rate, x.length / rate + 0.1);
  const gain = speechRms(x, rate) / ((rms(noise) || 1) * Math.pow(10, snrDb / 20));
  const out = new Float32Array(x.length);
  let peak = 0;
  for (let i = 0; i < x.length; i++) {
    out[i] = x[i] + noise[i] * gain;
    peak = Math.max(peak, Math.abs(out[i]));
  }
  if (peak > 0.98) for (let i = 0; i < out.length; i++) out[i] *= 0.98 / peak;
  return out;
}

export function encodeWav(x: Float32Array, rate: number): Blob {
  const buf = new ArrayBuffer(44 + x.length * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  v.setUint32(4, 36 + x.length * 2, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, "data");
  v.setUint32(40, x.length * 2, true);
  for (let i = 0; i < x.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, x[i])) * 0x7fff, true);
  return new Blob([buf], { type: "audio/wav" });
}

export interface CaptureResult {
  wav: Blob;
  seconds: number;
  hadSpeech: boolean;
  preview: Float32Array; // downsampled envelope for drawing
}

export interface CaptureOptions {
  phoneLine: boolean;
  noise: NoisePreset;
  onLevel?: (level: number) => void;
  onSpeech?: (speaking: boolean) => void;
  maxSeconds?: number;
  silenceMs?: number;
}

/** One shared microphone + AudioContext for the whole call. */
export class Mic {
  ctx: AudioContext | null = null;
  stream: MediaStream | null = null;
  node: AudioWorkletNode | null = null;
  analyser: AnalyserNode | null = null;
  private sink: ((chunk: Float32Array) => void) | null = null;

  async open() {
    if (this.ctx) return;
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: true, channelCount: 1 } });
    this.ctx = new AudioContext();
    await this.ctx.audioWorklet.addModule("/worklets/capture.js");
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.node = new AudioWorkletNode(this.ctx, "thunai-capture");
    this.node.port.onmessage = (e) => this.sink?.(e.data as Float32Array);
    src.connect(this.analyser);
    src.connect(this.node);
    const mute = this.ctx.createGain();
    mute.gain.value = 0;
    this.node.connect(mute).connect(this.ctx.destination);
  }

  close() {
    this.sink = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close();
    this.ctx = null;
    this.stream = null;
  }

  /** Record one caller turn. Resolves when the caller stops talking, or on stop(). */
  capture(opts: CaptureOptions): { done: Promise<CaptureResult>; stop: () => void; cancel: () => void } {
    if (!this.ctx) throw new Error("mic not open");
    const rate = this.ctx.sampleRate;
    const chunks: Float32Array[] = [];
    let total = 0;
    let noiseFloor = 0.004;
    let speaking = false;
    let speechMs = 0;
    let silentMs = 0;
    let elapsedMs = 0;
    let hadSpeech = false;
    let finished = false;
    let cancelled = false;
    const maxMs = (opts.maxSeconds ?? 25) * 1000;
    const endSilence = opts.silenceMs ?? 1100;

    let resolve!: (r: CaptureResult) => void;
    let reject!: (e: Error) => void;
    const done = new Promise<CaptureResult>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    const finish = () => {
      if (finished) return;
      finished = true;
      this.sink = null;
      if (cancelled) return reject(new Error("cancelled"));
      const all = new Float32Array(total);
      let o = 0;
      for (const c of chunks) {
        all.set(c, o);
        o += c.length;
      }
      const target = opts.phoneLine ? 8000 : 16000;
      let pcm = resample(all, rate, target);
      if (opts.phoneLine) pcm = telephoneBand(pcm, target);
      const snr = NOISE_SNR[opts.noise];
      if (snr !== null && hadSpeech) pcm = mixNoise(pcm, target, snr);
      const step = Math.max(1, Math.floor(pcm.length / 180));
      const preview = new Float32Array(Math.ceil(pcm.length / step));
      for (let i = 0; i < preview.length; i++) {
        let m = 0;
        for (let j = i * step; j < Math.min(pcm.length, (i + 1) * step); j++) m = Math.max(m, Math.abs(pcm[j]));
        preview[i] = m;
      }
      resolve({ wav: encodeWav(pcm, target), seconds: pcm.length / target, hadSpeech, preview });
    };

    let frameBuf: number[] = [];
    const frameLen = Math.floor(rate * 0.02);
    this.sink = (chunk) => {
      if (finished) return;
      chunks.push(chunk);
      total += chunk.length;
      for (let i = 0; i < chunk.length; i++) frameBuf.push(chunk[i]);
      while (frameBuf.length >= frameLen) {
        const f = frameBuf.slice(0, frameLen);
        frameBuf = frameBuf.slice(frameLen);
        let s = 0;
        for (const v of f) s += v * v;
        const level = Math.sqrt(s / frameLen);
        opts.onLevel?.(level);
        elapsedMs += 20;
        const threshold = Math.max(0.012, noiseFloor * 3.2);
        if (level > threshold) {
          speechMs += 20;
          silentMs = 0;
          if (!speaking && speechMs >= 120) {
            speaking = true;
            hadSpeech = true;
            opts.onSpeech?.(true);
          }
        } else {
          if (!speaking) noiseFloor = noiseFloor * 0.95 + level * 0.05;
          silentMs += 20;
          if (!speaking) speechMs = Math.max(0, speechMs - 20);
          if (speaking && silentMs >= endSilence) {
            speaking = false;
            opts.onSpeech?.(false);
            finish();
          }
        }
        if (elapsedMs >= maxMs || (!hadSpeech && elapsedMs >= 9000)) finish();
      }
    };

    return {
      done,
      stop: () => finish(),
      cancel: () => {
        cancelled = true;
        finish();
      },
    };
  }
}

/** Plays Thunai's voice and exposes an analyser for the waveform. */
export class Speaker {
  private ctx: AudioContext | null = null;
  analyser: AnalyserNode | null = null;
  private current: AudioBufferSourceNode | null = null;

  private ensure() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  async play(url: string): Promise<void> {
    const ctx = this.ensure();
    if (ctx.state === "suspended") await ctx.resume();
    const data = await (await fetch(url)).arrayBuffer();
    const buf = await ctx.decodeAudioData(data);
    this.stop();
    return new Promise((resolve) => {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.analyser!);
      src.onended = () => {
        if (this.current === src) this.current = null;
        resolve();
      };
      this.current = src;
      // timeline for the recorded demo video (scripts/make-video.ts rebuilds the soundtrack from it)
      (window as unknown as { __thunaiAudio?: { url: string; t: number }[] }).__thunaiAudio?.push({ url, t: Date.now() });
      src.start();
    });
  }

  stop() {
    try {
      this.current?.stop();
    } catch {
      /* already stopped */
    }
    this.current = null;
  }
}
