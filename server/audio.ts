// Small PCM toolkit for the eval and voice-note scripts: WAV I/O, G.711 µ-law decode,
// procedural rain/traffic noise, and mixing at a target SNR. No native dependencies.

export interface Pcm {
  rate: number;
  samples: Float32Array;
}

export function decodeWav(buf: Buffer): Pcm {
  if (buf.toString("ascii", 0, 4) !== "RIFF") throw new Error("not a WAV file");
  let off = 12;
  let rate = 16000;
  let channels = 1;
  let bits = 16;
  let format = 1;
  while (off + 8 <= buf.length) {
    const id = buf.toString("ascii", off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === "fmt ") {
      format = buf.readUInt16LE(off + 8);
      channels = buf.readUInt16LE(off + 10);
      rate = buf.readUInt32LE(off + 12);
      bits = buf.readUInt16LE(off + 22);
    } else if (id === "data") {
      const end = Math.min(buf.length, off + 8 + size);
      const data = buf.subarray(off + 8, end);
      if (format === 7) return { rate, samples: decodeMulaw(data) };
      if (bits !== 16) throw new Error(`unsupported WAV bit depth ${bits}`);
      const frames = Math.floor(data.length / 2 / channels);
      const out = new Float32Array(frames);
      for (let i = 0; i < frames; i++) out[i] = data.readInt16LE(i * 2 * channels) / 32768;
      return { rate, samples: out };
    }
    off += 8 + size + (size % 2);
  }
  throw new Error("WAV has no data chunk");
}

export function encodeWav(p: Pcm): Buffer {
  const n = p.samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(p.rate, 24);
  buf.writeUInt32LE(p.rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(p.samples[i] * 32767))), 44 + i * 2);
  return buf;
}

/** G.711 µ-law → float. Timbre returns raw µ-law at 8 kHz for container=mulaw. */
export function decodeMulaw(data: Buffer): Float32Array {
  const out = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) {
    const u = ~data[i] & 0xff;
    const sign = u & 0x80;
    const exponent = (u >> 4) & 0x07;
    const mantissa = u & 0x0f;
    let sample = ((mantissa << 3) + 0x84) << exponent;
    sample -= 0x84;
    out[i] = (sign ? -sample : sample) / 32768;
  }
  return out;
}

export function resample(p: Pcm, rate: number): Pcm {
  if (p.rate === rate) return p;
  const ratio = p.rate / rate;
  const n = Math.floor(p.samples.length / ratio);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i * ratio;
    const i0 = Math.floor(x);
    const f = x - i0;
    out[i] = (p.samples[i0] ?? 0) * (1 - f) + (p.samples[i0 + 1] ?? 0) * f;
  }
  return { rate, samples: out };
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Heavy rain on a roof plus distant traffic rumble and the odd horn. Deterministic per seed. */
export function stormNoise(rate: number, seconds: number, seed = 7): Float32Array {
  const rnd = mulberry32(seed);
  const n = Math.floor(rate * seconds);
  const out = new Float32Array(n);
  let b0 = 0, b1 = 0, b2 = 0, brown = 0;
  let drop = 0;
  const hornStart = Math.floor(n * (0.25 + rnd() * 0.5));
  const hornLen = Math.floor(rate * 0.5);
  for (let i = 0; i < n; i++) {
    const white = rnd() * 2 - 1;
    // pink-ish rain hiss
    b0 = 0.99765 * b0 + white * 0.099046;
    b1 = 0.963 * b1 + white * 0.2965164;
    b2 = 0.57 * b2 + white * 1.0526913;
    const pink = (b0 + b1 + b2 + white * 0.1848) * 0.11;
    // low traffic rumble
    brown = (brown + white * 0.02) / 1.02;
    // droplets: short decaying clicks
    if (rnd() < 0.004) drop = (rnd() * 0.8 + 0.2) * (rnd() < 0.5 ? -1 : 1);
    drop *= 0.86;
    let s = pink + brown * 3.2 + drop * 0.5;
    if (i >= hornStart && i < hornStart + hornLen) s += 0.18 * Math.sin((2 * Math.PI * 420 * i) / rate) * Math.sin((Math.PI * (i - hornStart)) / hornLen);
    out[i] = s;
  }
  return out;
}

const rms = (x: Float32Array) => {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i] * x[i];
  return Math.sqrt(s / Math.max(1, x.length));
};

/** Speech RMS over voiced frames only, so leading/trailing silence doesn't skew the SNR. */
function speechRms(x: Float32Array, rate: number): number {
  const frame = Math.floor(rate * 0.02);
  const energies: number[] = [];
  for (let i = 0; i + frame <= x.length; i += frame) energies.push(rms(x.subarray(i, i + frame)));
  if (!energies.length) return rms(x);
  const sorted = [...energies].sort((a, b) => b - a);
  const top = sorted.slice(0, Math.max(1, Math.floor(sorted.length * 0.6)));
  return Math.sqrt(top.reduce((a, e) => a + e * e, 0) / top.length);
}

export function mixAtSnr(speech: Pcm, snrDb: number, seed = 7): Pcm {
  const noise = stormNoise(speech.rate, speech.samples.length / speech.rate + 0.1, seed);
  const sR = speechRms(speech.samples, speech.rate);
  const nR = rms(noise) || 1;
  const gain = sR / (nR * Math.pow(10, snrDb / 20));
  const out = new Float32Array(speech.samples.length);
  let peak = 0;
  for (let i = 0; i < out.length; i++) {
    out[i] = speech.samples[i] + noise[i] * gain;
    peak = Math.max(peak, Math.abs(out[i]));
  }
  if (peak > 0.98) for (let i = 0; i < out.length; i++) out[i] *= 0.98 / peak;
  return { rate: speech.rate, samples: out };
}

/** Band-limit to the 300–3400 Hz telephone channel (crude one-pole filters). */
export function telephoneBand(p: Pcm): Pcm {
  const out = new Float32Array(p.samples.length);
  const hpA = Math.exp((-2 * Math.PI * 300) / p.rate);
  const lpA = Math.exp((-2 * Math.PI * 3400) / p.rate);
  let hpPrevIn = 0, hpPrevOut = 0, lp = 0;
  for (let i = 0; i < out.length; i++) {
    const x = p.samples[i];
    const hp = hpA * (hpPrevOut + x - hpPrevIn);
    hpPrevIn = x;
    hpPrevOut = hp;
    lp = (1 - lpA) * hp + lpA * lp;
    out[i] = lp;
  }
  return { rate: p.rate, samples: out };
}

export function padSilence(p: Pcm, before = 0.25, after = 0.35): Pcm {
  const a = Math.floor(p.rate * before);
  const b = Math.floor(p.rate * after);
  const out = new Float32Array(a + p.samples.length + b);
  out.set(p.samples, a);
  return { rate: p.rate, samples: out };
}
