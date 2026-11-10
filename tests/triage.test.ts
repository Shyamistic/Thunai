import { test } from "node:test";
import assert from "node:assert/strict";
import { triage, type TriageInput } from "../server/triage.ts";

const base: TriageInput = { vulnerable: [], hazards: [], needs: [], localityKnown: true };
const ids = (i: Partial<TriageInput>) => triage({ ...base, ...i }).rules.map((r) => r.id);
const p = (i: Partial<TriageInput>) => triage({ ...base, ...i }).priority;

test("P1 rules", () => {
  assert.equal(p({ hazards: ["trapped"] }), 1);
  assert.equal(p({ hazards: ["medical"] }), 1);
  assert.equal(p({ waterLevel: "chest" }), 1);
  assert.equal(p({ waterLevel: "waist", vulnerable: ["bedridden"] }), 1);
  assert.ok(ids({ waterLevel: "waist", vulnerable: ["bedridden"] }).includes("R4"));
  assert.equal(p({ waterLevel: "ankle", hazards: ["liveWire"] }), 1);
});

test("P2 rules", () => {
  assert.equal(p({ waterLevel: "waist" }), 2);
  assert.equal(p({ waterLevel: "knee", vulnerable: ["elderly"] }), 2);
  assert.equal(p({ hazards: ["insideHome"], vulnerable: ["elderly"] }), 2);
  assert.equal(p({ vulnerable: ["dialysis"], waterLevel: "ankle" }), 2);
  assert.equal(p({ hazards: ["treeFall"] }), 2);
  assert.equal(p({ people: 12 }), 2);
});

test("P3 and pending", () => {
  assert.equal(p({ waterLevel: "ankle", hazards: ["powerCut"] }), 3);
  assert.equal(p({ needs: ["food"] }), 3);
  assert.deepEqual(ids({}), ["R0"]);
});

test("score orders within a priority: worse water and more vulnerable people rank higher", () => {
  const a = triage({ ...base, waterLevel: "chest", vulnerable: ["infant"] }).score;
  const b = triage({ ...base, waterLevel: "chest" }).score;
  const c = triage({ ...base, waterLevel: "waist" }).score;
  assert.ok(a > b && b > c);
});
