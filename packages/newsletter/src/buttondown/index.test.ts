/**
 * Tests for the Buttondown provider, driven through MSW so the assertions are
 * about the requests it sends and how it reads each documented answer: the
 * headers every call carries, each body, each status and error code, and webhooks.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EmailAddress } from "@sdxc/email-address";
import type { Result } from "@sdxc/result";

import { Hex, hmac } from "@sdxc/crypto";
import { parseEmailAddress } from "@sdxc/email-address";
import { IP } from "@sdxc/ip";
import { isFailure, unwrap } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import type { NewsletterError } from "../errors.js";

import { API_VERSION, ButtondownNewsletter } from "./index.js";

/** Buttondown's collection endpoint. */
const SUBSCRIBERS_URL = "https://api.buttondown.com/v1/subscribers";

/** Buttondown's endpoint for one subscriber, by id or by address. */
const SUBSCRIBER_URL = "https://api.buttondown.com/v1/subscribers/:idOrEmail";

/** API key the tests expect on the wire. */
const API_KEY = "key-1";

/** Signing key configured on the webhook in these tests. */
const WEBHOOK_SECRET = "bd-webhook-secret";

/** Where a delivery is posted. */
const WEBHOOK_URL = "https://books.sergiodxa.com/webhooks/buttondown";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** A subscriber as Buttondown answers it, with the fields a test cares about overridable. */
function record(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		id: "sub_01jabc",
		email_address: "reader@example.com",
		type: "regular",
		creation_date: "2026-01-02T03:04:05Z",
		tags: [],
		metadata: {},
		source: "api",
		utm_source: "",
		utm_medium: "",
		utm_campaign: "",
		referral_code: "abc",
		secondary_id: 1,
		...overrides,
	};
}

/** Parses an address the tests know is valid. */
function email(address: string): EmailAddress {
	return unwrap(parseEmailAddress(address));
}

/** The failure a call answered, for asserting on its code. */
function failed<T>(result: Result<T, NewsletterError>): NewsletterError {
	if (!isFailure(result)) throw new Error("expected a failure");
	return result.error;
}

/** Builds the provider under test. */
function create(
	options: Partial<ConstructorParameters<typeof ButtondownNewsletter>[0]> = {},
): ButtondownNewsletter {
	return new ButtondownNewsletter({ apiKey: API_KEY, webhookSecret: WEBHOOK_SECRET, ...options });
}

/** Signs a delivery body as Buttondown does: hex HMAC-SHA256 of the body, `sha256=` prefixed. */
async function signed(body: string, secret = WEBHOOK_SECRET): Promise<Request> {
	let mac = unwrap(await hmac.sign(secret, body));
	return new Request(WEBHOOK_URL, {
		method: "POST",
		headers: { "X-Buttondown-Signature": `sha256=${Hex.encode(mac)}` },
		body,
	});
}

describe("ButtondownNewsletter requests", () => {
	test("every call carries the token and the pinned API version", async () => {
		let seen: Array<Record<string, string | null>> = [];

		server.use(
			http.get(SUBSCRIBER_URL, ({ request }) => {
				seen.push({
					authorization: request.headers.get("authorization"),
					version: request.headers.get("x-api-version"),
				});
				return HttpResponse.json(record());
			}),
		);

		await unwrap(create().subscribers.find({ email: email("reader@example.com") }));

		expect(API_VERSION).toBe("2026-04-01");
		expect(seen).toEqual([{ authorization: "Token key-1", version: "2026-04-01" }]);
	});

	test("an empty API key answers unauthenticated without reaching the network", async () => {
		let newsletter = create({ apiKey: "" });

		let found = await newsletter.subscribers.find({ email: email("reader@example.com") });
		let subscribed = await newsletter.subscribers.subscribe({ email: email("reader@example.com") });

		expect(failed(found).code).toBe("unauthenticated");
		expect(failed(subscribed).code).toBe("unauthenticated");
	});

	test("native is the client itself", () => {
		let newsletter = create();
		expect(newsletter.native).toBe(newsletter);
	});
});

