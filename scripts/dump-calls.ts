// Print the turn timeline of every call ticket on the board (debug helper).
const tickets = (await (await fetch("http://localhost:8787/api/tickets")).json()) as {
  id: string;
  source: string;
  status: string;
  transcript: { at: number; role: string; text: string }[];
}[];
const ist = (ms: number) => new Date(ms).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: false });
for (const t of tickets.filter((x) => x.source === "call")) {
  console.log(`== ${t.id} (${t.status})`);
  for (const x of t.transcript) console.log(`${ist(x.at)} ${x.role.padEnd(7)} ${x.text.slice(0, 60)}`);
}
