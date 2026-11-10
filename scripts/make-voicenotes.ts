// Builds the synthetic "overnight WhatsApp voice notes" backlog: Timbre v3.0 voices speak
// Tanglish/English/Hindi distress messages, then each is phone-banded and buried in storm noise.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { decodeWav, encodeWav, mixAtSnr, padSilence, resample, telephoneBand } from "../server/audio.ts";
import { BACKLOG_DIR, type ManifestItem } from "../server/backlog.ts";
import { synthesize } from "../server/gnani.ts";

const NOTES: { text: string; lang: string; voice: string; minutesAgo: number; snr: number }[] = [
  { text: "அண்ணா, சைதாப்பேட்டை Jones Road பக்கத்துல தண்ணி முட்டி அளவு வந்துடுச்சு. சாப்பாடு இல்ல, குழந்தைங்க இருக்காங்க.", lang: "ta-IN", voice: "Lakshmi", minutesAgo: 412, snr: 12 },
  { text: "ஹலோ, ஜாபர்கான்பேட்டை-ல எங்க வீட்டுக்குள்ள தண்ணி வந்துடுச்சு. வயசானவங்க ரெண்டு பேர் இருக்காங்க.", lang: "ta-IN", voice: "Prakash", minutesAgo: 388, snr: 9 },
  { text: "பெரம்பூர்-ல தண்ணி கணுக்கால் அளவு தான், ஆனா நேத்து ராத்திரியிலிருந்து current இல்ல. குடிநீர் வேணும்.", lang: "ta-IN", voice: "Chetana", minutesAgo: 351, snr: 13 },
  { text: "கோட்டூர்புரம்-ல அடையாறு river பக்கத்துல தண்ணி ஏறிக்கிட்டே இருக்கு. இடுப்பு அளவு வந்துடுச்சு, பாட்டி bedridden.", lang: "ta-IN", voice: "Yashraj", minutesAgo: 330, snr: 8 },
  { text: "This is from Tambaram, near the railway station. Water is knee deep, we need food and milk for the baby.", lang: "en-IN", voice: "Riyaa", minutesAgo: 302, snr: 11 },
  { text: "புளியந்தோப்பு-ல ground floor full-ஆ போயிடுச்சு. மொட்டை மாடி-ல இருக்கோம், அஞ்சு பேர்.", lang: "ta-IN", voice: "Devansh", minutesAgo: 287, snr: 7 },
  { text: "மைலாப்பூர் Luz பக்கத்துல தண்ணி கணுக்கால் அளவு, EB wire spark ஆகுது, யாரும் பக்கத்துல போக முடியல.", lang: "ta-IN", voice: "Tarika", minutesAgo: 260, snr: 10 },
  { text: "मैं Sholinganallur में हूँ, construction site के पास। हम बीस मजदूर फंसे हैं, पानी कमर तक है।", lang: "hi-IN", voice: "Shubham", minutesAgo: 244, snr: 9 },
  { text: "கண்ணகி நகர்-ல எங்க block முழுக்க தண்ணி, நெஞ்சு அளவு. பத்து பேருக்கு மேல இருக்கோம்.", lang: "ta-IN", voice: "Lakshmi", minutesAgo: 221, snr: 6 },
  { text: "கொளத்தூர்-ல தண்ணி முட்டி அளவு. மருந்து கடை எல்லாம் மூடிருக்கு, அப்பா sugar patient, insulin வேணும்.", lang: "ta-IN", voice: "Prakash", minutesAgo: 199, snr: 11 },
  { text: "Calling from Anna Nagar, our street is waterlogged, ankle level, and there is no power since morning.", lang: "en-IN", voice: "Yashraj", minutesAgo: 176, snr: 14 },
  { text: "மாதவரம்-ல மரம் விழுந்து current wire அறுந்து ரோடுல கிடக்குது.", lang: "ta-IN", voice: "Devansh", minutesAgo: 158, snr: 9 },
  { text: "ஒக்கியம் துரைப்பாக்கம்-ல வீட்டுக்குள்ள நெஞ்சு அளவு தண்ணி. மாட்டிக்கிட்டோம், boat அனுப்புங்க ப்ளீஸ்.", lang: "ta-IN", voice: "Chetana", minutesAgo: 140, snr: 6 },
  { text: "வேளச்சேரி Taramani link road பக்கத்துல car எல்லாம் மூழ்கிடுச்சு. தண்ணி இடுப்பு அளவு, வீட்டுல pregnant lady இருக்காங்க.", lang: "ta-IN", voice: "Tarika", minutesAgo: 121, snr: 8 },
  { text: "கொரட்டூர் lake பக்கத்துல தண்ணி வீட்டுக்குள்ள வந்துடுச்சு. அப்பாவுக்கு oxygen cylinder வேணும்.", lang: "ta-IN", voice: "Yashraj", minutesAgo: 98, snr: 10 },
  { text: "அடையாறு Gandhi Nagar-ல தண்ணி முட்டி அளவு. எங்க தாத்தா heart patient.", lang: "ta-IN", voice: "Lakshmi", minutesAgo: 77, snr: 12 },
  { text: "Hello, we are in Madipakkam near Ram Nagar. Water is waist level and we are five people.", lang: "en-IN", voice: "Riyaa", minutesAgo: 60, snr: 9 },
  { text: "Pallikaranai-ல Velachery main road பக்கத்துல இன்னும் தண்ணி ஏறுது, இடுப்பு அளவு. வயசானவங்க இருக்காங்க.", lang: "ta-IN", voice: "Devansh", minutesAgo: 41, snr: 7 },
  { text: "வியாசர்பாடி subway பக்கத்துல தண்ணி நெஞ்சு அளவு, ரெண்டு பேர் மாட்டிக்கிட்டோம்.", lang: "ta-IN", voice: "Shubham", minutesAgo: 26, snr: 8 },
  { text: "నేను Manali నుండి మాట్లాడుతున్నాను. నీళ్ళు నడుము వరకు ఉన్నాయి, ముగ్గురు ఉన్నాం.", lang: "te-IN", voice: "Prakash", minutesAgo: 15, snr: 11 },
];

const audioDir = path.join(BACKLOG_DIR, "audio");
mkdirSync(audioDir, { recursive: true });
const manifest: ManifestItem[] = [];

for (let i = 0; i < NOTES.length; i++) {
  const n = NOTES[i];
  const file = `voicenote-${String(i + 1).padStart(2, "0")}.wav`;
  const r = await synthesize(n.text, { voice: n.voice, language: n.lang, sampleRate: 16000 });
  let pcm = padSilence(decodeWav(readFileSync(r.file)), 0.4, 0.6);
  pcm = resample(pcm, 8000);
  pcm = telephoneBand(pcm);
  pcm = mixAtSnr(pcm, n.snr, 100 + i);
  writeFileSync(path.join(audioDir, file), encodeWav(resample(pcm, 16000)));
  manifest.push({ file, text: n.text, lang: n.lang, minutesAgo: n.minutesAgo, noiseDb: n.snr, voice: n.voice });
  console.log(`${file}  ${n.voice.padEnd(8)} ${n.snr} dB  ${r.cached ? "cached" : `${r.ms} ms`}`);
}
writeFileSync(path.join(BACKLOG_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`\n${manifest.length} voice notes written to ${audioDir}`);
