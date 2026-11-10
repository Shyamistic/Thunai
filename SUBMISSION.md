# Submission kit: Thunai 1913

Everything below is ready to paste. Replace anything in [brackets].

---

## 1. Submission form fields

**Project title**
Thunai 1913: a Tanglish flood-line call-taker for Chennai

**The problem you are solving**
During cyclones, Chennai's 1913 Corporation helpline gets far more calls than staff can answer. During Cyclone Michaung it logged 7,129 complaints in two days amid hotline-overload complaints; a normal day is about 2,000 calls. The calls that matter most are the hardest to handle: a frightened caller in waist-deep water, speaking Tanglish on a noisy phone line, has to name a place like Pallikaranai or Okkiyam Thoraipakkam clearly enough to be found. Overflow calls go unanswered, and the WhatsApp voice notes pile up overnight with nobody to sort them.

**Who will use it**
Call-centre staff and zonal officers of the Greater Chennai Corporation (or any municipal disaster cell), and the residents who call them in Tamil, Tanglish, English, Hindi or Telugu.

**What it does**
When the human lines are full, Thunai answers. Each caller turn is transcribed by Prisma v3.0, with four candidate languages, codemix output and 175 Chennai place-name keyterms. Fixed rules extract the area, landmark, water level, people, vulnerable people, hazards and needs. Thunai asks only for what's missing, reads the location back for confirmation, then gives a ticket number and scripted safety advice in the caller's language with Timbre v3.0. Tickets appear on a live map ranked by explainable rules. Overnight WhatsApp voice notes go through one Prisma v3.0 Batch job with denoising and are ranked the same way.

**Gnani AI models / APIs used**
- Prisma v3.0, REST (`/stt/v3`): `language_code=ta-IN,en-IN,hi-IN,te-IN`, `format=codemix`, `keyterms`, `topic`, `previous_text`
- Prisma v3.0, Batch (`/stt/v3/batch/jobs`): `with_denoise`, `codemix`, `keyterms` + `topic`
- Timbre v3.0, REST (`/api/v1/tts/inference`): voice Kalpana, audio tags `<pauses>` and `<slow>`, 4 languages; µ-law 8 kHz output for the telephone noise test
- Evon v3.3: optional, through an OpenAI-compatible endpoint. Off by default, because Evon isn't on the API platform yet.

**Each member's contribution**
[Name 1]: [e.g. backend: Prisma/Timbre integration, call flow, extraction rules, Batch pipeline, noise eval]
[Name 2]: [e.g. frontend: control room, map board, ticket drawer, noise lab, demo video]

**Live demo / code**
[Render URL, if deployed] · [GitHub URL]. The "How it works" page (`/how`) explains the pipeline and every priority rule for reviewers.

**Measured results (synthetic data)**
- Area named correctly at 5 dB SNR on an 8 kHz µ-law line: 71% without keyterms, 100% with Thunai's keyterms (24 clips per condition)
- Median Prisma v3.0 processing time: about 200 ms per turn
- 20 overnight voice notes triaged by one Batch job in 25 s end to end

**Honest limitations**
- Not connected to emergency services.
- Timbre voices are cleaner than real callers, so the eval numbers are an upper bound.
- REST turns mean the caller can't interrupt Thunai mid-sentence (no barge-in).
- Timbre allows one active request per key, so all speech is serialised and fixed prompts are pre-rendered.
- Hindi and Telugu prompts have not been reviewed by native speakers.
- Synthetic data only.

---

## 2. 60-second demo video: shot list

Record at 1600×900 or 1920×1080. Before recording, open the Noise lab once so its results load, then click **reset demo** on the board.

