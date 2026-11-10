// Quick check of the rule extractor and triage on hand-written codemix transcripts.
import { extract } from "../server/extract.ts";
import { triage } from "../server/triage.ts";

const samples = [
  "வணக்கம், நான் Pallikaranai-யில் இருக்கேன். water waist level வந்துடுச்சு, அம்மா bedridden.",
  "ஹலோ, நாங்க வேளச்சேரி-ல Vijaya Nagar பக்கத்துல இருக்கோம், வீட்டுக்குள்ள தண்ணி முட்டி அளவு, current இல்ல, நாலு பேர் இருக்கோம்",
  "Mudichur-ல இருக்கோம் sir, மொட்டை மாடி-ல மாட்டிக்கிட்டோம், கைக்குழந்தை இருக்கு, boat அனுப்புங்க",
  "Hello I am calling from Kodungaiyur near the bus stand, the water is chest level and a current wire has fallen into the water",
  "ஆமா சரிதான்",
  "இல்ல, தாம்பரத்துல இருக்கோம்",
  "Saidapet Jones Road-ல மரம் விழுந்துடுச்சு, road block ஆயிடுச்சு",
  "मैं Perungudi में हूँ, घर में पानी कमर तक है, दो बच्चे हैं, खाना चाहिए",
  "யாரும் இல்ல, நாங்க ரெண்டு பேர் தான்",
  "தண்ணி இரண்டு அடி இருக்கு, சாப்பாடு வேணும்",
];

for (const s of samples) {
  const ex = extract(s);
  const tr = triage({ waterLevel: ex.waterLevel, people: ex.people, vulnerable: ex.vulnerable, hazards: ex.hazards, needs: ex.needs, localityKnown: Boolean(ex.locality) });
  console.log("\n>", s);
  console.log({
    locality: ex.locality?.en,
    landmark: ex.landmark,
    water: ex.waterLevel,
    people: ex.people,
    vulnerable: ex.vulnerable,
    none: ex.vulnerableNone,
    hazards: ex.hazards,
    needs: ex.needs,
    confirm: ex.confirm,
    P: tr.priority,
    rules: tr.rules.map((r) => r.id).join(","),
  });
}
