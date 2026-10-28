export const business = {
  name: "Lumen Hair Studio",
  tagline: "Cuts, colour and styling that fit real life.",
  phone: "(555) 014-8890",
  email: "hello@lumenhairstudio.example",
  address: "12 Maple Street",
  hours: "Tuesday to Saturday, 9am to 6pm. Closed Sunday and Monday.",
};

export type KnowledgeChunk = {
  id: string;
  title: string;
  text: string;
  keywords: string[];
};

// TO SWAP IN A REAL CLIENT: replace only this array (and the business
// object above) with that business's services, prices, hours and policies.
// The chatbot, retrieval and guardrails do not need to change.
export const knowledge: KnowledgeChunk[] = [
  {
    id: "hours",
    title: "Opening hours",
    text: "Lumen Hair Studio is open Tuesday to Saturday, 9am to 6pm. It is closed on Sunday and Monday.",
    keywords: ["open", "hours", "close", "closed", "when", "sunday", "monday", "tuesday"],
  },
  {
    id: "location",
    title: "Location",
    text: "Lumen Hair Studio is at 12 Maple Street. The phone number is (555) 014-8890.",
    keywords: ["where", "location", "address", "maple", "directions", "find"],
  },
  {
    id: "cut",
    title: "Haircut prices",
    text: "A haircut costs $35 and takes about 45 minutes. It includes a wash and style.",
    keywords: ["cut", "haircut", "price", "cost", "how much"],
  },
  {
    id: "colour",
    title: "Colour prices",
    text: "Full colour starts at $70 and balayage starts at $110. Colour appointments take 90 minutes to 2 hours. A patch test is required 48 hours before your first colour appointment.",
    keywords: ["colour", "color", "dye", "balayage", "highlights", "price", "cost"],
  },
  {
    id: "booking",
    title: "Booking",
    text: "You can book using the booking form on this site, or by calling (555) 014-8890. Walk-ins are welcome when a stylist is free, but booking is recommended on Saturdays.",
    keywords: ["book", "booking", "appointment", "reserve", "walk-in", "walkin"],
  },
  {
    id: "cancellation",
    title: "Cancellation policy",
    text: "Please give at least 24 hours notice to cancel or reschedule, so the slot can be offered to someone else.",
    keywords: ["cancel", "cancellation", "reschedule", "change", "notice"],
  },
  {
    id: "services",
    title: "Services",
    text: "Lumen Hair Studio offers haircuts, full colour, balayage, styling for events, and beard trims for $15.",
    keywords: ["services", "offer", "do you", "beard", "trim", "styling", "event"],
  },
];

export const services = [
  { name: "Haircut", price: "$35", time: "45 min", note: "Includes wash and style" },
  { name: "Full colour", price: "from $70", time: "90 min – 2 hrs", note: "Patch test 48 hrs before first colour" },
  { name: "Balayage", price: "from $110", time: "90 min – 2 hrs", note: "Consultation included" },
  { name: "Beard trim", price: "$15", time: "20 min", note: "With hot towel finish" },
];
