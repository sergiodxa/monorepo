/**
 * Tests for the Kit provider, driven through MSW so the assertions are about
 * the requests it sends and how it reads Kit's answers: every documented status
 * and error body, custom-field warnings, batched deliveries and signatures.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { parseEmailAddress } from "@sdxc/email-address";
import { Log } from "@sdxc/logger";
import { isFailure, unwrap } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import type { NewsletterErrorCode } from "../errors.js";

import { NewsletterError } from "../errors.js";

import { FakeKit, KIT_API, kitSignature } from "./fake-kit.js";

import { KitNewsletter } from "./index.js";

/** The key the tests configure and expect on the wire. */
const API_KEY = "kit_test_key";

/** The webhook endpoint's signing secret. */
const WEBHOOK_SECRET = "kit-webhook-secret";

/** The form the tests subscribe through. */
const FORM_ID = "55";

/** Custom fields the fake account has. */
const CUSTOM_FIELDS = ["first_source", "last_source"];

/** A request as the provider sent it. */
interface SentRequest {
	method: string;
	url: URL;
	apiKey: string | null;
	body: string;
}

let server = setupServer();
let pending: Promise<SentRequest>[] = [];

server.events.on("request:start", ({ request }) => {
	let copy = request.clone();
	pending.push(
		copy.text().then((body) => ({
			method: copy.method,
			url: new URL(copy.url),
			apiKey: copy.headers.get("X-Kit-Api-Key"),
			body,
		})),
	);
});

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
	server.resetHandlers();
	pending = [];
});
afterAll(() => server.close());

/** Every request sent so far, in order. */
async function sent(): Promise<SentRequest[]> {
	return await Promise.all(pending);
}

/** The JSON body of a request. */
function bodyOf(request: SentRequest | undefined): unknown {
	return JSON.parse(request?.body ?? "null");
}

/** Builds a provider configured the way an app configures one. */
function kit(options: { apiKey?: string; webhookSecret?: string; form?: boolean } = {}) {
	return new KitNewsletter({
		apiKey: options.apiKey ?? API_KEY,
		webhookSecret: options.webhookSecret ?? WEBHOOK_SECRET,
		...(options.form === false ? {} : { form: { id: FORM_ID, confirmation: "double" as const } }),
		connection: "kit_test",
	});
}

/** Installs a stateful fake account and answers it. */
function account(): FakeKit {
	let fake = new FakeKit({ apiKey: API_KEY, customFields: CUSTOM_FIELDS, forms: [FORM_ID] });
	server.use(...fake.handlers);
	return fake;
}

/** Answers every Kit path with one payload. */
function stub(payload: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
	server.use(
		http.all(`${KIT_API}/*`, () =>
			payload === null
				? new HttpResponse(null, init)
				: HttpResponse.json(payload, { status: init.status ?? 200, headers: init.headers }),
		),
	);
}

/** A subscriber as Kit answers with one. */
function kitSubscriber(overrides: Record<string, unknown> = {}) {
	return {
		id: 341,
		first_name: null,
		email_address: "reader@example.com",
		state: "active",
		created_at: "2026-09-02T17:30:25Z",
		fields: { first_source: "twitter", last_source: null },
		...overrides,
	};
}

/** Kit's pagination block for a last page. */
const LAST_PAGE = {
	has_previous_page: false,
	has_next_page: false,
	start_cursor: "WzFd",
	end_cursor: "WzJd",
	per_page: 100,
};

/** Parses an address the test itself wrote. */
function email(address: string) {
	return unwrap(parseEmailAddress(address));
}

/** Reads the failure a call reported, asserting the code a caller branches on. */
function expectFailure(result: Result<unknown, NewsletterError>, code: NewsletterErrorCode) {
	expect(result.status).toBe("failure");
	if (!isFailure(result)) throw new Error("expected a failure");

	expect(result.error).toBeInstanceOf(NewsletterError);
	expect(result.error.code).toBe(code);
	expect(result.error.connection).toBe("kit_test");

	return result.error;
}

/** One breadcrumb a call left on the current log. */
interface Note {
	name: string;
	[field: string]: unknown;
}

/** Runs a call inside a log and answers the notes it left. */
async function noted<T>(fn: () => Promise<T>): Promise<{ value: T; notes: Note[] }> {
	let records: Record<string, unknown>[] = [];
	let log = new Log({ kind: "request", sink: (record) => void records.push(record) });
	let value = await log.run(fn);

	return { value, notes: (records[0]?.["notes"] ?? []) as Note[] };
}

