// Chennai locality gazetteer. Coordinates are approximate (neighbourhood centroid).
// Zones follow the Greater Chennai Corporation 15-zone map; places outside GCC are labelled.
export interface Locality {
  id: string;
  en: string;
  ta: string;
  aliases: string[]; // extra Latin/Tamil spellings people (and STT) use
  lat: number;
  lng: number;
  zone: string;
  floodProne?: boolean;
}

const Z = {
  1: "Zone 1 · Thiruvottiyur",
  2: "Zone 2 · Manali",
  3: "Zone 3 · Madhavaram",
  4: "Zone 4 · Tondiarpet",
  5: "Zone 5 · Royapuram",
  6: "Zone 6 · Thiru-Vi-Ka Nagar",
  7: "Zone 7 · Ambattur",
  8: "Zone 8 · Anna Nagar",
  9: "Zone 9 · Teynampet",
  10: "Zone 10 · Kodambakkam",
  11: "Zone 11 · Valasaravakkam",
  12: "Zone 12 · Alandur",
  13: "Zone 13 · Adyar",
  14: "Zone 14 · Perungudi",
  15: "Zone 15 · Sholinganallur",
  T: "Tambaram Corporation",
  A: "Avadi Corporation",
  O: "Outside GCC limits",
} as const;

type Row = [id: string, en: string, ta: string, lat: number, lng: number, zone: keyof typeof Z, aliases?: string[], floodProne?: boolean];

