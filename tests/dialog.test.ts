// The call engine without audio: transcripts in, scripted steps and ticket state out.
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.THUNAI_STORE = "memory";
process.env.LLM_BASE_URL = "";
const { startCall, handleCallerTurn } = await import("../server/call.ts");

const meta = {};

test("Tanglish caller who gives everything at once: read back, confirm, close as P1", async () => {
  const { session } = startCall();
  let r = await handleCallerTurn(session, "ஹலோ, Pallikaranai-ல Velachery main road பக்கத்துல, water waist level, அம்மா bedridden, current இல்ல", "ta-IN", meta);
  assert.equal(r.step, "readBack");
  assert.match(r.replyText, /பள்ளிக்கரணை/);
  r = await handleCallerTurn(session, "ஆமா, சரிதான்", "ta-IN", meta);
  assert.equal(r.ticket.localityConfirmed, true);
  assert.equal(r.ticket.priority, 1);
  // vulnerable person known, so it skips the people question and asks about needs
  assert.equal(r.step, "askNeeds");
  r = await handleCallerTurn(session, "boat வேணும், மூணு பேர் இருக்கோம்", "ta-IN", meta);
  assert.equal(r.step, "close");
  assert.equal(r.done, true);
  assert.equal(r.ticket.people, 3);
  assert.equal(r.ticket.status, "open");
});

test("a 'no' at read-back clears the area and asks again; a correction replaces it", async () => {
  const { session } = startCall();
  await handleCallerTurn(session, "Velachery-ல தண்ணி முட்டி அளவு", "ta-IN", meta);
  let r = await handleCallerTurn(session, "இல்ல", "ta-IN", meta);
  assert.equal(r.ticket.locality, null);
  assert.equal(r.step, "askLocalityAgain");
  r = await handleCallerTurn(session, "Madipakkam Ram Nagar", "ta-IN", meta);
  assert.equal(r.ticket.locality?.id, "madipakkam");
  assert.equal(r.step, "readBack");
});

test("English caller gets English replies; a short Tamil 'yes' does not flip the language", async () => {
  const { session } = startCall();
  let r = await handleCallerTurn(session, "I am in Kodungaiyur near the bus stand, the water is knee level", "en-IN", meta);
  assert.match(r.replyText, /You said Kodungaiyur/);
  r = await handleCallerTurn(session, "ஆமா", "ta-IN", meta);
  assert.equal(r.ticket.lang, "en-IN");
});

test("silence gets a scripted 'please repeat', never a guess", async () => {
  const { session } = startCall();
  const r = await handleCallerTurn(session, "", null, meta);
  assert.equal(r.step, "repeat");
});