describe("KitNewsletter requests", () => {
	test("an empty API key is unauthenticated without reaching the network", async () => {
		let result = await kit({ apiKey: "" }).subscribers.find({ id: "1" });

		expectFailure(result, "unauthenticated");
		expect(await sent()).toEqual([]);
	});

	test("find by id reads the subscriber with the key header", async () => {
		stub({ subscriber: kitSubscriber() });

		let subscriber = await unwrap(kit().subscribers.find({ id: "341" }));
		let [request] = await sent();

		expect(request?.method).toBe("GET");
		expect(request?.url.href).toBe(`${KIT_API}/subscribers/341`);
		expect(request?.apiKey).toBe(API_KEY);
		expect(subscriber).toEqual({
			id: "341",
			email: "reader@example.com",
			status: "active",
			providerStatus: "active",
			metadata: { first_source: "twitter" },
			createdAt: new Date("2026-09-02T17:30:25Z"),
		});
	});

	test.each([
		["inactive", "pending"],
		["active", "active"],
		["cancelled", "unsubscribed"],
		["bounced", "suppressed"],
		["complained", "suppressed"],
	])("Kit's %s state reads as %s", async (state, status) => {
		stub({ subscriber: kitSubscriber({ state }) });

		let subscriber = await unwrap(kit().subscribers.find({ id: "341" }));

		expect(subscriber.status).toBe(status);
		expect(subscriber.providerStatus).toBe(state);
	});

	test("an unmapped state on find is invalid_response", async () => {
		stub({ subscriber: kitSubscriber({ state: "archived" }) });

		expectFailure(await kit().subscribers.find({ id: "341" }), "invalid_response");
	});

	test("find by email looks the address up in every state", async () => {
		stub({ subscribers: [kitSubscriber({ state: "cancelled" })], pagination: LAST_PAGE });

		let subscriber = await unwrap(kit().subscribers.find({ email: email("Reader@example.com") }));
		let [request] = await sent();

		expect(request?.url.pathname).toBe("/v4/subscribers");
		expect(request?.url.searchParams.get("email_address")).toBe("Reader@example.com");
		expect(request?.url.searchParams.get("status")).toBe("all");
		expect(subscriber.status).toBe("unsubscribed");
	});

	test("an address Kit does not hold is not_found", async () => {
		stub({ subscribers: [], pagination: LAST_PAGE });

		expectFailure(
			await kit().subscribers.find({ email: email("nobody@example.com") }),
			"not_found",
		);
	});

	test("an id that is not a Kit integer is not_found without a request", async () => {
		expectFailure(await kit().subscribers.find({ id: "sub_1" }), "not_found");
		expect(await sent()).toEqual([]);
	});
});

describe("KitNewsletter failures", () => {
	test.each([
		[401, "unauthenticated"],
		[403, "forbidden"],
		[404, "not_found"],
		[413, "rate_limited"],
		[422, "invalid_request"],
		[429, "rate_limited"],
		[400, "invalid_request"],
		[500, "unknown"],
		[503, "unknown"],
	] as const)("%i is %s and carries Kit's messages", async (status, code) => {
		stub({ errors: ["First problem", "Second problem"] }, { status });

		let error = expectFailure(await kit().subscribers.find({ id: "341" }), code);

		expect(error.message).toBe("First problem; Second problem");
		expect(error.providerCode).toBeNull();
		expect(error.retryable).toBe(code === "rate_limited");
	});

	test("a 429 carries Kit's Retry-After", async () => {
		stub({ errors: ["Too many requests"] }, { status: 429, headers: { "Retry-After": "30" } });

		let error = expectFailure(await kit().subscribers.find({ id: "341" }), "rate_limited");

		expect(error.retryAfter).toBe(30);
	});

	test("a body outside Kit's error shape still reports the status's code", async () => {
		server.use(http.all(`${KIT_API}/*`, () => new HttpResponse("Bad Gateway", { status: 502 })));

		let error = expectFailure(await kit().subscribers.find({ id: "341" }), "unknown");

		expect(error.message).toBe("Bad Gateway");
	});

	test("a lost connection is unknown", async () => {
		server.use(http.all(`${KIT_API}/*`, () => HttpResponse.error()));

		expectFailure(await kit().subscribers.find({ id: "341" }), "unknown");
	});

	test("a 2xx outside the documented shape is invalid_response", async () => {
		stub({ subscriber: { id: "not-a-number" } });

		expectFailure(await kit().subscribers.find({ id: "341" }), "invalid_response");
	});
});

