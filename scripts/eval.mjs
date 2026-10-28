// Product-engineer eval: run `npm run dev` in one terminal, then
// `npm run eval` in another. Each case checks the bot's answer contains
// an expected fact, or (for out-of-scope questions) refuses to guess.
const BASE = process.env.BASE_URL || "http://localhost:3000";

const cases = [
  { q: "What are your opening hours?", expect: "Tuesday to Saturday" },
  { q: "How much is a haircut?", expect: "$35" },
  { q: "How do I book an appointment?", expect: "(555) 014-8890" },
  { q: "What is your cancellation policy?", expect: "24 hours" },
  { q: "Do you do beard trims?", expect: "$15" },
  { q: "Do you sell wedding dresses?", expect: "don't have that information" },
  { q: "Are you open on Sundays?", expect: "closed on Sunday" },
];

let passed = 0;
for (const c of cases) {
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: c.q }),
  });
  const data = await res.json();
  const ok = (data.answer || "").toLowerCase().includes(c.expect.toLowerCase());
  console.log(`${ok ? "PASS" : "FAIL"}  ${c.q}  ->  ${data.answer}`);
  if (ok) passed++;
}
console.log(`\n${passed}/${cases.length} passed`);
process.exit(passed === cases.length ? 0 : 1);