const ROWS: Row[] = [
  ["ennore", "Ennore", "எண்ணூர்", 13.2146, 80.3203, 1, ["Ennur"], true],
  ["thiruvottiyur", "Thiruvottiyur", "திருவொற்றியூர்", 13.16, 80.3, 1, ["Tiruvottiyur", "Tiruvotriyur", "திருவெற்றியூர்"]],
  ["manali", "Manali", "மணலி", 13.1667, 80.2667, 2, [], true],
  ["madhavaram", "Madhavaram", "மாதவரம்", 13.1488, 80.2306, 3, ["Madavaram"]],
  ["puzhal", "Puzhal", "புழல்", 13.1586, 80.205, 3, ["Puzhal lake"]],
  ["kodungaiyur", "Kodungaiyur", "கொடுங்கையூர்", 13.1376, 80.2478, 4, ["Kodungayur"], true],
  ["tondiarpet", "Tondiarpet", "தண்டையார்பேட்டை", 13.1268, 80.2885, 4, ["Tondiarpettai", "Thandaiyarpet"]],
  ["vyasarpadi", "Vyasarpadi", "வியாசர்பாடி", 13.1193, 80.255, 4, ["Vyasarpadi subway", "வியாசர்பாடி சுரங்கப்பாதை"], true],
  ["korukkupet", "Korukkupet", "கொருக்குப்பேட்டை", 13.117, 80.278, 4, []],
  ["kasimedu", "Kasimedu", "காசிமேடு", 13.127, 80.296, 5, ["Kasimedu harbour"]],
  ["washermanpet", "Washermanpet", "வண்ணாரப்பேட்டை", 13.111, 80.287, 5, ["Vannarapettai", "Old Washermanpet"]],
  ["royapuram", "Royapuram", "ராயபுரம்", 13.1137, 80.2954, 5, []],
  ["georgetown", "George Town", "ஜார்ஜ் டவுன்", 13.092, 80.286, 5, ["Parrys", "Sowcarpet", "சௌகார்பேட்டை"]],
  ["egmore", "Egmore", "எழும்பூர்", 13.0732, 80.2609, 5, ["Ezhumbur"]],
  ["perambur", "Perambur", "பெரம்பூர்", 13.121, 80.233, 6, [], true],
  ["pulianthope", "Pulianthope", "புளியந்தோப்பு", 13.099, 80.26, 6, ["Puliyanthope"], true],
  ["otteri", "Otteri", "ஓட்டேரி", 13.095, 80.247, 6, []],
  ["kolathur", "Kolathur", "கொளத்தூர்", 13.124, 80.212, 6, ["Kolatur"], true],
  ["sembium", "Sembium", "செம்பியம்", 13.118, 80.244, 6, []],
  ["purasawalkam", "Purasawalkam", "புரசைவாக்கம்", 13.088, 80.255, 6, ["Purasaiwakkam", "Purasaivakkam"]],
  ["ayanavaram", "Ayanavaram", "அயனாவரம்", 13.099, 80.231, 6, []],
  ["ambattur", "Ambattur", "அம்பத்தூர்", 13.1143, 80.1548, 7, [], true],
  ["padi", "Padi", "பாடி", 13.098, 80.189, 7, []],
  ["korattur", "Korattur", "கொரட்டூர்", 13.111, 80.183, 7, [], true],
  ["mogappair", "Mogappair", "முகப்பேர்", 13.085, 80.176, 7, ["Mugappair"]],
  ["annanagar", "Anna Nagar", "அண்ணா நகர்", 13.085, 80.2101, 8, ["Annanagar"]],
  ["villivakkam", "Villivakkam", "வில்லிவாக்கம்", 13.103, 80.21, 8, []],
  ["kilpauk", "Kilpauk", "கீழ்ப்பாக்கம்", 13.082, 80.242, 8, ["Keelpakkam"]],
  ["shenoynagar", "Shenoy Nagar", "ஷெனாய் நகர்", 13.078, 80.226, 8, []],
  ["aminjikarai", "Aminjikarai", "அமிஞ்சிக்கரை", 13.073, 80.224, 8, []],
  ["arumbakkam", "Arumbakkam", "அரும்பாக்கம்", 13.072, 80.21, 8, [], true],
  ["thirumangalam", "Thirumangalam", "திருமங்கலம்", 13.085, 80.195, 8, []],
  ["choolaimedu", "Choolaimedu", "சூளைமேடு", 13.063, 80.227, 8, ["Chulaimedu"]],
  ["koyambedu", "Koyambedu", "கோயம்பேடு", 13.0694, 80.1948, 10, ["Koyambedu market"]],
  ["teynampet", "Teynampet", "தேனாம்பேட்டை", 13.0418, 80.2494, 9, []],
  ["nungambakkam", "Nungambakkam", "நுங்கம்பாக்கம்", 13.0569, 80.2425, 9, []],
  ["mylapore", "Mylapore", "மயிலாப்பூர்", 13.0368, 80.2676, 9, ["Mylai", "மயிலை"]],
  ["triplicane", "Triplicane", "திருவல்லிக்கேணி", 13.0587, 80.2756, 9, ["Thiruvallikeni"]],
  ["royapettah", "Royapettah", "ராயப்பேட்டை", 13.054, 80.263, 9, []],
  ["alwarpet", "Alwarpet", "ஆழ்வார்பேட்டை", 13.0339, 80.255, 9, []],
  ["mandaveli", "Mandaveli", "மந்தைவெளி", 13.027, 80.262, 9, ["Mandavelli"]],
  ["santhome", "Santhome", "சாந்தோம்", 13.033, 80.278, 9, ["San Thome"]],
  ["pattinapakkam", "Pattinapakkam", "பட்டினப்பாக்கம்", 13.027, 80.278, 9, ["Pattinambakkam"]],
  ["chintadripet", "Chintadripet", "சிந்தாதிரிப்பேட்டை", 13.074, 80.271, 9, []],
  ["tnagar", "T. Nagar", "தி.நகர்", 13.0418, 80.2341, 10, ["T Nagar", "Thyagaraya Nagar", "தியாகராய நகர்", "டி.நகர்", "டி நகர்", "தி நகர்"]],
  ["kodambakkam", "Kodambakkam", "கோடம்பாக்கம்", 13.0521, 80.2255, 10, []],
  ["vadapalani", "Vadapalani", "வடபழனி", 13.05, 80.2121, 10, ["Vadapalani temple"]],
  ["saligramam", "Saligramam", "சாலிகிராமம்", 13.048, 80.201, 10, []],
  ["kknagar", "K.K. Nagar", "கே.கே.நகர்", 13.041, 80.199, 10, ["KK Nagar", "K K Nagar", "கே.கே. நகர்", "கேகே நகர்"], true],
  ["ashoknagar", "Ashok Nagar", "அசோக் நகர்", 13.037, 80.212, 10, ["Ashok Pillar", "அசோக் பில்லர்"]],
  ["westmambalam", "West Mambalam", "மேற்கு மாம்பலம்", 13.038, 80.222, 10, ["Mambalam", "மாம்பலம்"], true],
  ["saidapet", "Saidapet", "சைதாப்பேட்டை", 13.0213, 80.2231, 10, ["Saidapettai"], true],
  ["jafferkhanpet", "Jafferkhanpet", "ஜாபர்கான்பேட்டை", 13.03, 80.208, 10, ["Jafarkhanpet"], true],
  ["mgrnagar", "M.G.R. Nagar", "எம்.ஜி.ஆர். நகர்", 13.035, 80.195, 10, ["MGR Nagar", "எம்ஜிஆர் நகர்"], true],
  ["virugambakkam", "Virugambakkam", "விருகம்பாக்கம்", 13.053, 80.189, 11, []],
  ["valasaravakkam", "Valasaravakkam", "வளசரவாக்கம்", 13.04, 80.172, 11, []],
  ["porur", "Porur", "போரூர்", 13.0382, 80.1565, 11, ["Porur lake"]],
  ["ramapuram", "Ramapuram", "ராமாபுரம்", 13.032, 80.178, 11, []],
  ["maduravoyal", "Maduravoyal", "மதுரவாயல்", 13.065, 80.164, 11, []],
  ["alapakkam", "Alapakkam", "ஆலப்பாக்கம்", 13.049, 80.166, 11, []],
  ["mugalivakkam", "Mugalivakkam", "முகலிவாக்கம்", 13.021, 80.161, 12, [], true],
  ["manapakkam", "Manapakkam", "மணப்பாக்கம்", 13.017, 80.175, 12, [], true],
  ["nandambakkam", "Nandambakkam", "நந்தம்பாக்கம்", 13.013, 80.19, 12, []],
  ["alandur", "Alandur", "ஆலந்தூர்", 12.9975, 80.2006, 12, []],
  ["guindy", "Guindy", "கிண்டி", 13.0067, 80.2206, 12, []],
  ["ekkattuthangal", "Ekkattuthangal", "ஈக்காட்டுத்தாங்கல்", 13.021, 80.204, 12, ["Ekkaduthangal", "Ekkatuthangal"], true],
  ["meenambakkam", "Meenambakkam", "மீனம்பாக்கம்", 12.987, 80.176, 12, ["Airport"]],
  ["nanganallur", "Nanganallur", "நங்கநல்லூர்", 12.979, 80.19, 12, []],
  ["adambakkam", "Adambakkam", "ஆதம்பாக்கம்", 12.989, 80.204, 12, []],
  ["velachery", "Velachery", "வேளச்சேரி", 12.9815, 80.218, 13, ["Velacheri", "Velachery main road", "வேளச்சேரி மெயின் ரோடு"], true],
  ["adyar", "Adyar", "அடையாறு", 13.0012, 80.2565, 13, ["Adayar", "அடையார்"], true],
  ["kotturpuram", "Kotturpuram", "கோட்டூர்புரம்", 13.017, 80.242, 13, [], true],
  ["besantnagar", "Besant Nagar", "பெசன்ட் நகர்", 13.0002, 80.2668, 13, ["Elliots beach"]],
  ["thiruvanmiyur", "Thiruvanmiyur", "திருவான்மியூர்", 12.983, 80.2594, 13, ["Tiruvanmiyur"]],
  ["taramani", "Taramani", "தரமணி", 12.986, 80.24, 13, ["Tharamani"], true],
  ["indiranagar", "Indira Nagar", "இந்திரா நகர்", 12.994, 80.251, 13, []],
  ["pallikaranai", "Pallikaranai", "பள்ளிக்கரணை", 12.9349, 80.2137, 14, ["Pallikarnai", "Pallikaranai marsh", "பள்ளிக்கரனை"], true],
  ["perungudi", "Perungudi", "பெருங்குடி", 12.9654, 80.2461, 14, [], true],
  ["kandanchavadi", "Kandanchavadi", "கந்தன்சாவடி", 12.971, 80.246, 14, []],
  ["madipakkam", "Madipakkam", "மடிப்பாக்கம்", 12.9623, 80.1986, 14, ["Madipaakkam"], true],
  ["ram-nagar", "Ram Nagar (Madipakkam)", "ராம் நகர்", 12.955, 80.205, 14, ["Ram Nagar", "Ramnagar"], true],
  ["thoraipakkam", "Thoraipakkam", "துரைப்பாக்கம்", 12.94, 80.234, 15, ["Thuraipakkam"], true],
  ["okkiyam", "Okkiyam Thoraipakkam", "ஒக்கியம் துரைப்பாக்கம்", 12.933, 80.231, 15, ["Okkiyam"], true],
  ["kannaginagar", "Kannagi Nagar", "கண்ணகி நகர்", 12.933, 80.235, 15, [], true],
  ["karapakkam", "Karapakkam", "காரப்பாக்கம்", 12.92, 80.229, 15, [], true],
  ["sholinganallur", "Sholinganallur", "சோழிங்கநல்லூர்", 12.901, 80.2279, 15, ["Sholinganallur junction"], true],
  ["semmencherry", "Semmencherry", "செம்மஞ்சேரி", 12.874, 80.221, 15, ["Semmanchery"], true],
  ["neelankarai", "Neelankarai", "நீலாங்கரை", 12.949, 80.259, 15, []],
  ["injambakkam", "Injambakkam", "ஈஞ்சம்பாக்கம்", 12.92, 80.251, 15, []],
  ["perumbakkam", "Perumbakkam", "பெரும்பாக்கம்", 12.898, 80.202, "O", [], true],
  ["medavakkam", "Medavakkam", "மேடவாக்கம்", 12.917, 80.192, "O", [], true],
  ["keelkattalai", "Keelkattalai", "கீழ்க்கட்டளை", 12.957, 80.187, "T", ["Kilkattalai", "கீழ்கட்டளை"], true],
  ["pallavaram", "Pallavaram", "பல்லாவரம்", 12.9675, 80.1491, "T", []],
  ["chromepet", "Chromepet", "குரோம்பேட்டை", 12.9516, 80.1462, "T", ["Chrompet"]],
  ["chitlapakkam", "Chitlapakkam", "சிட்லபாக்கம்", 12.933, 80.143, "T", [], true],
  ["selaiyur", "Selaiyur", "சேலையூர்", 12.91, 80.14, "T", [], true],
  ["tambaram", "Tambaram", "தாம்பரம்", 12.9249, 80.1, "T", ["East Tambaram", "West Tambaram", "தாம்பர"], true],
  ["perungalathur", "Perungalathur", "பெருங்களத்தூர்", 12.905, 80.089, "T", [], true],
  ["mudichur", "Mudichur", "முடிச்சூர்", 12.915, 80.074, "T", ["Mudichoor"], true],
  ["varadarajapuram", "Varadarajapuram", "வரதராஜபுரம்", 12.92, 80.055, "O", ["Varadharajapuram"], true],
  ["avadi", "Avadi", "ஆவடி", 13.1067, 80.097, "A", []],
  ["poonamallee", "Poonamallee", "பூந்தமல்லி", 13.047, 80.094, "O", ["Poonamalli"]],
  ["mangadu", "Mangadu", "மாங்காடு", 13.033, 80.11, "O", []],
  ["kundrathur", "Kundrathur", "குன்றத்தூர்", 12.997, 80.097, "O", ["Kunrathur"]],
];