| Time | On screen | Audio |
|---|---|---|
| 0–4 s | Black card: *"Cyclone Murasu · 1 Nov 2026 · Chennai's 1913 lines jammed."* | Rain |
| 4–8 s | Control room. Click **Triage the backlog**; 20 pins drop and the queue reorders. | Rain; caption: *"20 overnight WhatsApp voice notes → one Prisma v3.0 Batch job, denoised"* |
| 8–30 s | Set **Cyclone · 5 dB** and **8 kHz**. Click **Answer overflow call**. A teammate speaks Tanglish into the mic: *"Hello, Pallikaranai-ல இருந்து பேசுறேன், Velachery main road பக்கத்துல… water waist level, அம்மா bedridden, current இல்ல"* | Thunai's Tamil greeting, then the caller |
| 30–40 s | Transcript appears in Tamil script with English in Latin. Fields tick in, the **P1** card lights up, the map flies to Pallikaranai and a red pin drops (**×2 reports**, because a voice note matched). | Thunai reads back: *"நீங்க சொன்னது பள்ளிக்கரணை… சரியா?"*; caller: *"ஆமா"* |
| 40–48 s | Thunai closes with the ticket number and slow safety advice. Open the ticket drawer: highlighted words, *R4 bedridden with water at waist → P1*. | Thunai, `<slow>` |
| 48–56 s | Noise lab bars animate: **71% → 100%** at 5 dB with keyterms. | Caption: *"Prisma v3.0 · codemix · 175 Chennai keyterms"* |
| 56–60 s | End card: *"Thunai 1913 · Gnani Prisma v3.0 + Timbre v3.0 · synthetic data only"* + hashtags | — |

Tips:
- If the live mic is unreliable, choose **Scripted: Pallikaranai** in the caller dropdown. The UI labels it as a simulated caller, so the demo stays honest.
- For a live caller, use a second phone on speaker next to the laptop mic. Real rain noise helps.

---

## 3. LinkedIn post

> Chennai, Cyclone Murasu, 1 November. The 1913 helpline was jammed again.
>
> The calls that matter most are the hardest to take: someone in waist-deep water, speaking Tanglish on a bad line, with rain hammering the roof, trying to make "Pallikaranai" heard.
>
> So we built **Thunai 1913** (துணை, "a helping hand") for the Great Indian AI Internship Challenge: an AI call-taker that answers when the lines are full.
>
> 🎙 Gnani **Prisma v3.0** transcribes Tanglish, Tamil, English, Hindi and Telugu in codemix mode, with 175 Chennai place names as keyterms
> 🗺 Fixed rules, not a model, turn the call into a ranked ticket on a live map. Bedridden person with water at waist level → P1.
> 🔊 Gnani **Timbre v3.0** reads the location back and gives safety advice in the caller's language
> 📨 Overnight WhatsApp voice notes go through one Prisma Batch job with denoising: 20 notes triaged in 25 s
>
> We tested it on an 8 kHz phone line buried in synthetic cyclone noise (5 dB SNR). Place names came through correctly 71% of the time without keyterms and 100% with them.
>
> Limitations: synthetic data only, not connected to emergency services, and no barge-in yet.
>
> Demo below 👇 Code: [GitHub link]
>
> @Gnani.ai #GnaniAI #GreatIndianAIInternshipChallenge #Chennai #ChennaiRains #VoiceAI #Tamil

## 4. X post (280 chars)

> Chennai's 1913 flood line jams every cyclone. Thunai answers the overflow: Tanglish calls on a noisy 8 kHz line → Gnani Prisma v3.0 → ranked tickets on a live map; Timbre v3.0 replies in Tamil. Place names: 71% → 100% with keyterms at 5 dB. @GnaniAI #GnaniAI #GreatIndianAIInternshipChallenge

---

## 5. Final checklist (deadline 11:59 PM IST, 10 Nov)

- [ ] **Rotate the Gnani API key** after recording (it was shared in chat), then update `thunai/.env`
- [ ] Push the repo to GitHub. `.env` is git-ignored, so check it is **not** committed.
- [ ] Record and trim the 60 s video
- [ ] Post natively on LinkedIn **and** X with both hashtags, and tag Gnani AI
- [ ] Ask friends and classmates for genuine engagement. Don't buy or swap engagement; it's against the rules.
- [ ] Submit the form with one nominated post link per platform, the video, the explanation and the models used
