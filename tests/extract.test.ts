import { test } from "node:test";
import assert from "node:assert/strict";
import { extract } from "../server/extract.ts";

const loc = (s: string) => extract(s).locality?.id;

test("locality: Latin, Tamil script and Tamil case endings", () => {
  assert.equal(loc("நான் Pallikaranai-ல இருக்கேன்"), "pallikaranai");
  assert.equal(loc("நான் பள்ளிக்கரணையிலிருந்து பேசுறேன்"), "pallikaranai");
  assert.equal(loc("தாம்பரத்துல இருக்கோம்"), "tambaram"); // ம் → த்துல
  assert.equal(loc("கொளத்தூரில் தண்ணி"), "kolathur"); // ர் → ரில்
  assert.equal(loc("புளியந்தோப்பில் ground floor full"), "pulianthope"); // பு → ப்பில்
  assert.equal(loc("கே.கே. நகரில் மரம் விழுந்துடுச்சு"), "kknagar");
  assert.equal(loc("Okkiyam Thoraipakkam-ல நெஞ்சு அளவு"), "okkiyam"); // longest name wins
});

test("locality: Hindi/Telugu spellings, glued endings, and no false matches", () => {
  assert.equal(loc("मैं शोलिंगनल्लूर में हूँ"), "sholinganallur");
  assert.equal(loc("నేను మనాలి నుండి"), "manali");
  assert.equal(loc("மே Perungudiyur-இல்"), "perungudi");
  assert.equal(loc("அடையாறு காந்தி நகரில்"), "adyar"); // "தி நகர்" must not match inside "காந்தி நகர்"
  assert.equal(extract("அடையாறு காந்தி நகரில் தண்ணி").otherLocalities.length, 0);
});

test("landmark: near-markers and streets, without the caller's own area", () => {
  assert.equal(extract("Pallikaranai-ல Velachery main road பக்கத்துல").landmark, "Velachery main road");
  assert.equal(extract("Saidapet Jones Road-ல மரம் விழுந்துடுச்சு").landmark, "Jones Road");
  assert.equal(extract("calling from Kodungaiyur near the bus stand, water knee level").landmark, "the bus stand");
  assert.equal(extract("मैं Perungudi से, construction site के पास").landmark, "construction site");
});

test("water level: Tamil stems, English, feet, Hindi, and chest pain is not chest water", () => {
  assert.equal(extract("தண்ணி நெஞ்ச அளவு இருக்குது").waterLevel, "chest");
  assert.equal(extract("இடுப்பளவு தண்ணி").waterLevel, "waist");
  assert.equal(extract("water waste level வந்துடுச்சு").waterLevel, "waist"); // common mishearing
  assert.equal(extract("தண்ணி இரண்டு அடி இருக்கு").waterLevel, "knee");
  assert.equal(extract("पानी कमर तक है").waterLevel, "waist");
  const pain = extract("அம்மாவுக்கு நெஞ்சு வலி");
  assert.equal(pain.waterLevel, undefined);
  assert.ok(pain.hazards.includes("medical"));
});

test("people, vulnerable people and 'nobody'", () => {
  assert.equal(extract("நாங்க நாலு பேர் இருக்கோம்").people, 4);
  assert.equal(extract("There are five of us").people, 5);
  assert.equal(extract("हम दस लोग हैं").people, 10);
  assert.equal(extract("ముగ్గురు ఉన్నాం").people, 3);
  assert.deepEqual(extract("கைக்குழந்தை இருக்கு").vulnerable, ["infant"]);
  assert.ok(extract("அம்மா bedridden").vulnerable.includes("bedridden"));
  assert.ok(extract("my grandmother is with us").vulnerable.includes("elderly"));
  assert.equal(extract("யாரும் இல்ல, நாங்க ரெண்டு பேர் தான்").vulnerableNone, true);
});

test("hazards and needs", () => {
  const e = extract("current wire தண்ணியில விழுந்துடுச்சு, boat அனுப்புங்க, current இல்ல");
  assert.ok(e.hazards.includes("liveWire"));
  assert.ok(e.hazards.includes("powerCut"));
  assert.ok(e.needs.includes("rescue"));
  assert.ok(extract("EV wires park ஆகுது").hazards.includes("liveWire")); // EB heard as EV
  assert.ok(extract("மொட்டை மாடி-ல மாட்டிக்கிட்டோம்").hazards.includes("trapped"));
});

test("read-back confirmation in four languages; a power cut is not a 'no'", () => {
  for (const s of ["ஆமாம், சரி தான்.", "Yes, that is correct.", "हाँ, सही है।", "ஆ, சஹி.", "అవును"]) assert.equal(extract(s).confirm, "yes", s);
  assert.equal(extract("இல்ல, தாம்பரம்").confirm, "no");
  assert.equal(extract("current இல்ல").confirm, undefined);
});