describe("subscribe", () => {
	test("sends the address, double opt-in type, tags, metadata and every attribution field", async () => {
		let received: unknown;
		let collision: string | null = "unset";

		server.use(
			http.post(SUBSCRIBERS_URL, async ({ request }) => {
				received = await request.json();
				collision = request.headers.get("x-buttondown-collision-behavior");
				return HttpResponse.json(record({ type: "unactivated" }), { status: 201 });
			}),
		);

		let outcome = await unwrap(
			create().subscribers.subscribe({
				email: email("reader@example.com"),
				tags: ["book", "book"],
				metadata: { first_source: "x" },
				attribution: {
					source: "newsletter",
					medium: "email",
					campaign: "launch",
					term: "remix",
					content: "hero",
					referrer: "https://news.ycombinator.com/",
					landingPage: "https://books.sergiodxa.com/",
				},
				ip: unwrap(IP.parse("203.0.113.7")),
			}),
		);

		expect(received).toEqual({
			email_address: "reader@example.com",
			type: "unactivated",
			tags: ["book"],
			metadata: { utm_term: "remix", utm_content: "hero", first_source: "x" },
			utm_source: "newsletter",
			utm_medium: "email",
			utm_campaign: "launch",
			referrer_url: "https://news.ycombinator.com/",
			ip_address: "203.0.113.7",
		});
		expect(collision).toBeNull();
		expect(outcome.created).toBe(true);
		expect(outcome.subscriber).toMatchObject({
			id: "sub_01jabc",
			email: "reader@example.com",
			status: "pending",
			providerStatus: "unactivated",
		});
	});

	test("single opt-in sends type regular, and the landing page stands in for a missing referrer", async () => {
		let received: unknown;

		server.use(
			http.post(SUBSCRIBERS_URL, async ({ request }) => {
				received = await request.json();
				return HttpResponse.json(record(), { status: 201 });
			}),
		);

		let outcome = await unwrap(
			create({ confirmation: "single" }).subscribers.subscribe({
				email: email("reader@example.com"),
				attribution: { landingPage: "https://books.sergiodxa.com/sample" },
				ip: null,
			}),
		);

		expect(received).toEqual({
			email_address: "reader@example.com",
			type: "regular",
			referrer_url: "https://books.sergiodxa.com/sample",
		});
		expect(outcome.subscriber.status).toBe("active");
	});

	test("an address already on the list is read back and answered created false", async () => {
		let lookedUp: string[] = [];

		server.use(
			http.post(SUBSCRIBERS_URL, () =>
				HttpResponse.json(
					{ code: "email_already_exists", detail: "That email address is already subscribed." },
					{ status: 400 },
				),
			),
			http.get(SUBSCRIBER_URL, ({ params }) => {
				lookedUp.push(String(params["idOrEmail"]));
				return HttpResponse.json(record({ type: "unsubscribed" }));
			}),
		);

		let outcome = await unwrap(
			create().subscribers.subscribe({ email: email("reader@example.com") }),
		);

		expect(lookedUp).toEqual(["reader@example.com"]);
		expect(outcome.created).toBe(false);
		expect(outcome.subscriber.status).toBe("unsubscribed");
	});

	test.each([
		["email_invalid", "invalid_address"],
		["email_empty", "invalid_address"],
		["subscriber_blocked", "suppressed"],
		["subscriber_suppressed", "suppressed"],
		["email_blocked", "suppressed"],
		["ip_address_spammy", "invalid_request"],
	] as const)("a 400 %s is %s", async (providerCode, code) => {
		server.use(
			http.post(SUBSCRIBERS_URL, () =>
				HttpResponse.json({ code: providerCode, detail: "Refused" }, { status: 400 }),
			),
		);

		let error = failed(await create().subscribers.subscribe({ email: email("x@example.com") }));

		expect(error.code).toBe(code);
		expect(error.providerCode).toBe(providerCode);
		expect(error.message).toBe("Refused");
		expect(error.retryable).toBe(false);
	});

	test("a 422 locating the address field is invalid_address", async () => {
		server.use(
			http.post(SUBSCRIBERS_URL, () =>
				HttpResponse.json(
					{
						detail: [{ type: "value_error", loc: ["body", "email_address"], msg: "not an email" }],
					},
					{ status: 422 },
				),
			),
		);

		let error = failed(await create().subscribers.subscribe({ email: email("x@example.com") }));

		expect(error.code).toBe("invalid_address");
		expect(error.message).toBe("not an email");
	});
});