describe("KitNewsletter.subscribers.subscribe", () => {
	test("creates an inactive subscriber, adds it to the form with its attribution, then tags it", async () => {
		let fake = account();

		let { value, notes } = await noted(() =>
			kit().subscribers.subscribe({
				email: email("new@example.com"),
				tags: ["reader"],
				metadata: { first_source: "twitter" },
				attribution: {
					source: "twitter",
					medium: "social",
					campaign: "launch",
					term: "books",
					content: "hero",
					landingPage: "https://example.com/book?ref=home",
				},
				ipAddress: "203.0.113.7",
			}),
		);
		let outcome = unwrap(value);
		let requests = await sent();

		expect(outcome.created).toBe(true);
		expect(outcome.subscriber.status).toBe("pending");
		expect(outcome.subscriber.metadata).toEqual({ first_source: "twitter" });

		expect(requests.map((request) => `${request.method} ${request.url.pathname}`)).toEqual([
			"GET /v4/subscribers",
			"POST /v4/subscribers",
			"POST /v4/forms/55/subscribers",
			"POST /v4/tags",
			`POST /v4/tags/2/subscribers/${outcome.subscriber.id}`,
		]);
		expect(requests.every((request) => request.apiKey === API_KEY)).toBe(true);
		expect(bodyOf(requests[1])).toEqual({
			email_address: "new@example.com",
			state: "inactive",
			fields: { first_source: "twitter" },
		});

		let referrer =
			"https://example.com/book?ref=home&utm_source=twitter&utm_medium=social&utm_campaign=launch&utm_term=books&utm_content=hero";

		expect(bodyOf(requests[2])).toEqual({ email_address: "new@example.com", referrer });
		expect(fake.referrerOf("new@example.com")).toBe(referrer);
		expect(bodyOf(requests[3])).toEqual({ name: "reader" });
		expect(requests.some((request) => request.body.includes("203.0.113.7"))).toBe(false);
		expect(notes.map((note) => note.name)).toEqual(["newsletter.subscribe"]);
	});

	test("an address Kit holds answers created false with one request", async () => {
		stub({ subscribers: [kitSubscriber({ state: "cancelled" })], pagination: LAST_PAGE });

		let outcome = await unwrap(
			kit().subscribers.subscribe({ email: email("reader@example.com"), tags: ["later"] }),
		);

		expect(outcome.created).toBe(false);
		expect(outcome.subscriber.status).toBe("unsubscribed");
		expect(await sent()).toHaveLength(1);
	});

	test("without a form the subscriber is active and attribution is noted as dropped", async () => {
		account();

		let { value, notes } = await noted(() =>
			kit({ form: false }).subscribers.subscribe({
				email: email("plain@example.com"),
				attribution: { source: "twitter", landingPage: "https://example.com/" },
			}),
		);
		let requests = await sent();

		expect(unwrap(value).subscriber.status).toBe("active");
		expect(bodyOf(requests[1])).toEqual({ email_address: "plain@example.com", state: "active" });
		expect(requests.some((request) => request.url.pathname.includes("/forms/"))).toBe(false);
		expect(notes.find((note) => note.name === "newsletter.attribution_dropped")).toMatchObject({
			connection: "kit_test",
			fields: "source,landingPage",
			reason: "no_form",
		});
	});

	test("campaign fields without a landing page are noted as dropped", async () => {
		account();

		let { notes } = await noted(() =>
			kit().subscribers.subscribe({
				email: email("nolanding@example.com"),
				attribution: { source: "twitter", referrer: "t.co" },
			}),
		);
		let requests = await sent();

		expect(bodyOf(requests[2])).toEqual({ email_address: "nolanding@example.com" });
		expect(notes.find((note) => note.name === "newsletter.attribution_dropped")).toMatchObject({
			fields: "source,referrer",
			reason: "no_landing_page",
		});
	});

	test("an unknown metadata key Kit reports as a warning is noted and the stored record answered", async () => {
		account();

		let { value, notes } = await noted(() =>
			kit().subscribers.subscribe({
				email: email("warned@example.com"),
				metadata: { first_source: "twitter", favourite_colour: "green" },
			}),
		);
		let outcome = unwrap(value);

		expect(outcome.created).toBe(true);
		expect(outcome.subscriber.metadata).toEqual({ first_source: "twitter" });
		expect(notes.find((note) => note.name === "newsletter.metadata_dropped")).toMatchObject({
			connection: "kit_test",
			warnings: "favourite_colour",
		});
	});

	test("a refused address is invalid_request, since Kit gives it no distinct code", async () => {
		server.use(
			http.get(`${KIT_API}/subscribers`, () =>
				HttpResponse.json({ subscribers: [], pagination: LAST_PAGE }),
			),
			http.post(`${KIT_API}/subscribers`, () =>
				HttpResponse.json({ errors: ["Email address is invalid"] }, { status: 422 }),
			),
		);

		let error = expectFailure(
			await kit().subscribers.subscribe({ email: email("odd@example.com") }),
			"invalid_request",
		);

		expect(error.message).toBe("Email address is invalid");
	});
});

