// Outbound automation events for n8n (see AUTOMATIONS.md).
//
// The salon app tells n8n when something worth automating happens —
// a new lead, a booking, a review — by POSTing a small JSON event to
// the n8n webhook base URL. n8n workflows listen on one path per
// event type (<base>/lead.created, <base>/review.submitted, ...), so
// a single env var wires up every workflow.
//
// Fire-and-forget by design: emitting an event must NEVER slow down
// or fail a booking, lead or review submit. emitEvent is never
// awaited by the route, it times out after 3 seconds, and every
// failure is swallowed (logged, not thrown). When N8N_WEBHOOK_URL is
// unset — the default — it is a silent no-op and the site behaves
// exactly as if automations did not exist.
//
// Payloads carry only the fields a workflow needs (name, service,
// rating, ...). No secrets, no tokens, no passwords — never put one
// in an event. The `saved` flag tells the workflow whether the
// record was persisted to Supabase (true) or only accepted in demo
// mode (false, when Supabase is unconfigured).
//
// Serverless caveat: on a short-lived serverless function the
// floating POST can be cut off when the function freezes. The demo
// runs as a long-lived server (npm run dev / Docker), where the POST
// completes. In production, use Next.js `after()` (Next 15+) or a
// queue instead of a floating promise.

export type AutomationEventType =
  | "lead.created"
  | "appointment.booked"
  | "review.submitted";

export type AutomationEvent = {
  type: AutomationEventType;
  business: "salon";
  receivedAt: string;
  saved: boolean;
  name: string;
  contact?: string;
  service?: string;
  message?: string;
  rating?: number;
  text?: string;
};

export type AutomationEventData = Omit<
  AutomationEvent,
  "type" | "business" | "receivedAt"
>;

// Pure payload builder — unit-tested in __tests__/events.test.ts.
// Kept free of fetch so tests never touch the network.
export function buildEvent(
  type: AutomationEventType,
  data: AutomationEventData
): AutomationEvent {
  const event: AutomationEvent = {
    type,
    business: "salon",
    receivedAt: new Date().toISOString(),
    saved: data.saved,
    name: data.name,
  };
  if (data.contact !== undefined) event.contact = data.contact;
  if (data.service !== undefined) event.service = data.service;
  if (data.message !== undefined) event.message = data.message;
  if (data.rating !== undefined) event.rating = data.rating;
  if (data.text !== undefined) event.text = data.text;
  return event;
}

// The n8n webhook base URL, e.g. http://localhost:5678/webhook
// (app on the host, n8n in Docker) or http://n8n:5678/webhook (both
// in Docker Compose — localhost inside the app container is the app
// itself, not n8n). Undefined when unconfigured.
export function getWebhookBase(): string | undefined {
  const base = process.env.N8N_WEBHOOK_URL;
  if (!base || !base.trim()) return undefined;
  return base.trim().replace(/\/+$/, "");
}

// Full URL for one event type: <base>/<type>. Undefined when
// unconfigured, so callers can skip the POST entirely.
export function webhookUrlFor(type: AutomationEventType): string | undefined {
  const base = getWebhookBase();
  if (!base) return undefined;
  return `${base}/${type}`;
}

function timeoutSignal(ms: number): AbortSignal | undefined {
  if (
    typeof AbortSignal !== "undefined" &&
    typeof AbortSignal.timeout === "function"
  ) {
    return AbortSignal.timeout(ms);
  }
  return undefined;
}

// Fire-and-forget emit. Returns true when the POST was attempted,
// false when unconfigured or when the POST failed. Never throws.
export async function emitEvent(
  type: AutomationEventType,
  data: AutomationEventData
): Promise<boolean> {
  const url = webhookUrlFor(type);
  if (!url) return false;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildEvent(type, data)),
      signal: timeoutSignal(3000),
    });
    return true;
  } catch (err) {
    // Swallowed on purpose: an automation failure must never surface
    // to the visitor. Log it so the owner can see n8n is unreachable.
    console.error(`Automation event ${type} failed to send:`, err);
    return false;
  }
}