describe("status and transport failures", () => {
	test.each([
		[401, "unauthenticated"],
		[403, "forbidden"],
		[404, "not_found"],
		[409, "invalid_request"],
		[500, "unknown"],
		[503, "unknown"],
	] as const)("a %i is %s", async (status, code) => {
		server.use(http.get(SUBSCRIBER_URL, () => HttpResponse.json({ detail: "Nope" }, { status })));

		let error = failed(await create().subscribers.find({ id: "sub_1" }));

		expect(error.code).toBe(code);
		expect(error.connection).toBe("buttondown");
	});

	test("a 403 with no body is forbidden", async () => {
		server.use(http.get(SUBSCRIBER_URL, () => new HttpResponse(null, { status: 403 })));

		let error = failed(await create().subscribers.find({ email: email("reader@example.com") }));

		expect(error.code).toBe("forbidden");
		expect(error.message).toBe("Buttondown answered 403");
	});

	test("a 429 is retryable after the seconds Retry-After names", async () => {
		server.use(
			http.get(SUBSCRIBER_URL, () =>
				HttpResponse.json(
					{ detail: "Slow down" },
					{ status: 429, headers: { "Retry-After": "30" } },
				),
			),
		);

		let error = failed(await create().subscribers.find({ id: "sub_1" }));

		expect(error.code).toBe("rate_limited");
		expect(error.retryable).toBe(true);
		expect(error.retryAfter).toBe(30);
	});

	test("a network failure is unknown", async () => {
		server.use(http.get(SUBSCRIBER_URL, () => HttpResponse.error()));

		expect(failed(await create().subscribers.find({ id: "sub_1" })).code).toBe("unknown");
	});

	test("a 2xx failing its schema is invalid_response", async () => {
		server.use(http.get(SUBSCRIBER_URL, () => HttpResponse.json({ id: "sub_1" })));

		expect(failed(await create().subscribers.find({ id: "sub_1" })).code).toBe("invalid_response");
	});

	test("a subscriber type outside the mapping is invalid_response on find", async () => {
		server.use(http.get(SUBSCRIBER_URL, () => HttpResponse.json(record({ type: "hibernating" }))));

		let error = failed(await create().subscribers.find({ id: "sub_1" }));

		expect(error.code).toBe("invalid_response");
		expect(error.message).toContain("hibernating");
	});
});

describe("find and tags", () => {
	test.each([
		["unactivated", "pending"],
		["regular", "active"],
		["premium", "active"],
		["gifted", "active"],
		["trialed", "active"],
		["churning", "active"],
		["past_due", "active"],
		["unsubscribed", "unsubscribed"],
		["blocked", "suppressed"],
		["complained", "suppressed"],
		["undeliverable", "suppressed"],
	] as const)("type %s reads as %s", async (type, status) => {
		server.use(http.get(SUBSCRIBER_URL, () => HttpResponse.json(record({ type }))));

		let subscriber = await unwrap(create().subscribers.find({ id: "sub_01jabc" }));

		expect(subscriber.status).toBe(status);
		expect(subscriber.providerStatus).toBe(type);
	});

	test("find maps the record, flattening nested metadata to JSON text", async () => {
		server.use(
			http.get(SUBSCRIBER_URL, () =>
				HttpResponse.json(record({ metadata: { purchase: "complete", cart: { items: 2 } } })),
			),
		);

		let subscriber = await unwrap(create().subscribers.find({ id: "sub_01jabc" }));

		expect(subscriber).toEqual({
			id: "sub_01jabc",
			email: "reader@example.com",
			status: "active",
			providerStatus: "regular",
			metadata: { purchase: "complete", cart: '{"items":2}' },
			createdAt: new Date("2026-01-02T03:04:05Z"),
		});
	});

	test("tags reads the subscriber's tag names", async () => {
		server.use(
			http.get(SUBSCRIBER_URL, () => HttpResponse.json(record({ tags: ["buyer", "early"] }))),
		);

		expect(await unwrap(create().subscribers.tags({ id: "sub_01jabc" }))).toEqual([
			"buyer",
			"early",
		]);
	});
});

