// Product-engineer eval: run `npm run dev` in one terminal, then
// `npm run eval` in another. Each case checks the bot's answer contains
// an expected fact, or (for out-of-scope questions) refuses to guess.
// Cases with `action` also check the structured action the tools
// return (see lib/tools.ts) — the same contract in free mode and in
// OpenAI mode. All cases run in FREE mode here (no API key): the
// booking case accepts saved:false, as long as the action honestly
// reports a booking was created (in demo mode nothing is persisted).
const BASE = process.env.BASE_URL || "http://localhost:3000";

const cases = [
  { q: "What are your opening hours?", expect: "Monday to Saturday" },
  { q: "How much is a haircut?", expect: "$35" },
  { q: "How do I book an appointment?", expect: "(555) 014-8890" },
  { q: "What is your cancellation policy?", expect: "24 hours" },
  { q: "Do you do beard trims?", expect: "$15" },
  { q: "Do you sell wedding dresses?", expect: "don't have that information" },
  { q: "Are you open on Sundays?", expect: "closed on Sunday" },
  // Tool cases: booking, availability, and a booking that must fail.
  {
    q: "Book a haircut for Emma Thompson, phone (555) 014-2201, on 2026-11-14 at 10:30",
    expect: "Haircut",
    action: "booking_created",
  },
  {
    q: "Is Saturday 14 November free?",
    expect: "10:30",
    action: "availability",
  },
  {
    q: "Book a haircut",
    expect: "need",
    action: "booking_needs_details",
  },
  {
    q: "Book a balayage for Grace Liu, phone (555) 014-2202, on Sunday 1 November at 10:30",
    expect: "closed",
    action: "booking_failed",
  },
  // Product cases: a price answered with the real (sale) price, a
  // recommendation, a successful add to cart, an out-of-stock add
  // refused, and a service question still answered from the
  // business data (not the shop).
  {
    q: "How much is the colour-care shampoo?",
    expect: "$23.80",
    action: "products",
  },
  {
    q: "What product do you recommend for coloured hair?",
    expect: "Colour-care mask",
    action: "product_recommendation",
  },
  {
    q: "Add the colour-care mask to my cart",
    expect: "Added Colour-care mask",
    action: "cart_added",
  },
  {
    q: "Add the hair oil to my cart",
    expect: "out of stock",
    action: "cart_failed",
  },
  { q: "How much is a balayage?", expect: "$110" },
];

let passed = 0;
for (const c of cases) {
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: c.q }),
  });
  const data = await res.json();
  const textOk = (data.answer || "").toLowerCase().includes(c.expect.toLowerCase());
  const actionOk = !c.action || data.action?.type === c.action;
  const ok = textOk && actionOk;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${c.q}  ->  ${data.answer}` +
      (c.action ? `  [action: ${data.action?.type ?? "none"}]` : "")
  );
  if (ok) passed++;
}
console.log(`\n${passed}/${cases.length} passed`);
process.exit(passed === cases.length ? 0 : 1);