describe("KitNewsletter.subscribers.update", () => {
	test("an unknown custom-field key is invalid_request and nothing is written", async () => {
		account();
		let newsletter = kit();
		let { subscriber } = await unwrap(
			newsletter.subscribers.subscribe({ email: email("update@example.com") }),
		);
		pending = [];

		let result = await newsletter.subscribers.update(
			{ id: subscriber.id },
			{ tags: { add: ["buyer"] }, metadata: { purchase: "pro" } },
		);
		let requests = await sent();

		expect(expectFailure(result, "invalid_request").message).toContain("purchase");
		expect(requests.map((request) => request.method)).toEqual(["GET", "GET"]);
		expect(requests[1]?.url.pathname).toBe("/v4/custom_fields");
	});

	test("a null value is written as null, which clears the field", async () => {
		account();
		let newsletter = kit();
		let { subscriber } = await unwrap(
			newsletter.subscribers.subscribe({
				email: email("clear@example.com"),
				metadata: { first_source: "a", last_source: "b" },
			}),
		);
		pending = [];

		let updated = await unwrap(
			newsletter.subscribers.update({ id: subscriber.id }, { metadata: { first_source: null } }),
		);
		let put = (await sent()).find((request) => request.method === "PUT");

		expect(put?.url.pathname).toBe(`/v4/subscribers/${subscriber.id}`);
		expect(bodyOf(put)).toEqual({
			email_address: "clear@example.com",
			fields: { first_source: null },
		});
		expect(updated.metadata).toEqual({ last_source: "b" });
	});

	test("removing a tag deletes only the tags the subscriber carries, by Kit's id", async () => {
		account();
		let newsletter = kit();
		let { subscriber } = await unwrap(
			newsletter.subscribers.subscribe({ email: email("tags@example.com"), tags: ["Buyer"] }),
		);
		pending = [];

		await unwrap(
			newsletter.subscribers.update(
				{ id: subscriber.id },
				{ tags: { remove: ["buyer", "ghost"] } },
			),
		);
		let requests = await sent();

		expect(requests.map((request) => `${request.method} ${request.url.pathname}`)).toEqual([
			`GET /v4/subscribers/${subscriber.id}`,
			`GET /v4/subscribers/${subscriber.id}/tags`,
			`DELETE /v4/tags/2/subscribers/${subscriber.id}`,
		]);
		expect(await unwrap(newsletter.subscribers.tags({ id: subscriber.id }))).toEqual([]);
	});

	test("a tag name resolves once per instance", async () => {
		account();
		let newsletter = kit();
		let first = await unwrap(newsletter.subscribers.subscribe({ email: email("a@example.com") }));
		let second = await unwrap(newsletter.subscribers.subscribe({ email: email("b@example.com") }));
		pending = [];

		await unwrap(
			newsletter.subscribers.update({ id: first.subscriber.id }, { tags: { add: ["vip"] } }),
		);
		await unwrap(
			newsletter.subscribers.update({ id: second.subscriber.id }, { tags: { add: ["vip"] } }),
		);

		let creates = (await sent()).filter(
			(request) => request.method === "POST" && request.url.pathname === "/v4/tags",
		);

		expect(creates).toHaveLength(1);
	});
});