describe("list", () => {
	test("sends the page, size, ordering and filters, and turns next into a cursor", async () => {
		let urls: URL[] = [];

		server.use(
			http.get(SUBSCRIBERS_URL, ({ request }) => {
				urls.push(new URL(request.url));
				return HttpResponse.json({
					results: [record()],
					next: "https://api.buttondown.com/v1/subscribers?page=3",
					previous: null,
					count: 3,
				});
			}),
		);

		let page = await unwrap(
			create().subscribers.list({ status: "suppressed", tag: "buyer", limit: 1, cursor: "2" }),
		);

		let params = urls[0]?.searchParams;
		expect(params?.get("page")).toBe("2");
		expect(params?.get("page_size")).toBe("1");
		expect(params?.get("ordering")).toBe("creation_date");
		expect(params?.getAll("type")).toEqual(["blocked", "complained", "undeliverable", "removed"]);
		expect(params?.getAll("tag")).toEqual(["buyer"]);
		expect(page.cursor).toBe("3");
		expect(page.items.map((item) => item.id)).toEqual(["sub_01jabc"]);
	});

	test("the last page ends the walk and an unmapped row is skipped", async () => {
		server.use(
			http.get(SUBSCRIBERS_URL, () =>
				HttpResponse.json({
					results: [record({ id: "sub_a", type: "hibernating" }), record({ id: "sub_b" })],
					next: null,
					previous: null,
					count: 2,
				}),
			),
		);

		let page = await unwrap(create().subscribers.list());

		expect(page).toMatchObject({ cursor: null, items: [{ id: "sub_b" }] });
	});

	test("a cursor this provider never issued is invalid_request", async () => {
		expect(failed(await create().subscribers.list({ cursor: "abc" })).code).toBe("invalid_request");
	});
});

describe("update", () => {
	test("reads the subscriber and writes merged tags and metadata in one PATCH", async () => {
		let patches: unknown[] = [];
		let paths: string[] = [];

		server.use(
			http.get(SUBSCRIBER_URL, ({ params }) => {
				paths.push(`GET ${String(params["idOrEmail"])}`);
				return HttpResponse.json(
					record({
						tags: ["early", "reader"],
						metadata: { keep: "yes", drop: "me", nested: { a: 1 } },
					}),
				);
			}),
			http.patch(SUBSCRIBER_URL, async ({ request, params }) => {
				paths.push(`PATCH ${String(params["idOrEmail"])}`);
				let body = (await request.json()) as Record<string, unknown>;
				patches.push(body);
				return HttpResponse.json(record(body));
			}),
		);

		let updated = await unwrap(
			create().subscribers.update(
				{ email: email("reader@example.com") },
				{
					tags: { add: ["buyer", "reader"], remove: ["early"] },
					metadata: { purchase: "complete", drop: null },
				},
			),
		);

		expect(paths).toEqual(["GET reader@example.com", "PATCH sub_01jabc"]);
		expect(patches).toEqual([
			{
				tags: ["reader", "buyer"],
				metadata: { keep: "yes", nested: { a: 1 }, purchase: "complete" },
			},
		]);
		expect(updated.metadata).toEqual({ keep: "yes", nested: '{"a":1}', purchase: "complete" });
	});

	test("a subscriber the list does not hold is not_found and nothing is written", async () => {
		server.use(
			http.get(SUBSCRIBER_URL, () => HttpResponse.json({ detail: "Not found" }, { status: 404 })),
		);

		let error = failed(
			await create().subscribers.update(
				{ email: email("stranger@example.com") },
				{ metadata: { purchase: "complete" } },
			),
		);

		expect(error.code).toBe("not_found");
	});
});

describe("unsubscribe", () => {
	test("patches the type to unsubscribed, keeping the record", async () => {
		let received: unknown;

		server.use(
			http.patch(SUBSCRIBER_URL, async ({ request }) => {
				received = await request.json();
				return HttpResponse.json(record({ type: "unsubscribed" }));
			}),
		);

		let subscriber = await unwrap(
			create().subscribers.unsubscribe({ email: email("reader@example.com") }),
		);

		expect(received).toEqual({ type: "unsubscribed" });
		expect(subscriber.status).toBe("unsubscribed");
	});

	test("a suppressed reader whose type cannot change answers its record", async () => {
		server.use(
			http.patch(SUBSCRIBER_URL, () =>
				HttpResponse.json(
					{ code: "subscriber_type_invalid", detail: "Cannot change type" },
					{ status: 400 },
				),
			),
			http.get(SUBSCRIBER_URL, () => HttpResponse.json(record({ type: "complained" }))),
		);

		let subscriber = await unwrap(create().subscribers.unsubscribe({ id: "sub_01jabc" }));

		expect(subscriber.status).toBe("suppressed");
	});
});

