// lib/events.ts — the n8n automation events. Pure payload/URL
// helpers are tested directly; emitEvent is tested with a mocked
// fetch, so no test ever touches the network or a real n8n.
// The route handlers themselves are NOT imported here — Jest's
// node sandbox has no Request/Response globals (see the k8s build
// lesson); the routes are thin wrappers, verified live by curl.
import {
  buildEvent,
  emitEvent,
  webhookUrlFor,
  type AutomationEventData,
} from "@/lib/events";

const ORIGINAL_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

const leadData: AutomationEventData = {
  saved: true,
  name: "Ava Rodriguez",
  contact: "ava@example.com",
  service: "Balayage",
  message: "Saturday morning if possible",
};

describe("buildEvent", () => {
  it("builds a lead.created event with the allow-listed fields only", () => {
    const event = buildEvent("lead.created", leadData);
    expect(event.type).toBe("lead.created");
    expect(event.business).toBe("salon");
    expect(event.saved).toBe(true);
    expect(event.name).toBe("Ava Rodriguez");
    expect(event.contact).toBe("ava@example.com");
    expect(event.service).toBe("Balayage");
    expect(event.message).toBe("Saturday morning if possible");
    expect(typeof event.receivedAt).toBe("string");
    expect(Number.isNaN(Date.parse(event.receivedAt))).toBe(false);
    // No other keys ride along — the payload is an explicit allow-list.
    expect(Object.keys(event).sort()).toEqual([
      "business",
      "contact",
      "message",
      "name",
      "receivedAt",
      "saved",
      "service",
      "type",
    ]);
  });

  it("omits optional fields that were not given", () => {
    const event = buildEvent("review.submitted", {
      saved: false,
      name: "Grace Liu",
      rating: 5,
      text: "Best haircut in ages.",
    });
    expect(event).not.toHaveProperty("contact");
    expect(event).not.toHaveProperty("service");
    expect(event).not.toHaveProperty("message");
    expect(event.rating).toBe(5);
    expect(event.text).toBe("Best haircut in ages.");
  });

  it("never carries secrets, tokens or passwords", () => {
    const event = buildEvent("lead.created", leadData);
    expect(JSON.stringify(event)).not.toMatch(
      /token|password|secret|api[_-]?key/i
    );
  });
});

describe("webhookUrlFor", () => {
  afterEach(() => {
    if (ORIGINAL_WEBHOOK_URL === undefined) {
      delete process.env.N8N_WEBHOOK_URL;
    } else {
      process.env.N8N_WEBHOOK_URL = ORIGINAL_WEBHOOK_URL;
    }
  });

  it("returns undefined when N8N_WEBHOOK_URL is unset", () => {
    delete process.env.N8N_WEBHOOK_URL;
    expect(webhookUrlFor("lead.created")).toBeUndefined();
  });

  it("returns undefined when N8N_WEBHOOK_URL is blank", () => {
    process.env.N8N_WEBHOOK_URL = "   ";
    expect(webhookUrlFor("lead.created")).toBeUndefined();
  });

  it("appends the event type to the base URL", () => {
    process.env.N8N_WEBHOOK_URL = "http://localhost:5678/webhook";
    expect(webhookUrlFor("lead.created")).toBe(
      "http://localhost:5678/webhook/lead.created"
    );
    expect(webhookUrlFor("review.submitted")).toBe(
      "http://localhost:5678/webhook/review.submitted"
    );
  });

  it("trims trailing slashes from the base URL", () => {
    process.env.N8N_WEBHOOK_URL = "http://n8n:5678/webhook///";
    expect(webhookUrlFor("appointment.booked")).toBe(
      "http://n8n:5678/webhook/appointment.booked"
    );
  });
});

describe("emitEvent", () => {
  const fetchMock = jest.fn();
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchMock.mockReset();
    (global as unknown as { fetch: unknown }).fetch = fetchMock;
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    if (ORIGINAL_WEBHOOK_URL === undefined) {
      delete process.env.N8N_WEBHOOK_URL;
    } else {
      process.env.N8N_WEBHOOK_URL = ORIGINAL_WEBHOOK_URL;
    }
    // Leave the mocked fetch in place for the next file's isolation;
    // each file gets a fresh module registry, so this cannot leak.
  });

  it("is a silent no-op when unconfigured — fetch is never called", async () => {
    delete process.env.N8N_WEBHOOK_URL;
    fetchMock.mockResolvedValue({ ok: true });
    await expect(emitEvent("lead.created", leadData)).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs the event JSON to <base>/<type> when configured", async () => {
    process.env.N8N_WEBHOOK_URL = "http://localhost:5678/webhook";
    fetchMock.mockResolvedValue({ ok: true });
    await expect(emitEvent("lead.created", leadData)).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(url).toBe("http://localhost:5678/webhook/lead.created");
    expect(options.method).toBe("POST");
    expect(options.headers).toEqual({
      "Content-Type": "application/json",
    });
    const body = JSON.parse(options.body as string) as Record<string, unknown>;
    expect(body.type).toBe("lead.created");
    expect(body.business).toBe("salon");
    expect(body.name).toBe("Ava Rodriguez");
    expect(body.service).toBe("Balayage");
  });

  it("returns false and never throws when the POST fails", async () => {
    process.env.N8N_WEBHOOK_URL = "http://localhost:5678/webhook";
    fetchMock.mockRejectedValue(new Error("n8n is down"));
    await expect(emitEvent("lead.created", leadData)).resolves.toBe(false);
    expect(errorSpy).toHaveBeenCalled();
  });
});