describe("KitNewsletter.subscribers.list", () => {
	test("maps the status filter, page size and cursor onto Kit's query", async () => {
		stub({
			subscribers: [kitSubscriber({ id: 1, state: "inactive" })],
			pagination: { ...LAST_PAGE, has_next_page: true, end_cursor: "WzNd" },
		});

		let page = await unwrap(
			kit().subscribers.list({ status: "pending", limit: 2, cursor: "WzFd" }),
		);
		let [request] = await sent();

		expect(request?.url.pathname).toBe("/v4/subscribers");
		expect(Object.fromEntries(request?.url.searchParams ?? [])).toEqual({
			status: "inactive",
			per_page: "2",
			after: "WzFd",
		});
		expect(page.cursor).toBe("WzNd");
		expect(page.items.map((item) => item.id)).toEqual(["1"]);
	});

	test("the last page answers a null cursor and the page size is capped at Kit's maximum", async () => {
		stub({ subscribers: [], pagination: LAST_PAGE });

		let page = await unwrap(kit().subscribers.list({ limit: 5000 }));
		let [request] = await sent();

		expect(request?.url.searchParams.get("per_page")).toBe("1000");
		expect(request?.url.searchParams.get("status")).toBe("all");
		expect(page.cursor).toBeNull();
	});

	test("suppressed lists every state and keeps the bounced and complained rows", async () => {
		stub({
			subscribers: [
				kitSubscriber({ id: 1, state: "bounced" }),
				kitSubscriber({ id: 2, state: "active" }),
				kitSubscriber({ id: 3, state: "complained" }),
			],
			pagination: LAST_PAGE,
		});

		let page = await unwrap(kit().subscribers.list({ status: "suppressed" }));
		let [request] = await sent();

		expect(request?.url.searchParams.get("status")).toBe("all");
		expect(page.items.map((item) => item.id)).toEqual(["1", "3"]);
	});

	test("a row in an unmapped state is skipped and reported", async () => {
		stub({
			subscribers: [kitSubscriber({ id: 1 }), kitSubscriber({ id: 2, state: "archived" })],
			pagination: LAST_PAGE,
		});

		let { value, notes } = await noted(() => kit().subscribers.list());

		expect(unwrap(value).items.map((item) => item.id)).toEqual(["1"]);
		expect(notes.find((note) => note.name === "newsletter.skipped_row")).toMatchObject({
			id: "2",
			providerStatus: "archived",
		});
	});

	test("a tag the account lacks lists nothing and creates no tag", async () => {
		account();

		let page = await unwrap(kit().subscribers.list({ tag: "missing" }));
		let requests = await sent();

		expect(page).toEqual({ items: [], cursor: null });
		expect(requests.map((request) => `${request.method} ${request.url.pathname}`)).toEqual([
			"GET /v4/tags",
		]);
	});
});

describe("KitNewsletter.subscribers.unsubscribe", () => {
	test("posts the unsubscribe and answers the reader cancelled", async () => {
		account();
		let newsletter = kit();
		let { subscriber } = await unwrap(
			newsletter.subscribers.subscribe({ email: email("leaving@example.com") }),
		);
		pending = [];

		let left = await unwrap(
			newsletter.subscribers.unsubscribe({ email: email("leaving@example.com") }),
		);
		let requests = await sent();

		expect(requests.map((request) => `${request.method} ${request.url.pathname}`)).toEqual([
			"GET /v4/subscribers",
			`POST /v4/subscribers/${subscriber.id}/unsubscribe`,
		]);
		expect(left.status).toBe("unsubscribed");
		expect(left.providerStatus).toBe("cancelled");
	});

	test("a reader Kit already mails nothing to is answered without a write", async () => {
		stub({ subscriber: kitSubscriber({ state: "bounced" }) });

		let held = await unwrap(kit().subscribers.unsubscribe({ id: "341" }));

		expect(held.status).toBe("suppressed");
		expect((await sent()).map((request) => request.method)).toEqual(["GET"]);
	});
});

/** Signs a body as Kit does, at `timestamp` seconds, with each of `secrets`. */
async function signed(
	body: string,
	secrets: readonly string[],
	timestamp = Math.floor(Date.now() / 1000),
) {
	let entries = await Promise.all(
		secrets.map(async (secret) => `v1=${await kitSignature(secret, body, timestamp)}`),
	);

	return new Request("https://app.example.com/webhooks/kit", {
		method: "POST",
		headers: { "x-kit-signature": [`t=${timestamp}`, ...entries].join(",") },
		body,
	});
}

/** A delivery body carrying one event per subscriber id, all of one type. */
function deliveryBody(type: string, ids: readonly number[]): string {
	return JSON.stringify({
		delivery_id: 123456,
		events: ids.map((id, index) => ({
			id: `evt-${index}`,
			type,
			created: "2026-07-29T14:32:10Z",
			data: { subscriber: kitSubscriber({ id, state: "bounced" }) },
		})),
	});
}