export const LOCALITIES: Locality[] = ROWS.map(([id, en, ta, lat, lng, zone, aliases = [], floodProne = false]) => ({
  id,
  en,
  ta,
  lat,
  lng,
  zone: Z[zone],
  aliases,
  floodProne,
}));

export const CHENNAI_CENTER: [number, number] = [13.0475, 80.2089];

export const ZONES = Object.values(Z);

const byId = new Map(LOCALITIES.map((l) => [l.id, l]));
export function getLocality(id: string | null | undefined): Locality | undefined {
  return id ? byId.get(id) : undefined;
}

/** Keyterms sent to Prisma v3.0 (max 200). Latin locality names are listed first: in testing,
 *  a Latin keyterm makes codemix output write the place in Latin, which is easier to match and display. */
export function buildKeyterms(): string[] {
  const flood = [
    "1913", "Thunai", "Corporation", "boat", "relief camp", "motor pump", "EB line", "current wire", "transformer",
    "bedridden", "dialysis", "oxygen", "insulin", "wheelchair", "pregnant", "ambulance",
    "waist level", "knee level", "chest level", "ankle level", "ground floor", "first floor", "terrace",
    "subway", "main road", "cross street", "apartment", "block", "storm water drain", "drainage",
  ];
  const latin = LOCALITIES.filter((l) => l.floodProne).map((l) => l.en)
    .concat(LOCALITIES.filter((l) => !l.floodProne).map((l) => l.en));
  const tamil = LOCALITIES.filter((l) => l.floodProne).map((l) => l.ta);
  const out: string[] = [];
  for (const t of [...flood, ...latin, ...tamil]) {
    if (out.length >= 200) break;
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

export const STT_TOPIC =
  "Emergency flood distress call to the Greater Chennai Corporation 1913 helpline during a cyclone. Callers speak Tamil mixed with English (Tanglish), sometimes Hindi or Telugu, over noisy phone lines with heavy rain. They give a Chennai locality, a nearby landmark or street, how high the water is, how many people are with them, whether elderly, bedridden, infant, pregnant or dialysis patients are present, and what they need: rescue boat, food, drinking water, medicine, or help with fallen trees and live electric wires.";