describe("webhooks", () => {
	let body = JSON.stringify({
		id: "ext_evt_01jdelivery",
		event_type: "subscriber.confirmed",
		data: { newsletter: "nl_01", subscriber: "sub_01jabc" },
	});

	test("a delivery signed with the configured key verifies", async () => {
		expect(await create().webhooks.verify(await signed(body), body)).toBe(true);
	});

	test("a tampered body is unproven", async () => {
		expect(await create().webhooks.verify(await signed(body), body.replace("sub_", "sub_x"))).toBe(
			false,
		);
	});

	test("a delivery signed with another key is unproven", async () => {
		expect(await create().webhooks.verify(await signed(body, "other"), body)).toBe(false);
	});

	test("with an empty or unset secret every delivery is unproven", async () => {
		let request = await signed(body);

		expect(await create({ webhookSecret: "" }).webhooks.verify(request, body)).toBe(false);
		expect(await new ButtondownNewsletter({ apiKey: API_KEY }).webhooks.verify(request, body)).toBe(
			false,
		);
	});

	test("a missing or malformed signature header is unproven", async () => {
		let unsigned = new Request(WEBHOOK_URL, { method: "POST", body });
		let malformed = new Request(WEBHOOK_URL, {
			method: "POST",
			headers: { "X-Buttondown-Signature": "sha256=not-hex" },
			body,
		});

		expect(await create().webhooks.verify(unsigned, body)).toBe(false);
		expect(await create().webhooks.verify(malformed, body)).toBe(false);
	});

	test("a delivery normalizes to one event keyed by the delivery id", async () => {
		let events = unwrap(create().webhooks.events(await signed(body), body));

		expect(events).toEqual([
			{
				type: "subscriber.confirmed",
				id: "ext_evt_01jdelivery",
				occurredAt: null,
				subscriberId: "sub_01jabc",
				subscriber: null,
				raw: JSON.parse(body),
			},
		]);
	});

	test.each([
		["subscriber.created", "subscriber.created"],
		["subscriber.unsubscribed", "subscriber.unsubscribed"],
		["subscriber.updated", "subscriber.updated"],
		["subscriber.deleted", "subscriber.deleted"],
		["subscriber.bounced", "subscriber.suppressed"],
		["subscriber.complained", "subscriber.suppressed"],
		["subscriber.tags.changed", "subscriber.updated"],
		["subscriber.type.changed", "subscriber.updated"],
	] as const)("%s maps to %s", (eventType, type) => {
		let delivery = JSON.stringify({
			id: "ext_evt_1",
			event_type: eventType,
			data: { subscriber: "sub_1" },
		});

		let [event] = unwrap(create().webhooks.events(new Request(WEBHOOK_URL), delivery));

		expect(event?.type).toBe(type);
	});

	test("an event type outside the table is unrecognized", () => {
		let delivery = JSON.stringify({
			id: "ext_evt_1",
			event_type: "subscriber.paid",
			data: { subscriber: "sub_1" },
		});

		let [event] = unwrap(create().webhooks.events(new Request(WEBHOOK_URL), delivery));

		expect(event).toMatchObject({ type: "unrecognized", providerType: "subscriber.paid" });
	});

	test("a delivery for another newsletter, or about no subscriber, carries no events", () => {
		let other = JSON.stringify({
			id: "ext_evt_1",
			event_type: "subscriber.created",
			data: { newsletter: "nl_other", subscriber: "sub_1" },
		});
		let email = JSON.stringify({
			id: "ext_evt_2",
			event_type: "email.sent",
			data: { email: "em_1" },
		});

		let newsletter = create({ newsletterId: "nl_01" });

		expect(unwrap(newsletter.webhooks.events(new Request(WEBHOOK_URL), other))).toEqual([]);
		expect(unwrap(newsletter.webhooks.events(new Request(WEBHOOK_URL), email))).toEqual([]);
		expect(unwrap(newsletter.webhooks.events(new Request(WEBHOOK_URL), body))).toHaveLength(1);
	});

	test("a body that is not a delivery is invalid_request", () => {
		let newsletter = create();

		expect(failed(newsletter.webhooks.events(new Request(WEBHOOK_URL), "nope")).code).toBe(
			"invalid_request",
		);
		expect(failed(newsletter.webhooks.events(new Request(WEBHOOK_URL), "{}")).code).toBe(
			"invalid_request",
		);
	});
});