describe("KitNewsletter.webhooks.verify", () => {
	let body = deliveryBody("subscriber.created", [1]);

	test("accepts a delivery signed with the configured secret", async () => {
		expect(await kit().webhooks.verify(await signed(body, [WEBHOOK_SECRET]), body)).toBe(true);
	});

	test("refuses a tampered body", async () => {
		let request = await signed(body, [WEBHOOK_SECRET]);
		expect(await kit().webhooks.verify(request, body.replace("reader", "intruder"))).toBe(false);
	});

	test("refuses a delivery signed with another secret", async () => {
		expect(await kit().webhooks.verify(await signed(body, ["another-secret"]), body)).toBe(false);
	});

	test("fails closed with an empty secret", async () => {
		let request = await signed(body, [WEBHOOK_SECRET]);
		expect(await kit({ webhookSecret: "" }).webhooks.verify(request, body)).toBe(false);
	});

	test("refuses a signing time outside five minutes", async () => {
		let stale = Math.floor(Date.now() / 1000) - 301;
		let future = Math.floor(Date.now() / 1000) + 301;

		expect(await kit().webhooks.verify(await signed(body, [WEBHOOK_SECRET], stale), body)).toBe(
			false,
		);
		expect(await kit().webhooks.verify(await signed(body, [WEBHOOK_SECRET], future), body)).toBe(
			false,
		);
	});

	test("accepts a rotation header when either v1 entry matches", async () => {
		let newFirst = await signed(body, [WEBHOOK_SECRET, "old-secret"]);
		let oldFirst = await signed(body, ["new-secret", WEBHOOK_SECRET]);

		expect(await kit().webhooks.verify(newFirst, body)).toBe(true);
		expect(await kit().webhooks.verify(oldFirst, body)).toBe(true);
	});

	test("refuses a delivery with no signature header", async () => {
		let request = new Request("https://app.example.com/webhooks/kit", { method: "POST", body });
		expect(await kit().webhooks.verify(request, body)).toBe(false);
	});
});

describe("KitNewsletter.webhooks.events", () => {
	test("answers one event per entry of a batched delivery, carrying each subscriber", async () => {
		let body = deliveryBody("subscriber.bounced", [11, 12, 13]);
		let events = unwrap(kit().webhooks.events(await signed(body, [WEBHOOK_SECRET]), body));

		expect(events.map((event) => [event.type, event.id, event.subscriberId])).toEqual([
			["subscriber.suppressed", "evt-0", "11"],
			["subscriber.suppressed", "evt-1", "12"],
			["subscriber.suppressed", "evt-2", "13"],
		]);
		expect(events[0]?.occurredAt).toEqual(new Date("2026-07-29T14:32:10Z"));
		expect(events[0]?.subscriber).toMatchObject({ id: "11", status: "suppressed" });
		expect(events[0]?.raw).toMatchObject({ id: "evt-0", type: "subscriber.bounced" });
	});

	test.each([
		["subscriber.created", "subscriber.created"],
		["subscriber.activated", "subscriber.confirmed"],
		["subscriber.unsubscribed", "subscriber.unsubscribed"],
		["subscriber.complained", "subscriber.suppressed"],
		["subscriber.tag_added", "subscriber.updated"],
		["subscriber.tag_removed", "subscriber.updated"],
		["subscriber.custom_field_value_updated", "subscriber.updated"],
	])("Kit's %s is %s", (kitType, type) => {
		let body = deliveryBody(kitType, [1]);
		let [event] = unwrap(kit().webhooks.events(new Request("https://app.example.com"), body));

		expect(event?.type).toBe(type);
	});

	test("a subscriber event outside the table is unrecognized", () => {
		let body = deliveryBody("subscriber.subscribed_to_form", [1]);
		let [event] = unwrap(kit().webhooks.events(new Request("https://app.example.com"), body));

		expect(event).toMatchObject({
			type: "unrecognized",
			providerType: "subscriber.subscribed_to_form",
			subscriberId: "1",
		});
	});

	test("a resource event without a subscriber is left out of the events", () => {
		let body = JSON.stringify({
			delivery_id: 1,
			events: [
				{
					id: "evt-tag",
					type: "tag.created",
					created: "2026-07-29T14:32:10Z",
					data: { tag: { id: 42 } },
				},
			],
		});
		let events = unwrap(kit().webhooks.events(new Request("https://app.example.com"), body));

		expect(events).toEqual([]);
	});

	test("a body that is not a Kit delivery is invalid_request", () => {
		let request = new Request("https://app.example.com");

		expectFailure(kit().webhooks.events(request, "not json"), "invalid_request");
		expectFailure(kit().webhooks.events(request, JSON.stringify({ event: {} })), "invalid_request");
	});
});
