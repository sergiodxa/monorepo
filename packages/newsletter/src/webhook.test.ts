/**
 * Tests the webhook endpoint against deliveries the memory provider signs: it
 * refuses an unproven delivery, acknowledges an unreadable authentic one, skips
 * a redelivered event, asks for a retry when a handler throws, and acknowledges
 * an event type nothing handles.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@sdxc/duration";
import type { ReplayStore } from "@sdxc/webhooks";

import { unwrap } from "@sdxc/result";
import { sign } from "@sdxc/webhooks";
import { RequestContext } from "remix/router";
import { describe, expect, test } from "vitest";

import { MemoryNewsletter } from "./memory.js";
import newsletterMiddleware from "./middleware.js";
import { NewsletterWebhook } from "./webhook.js";

/** Secret both the provider and the hand-signed deliveries are keyed on. */
const SECRET = "dGVzdC1uZXdzbGV0dGVyLXNpZ25pbmctc2VjcmV0";

/** Remembers ids for the life of the test, recording the expiry each was given. */
class MapReplayStore implements ReplayStore {
	readonly remembered = new Map<string, DurationInput>();

	async seen(id: string): Promise<boolean> {
		return this.remembered.has(id);
	}

	async remember(id: string, ttl: DurationInput): Promise<void> {
		this.remembered.set(id, ttl);
	}
}

describe("NewsletterWebhook", () => {
	test("dispatches an authentic event to the handler keyed by its type", async () => {
		let newsletter = new MemoryNewsletter({ webhookSecret: SECRET });
		let [reader] = newsletter.seed([{ email: "reader@example.com", status: "pending" }]);
		let confirmed: string[] = [];

		let endpoint = new NewsletterWebhook(newsletter, {
			async "subscriber.confirmed"(event) {
				confirmed.push(event.subscriberId);
			},
		});

		let delivery = await unwrap(
			newsletter.webhooks.emit({ type: "subscriber.confirmed", subscriberId: reader?.id ?? "" }),
		);
		let response = await endpoint.handler(new RequestContext(delivery.request));

		expect(response.status).toBe(200);
		expect(confirmed).toEqual([reader?.id]);
	});

	test("refuses an unproven delivery with 401 and runs no handler", async () => {
		let newsletter = new MemoryNewsletter({ webhookSecret: SECRET });
		let forger = new MemoryNewsletter({ webhookSecret: "Zm9yZ2VkLXNlY3JldC12YWx1ZS1oZXJl" });
		let ran = false;

		let endpoint = new NewsletterWebhook(newsletter, {
			"subscriber.confirmed": () => {
				ran = true;
			},
		});

		let delivery = await unwrap(
			forger.webhooks.emit({ type: "subscriber.confirmed", subscriberId: "sub_1" }),
		);
		let response = await endpoint.handler(new RequestContext(delivery.request));

		expect(response.status).toBe(401);
		expect(ran).toBe(false);
	});

	test("refuses every delivery when the provider has no secret", async () => {
		let signer = new MemoryNewsletter();
		let endpoint = new NewsletterWebhook(new MemoryNewsletter({ webhookSecret: "" }), {});

		let delivery = await unwrap(
			signer.webhooks.emit({ type: "subscriber.created", subscriberId: "sub_1" }),
		);

		expect((await endpoint.handler(new RequestContext(delivery.request))).status).toBe(401);
	});

	test("acknowledges an authentic body it cannot parse", async () => {
		let newsletter = new MemoryNewsletter({ webhookSecret: SECRET });
		let endpoint = new NewsletterWebhook(newsletter, {});

		let signed = await unwrap(
			sign({ unexpected: true }, { secret: SECRET, id: "msg_1", timestamp: new Date() }),
		);
		let request = new Request("https://example.com/webhooks/newsletter", {
			method: "POST",
			headers: signed.headers,
			body: signed.body,
		});

		expect((await endpoint.handler(new RequestContext(request))).status).toBe(200);
	});

	test("skips a redelivered event id once its handler finished", async () => {
		let newsletter = new MemoryNewsletter({ webhookSecret: SECRET });
		let store = new MapReplayStore();
		let runs = 0;

		let endpoint = new NewsletterWebhook(
			newsletter,
			{
				"subscriber.unsubscribed": () => {
					runs += 1;
				},
			},
			{ store },
		);

		for (let attempt = 0; attempt < 2; attempt += 1) {
			let delivery = await unwrap(
				newsletter.webhooks.emit({
					type: "subscriber.unsubscribed",
					subscriberId: "sub_1",
					id: "evt_1",
				}),
			);
			expect((await endpoint.handler(new RequestContext(delivery.request))).status).toBe(200);
		}

		expect(runs).toBe(1);
		expect(store.remembered.get("evt_1")).toBe("7 days");
	});

	test("answers 503 when a handler throws and leaves the event unremembered", async () => {
		let newsletter = new MemoryNewsletter({ webhookSecret: SECRET });
		let store = new MapReplayStore();
		let fail = true;
		let runs = 0;

		let endpoint = new NewsletterWebhook(
			newsletter,
			{
				"subscriber.created": () => {
					runs += 1;
					if (fail) throw new Error("database unavailable");
				},
			},
			{ store },
		);

		let delivery = await unwrap(
			newsletter.webhooks.emit({ type: "subscriber.created", subscriberId: "sub_1", id: "evt_2" }),
		);

		expect((await endpoint.handler(new RequestContext(delivery.request.clone()))).status).toBe(503);
		expect(store.remembered.has("evt_2")).toBe(false);

		fail = false;

		expect((await endpoint.handler(new RequestContext(delivery.request))).status).toBe(200);
		expect(runs).toBe(2);
		expect(store.remembered.has("evt_2")).toBe(true);
	});

	test("acknowledges an unrecognized event type and remembers it", async () => {
		let newsletter = new MemoryNewsletter({ webhookSecret: SECRET });
		let store = new MapReplayStore();
		let endpoint = new NewsletterWebhook(newsletter, {}, { store });

		let delivery = await unwrap(
			newsletter.webhooks.emit({
				type: "unrecognized",
				providerType: "subscriber.reactivated",
				subscriberId: "sub_1",
				id: "evt_3",
			}),
		);

		expect((await endpoint.handler(new RequestContext(delivery.request))).status).toBe(200);
		expect(store.remembered.has("evt_3")).toBe(true);
	});
});

describe("newsletter middleware", () => {
	test("publishes the configured provider as context.newsletter", async () => {
		let provider = new MemoryNewsletter({ connection: "books" });
		let context = new RequestContext(new Request("https://example.com/subscribe"));
		let seen: string | undefined;

		await newsletterMiddleware({ provider })(context, async () => {
			seen = context.newsletter.connection;
			return new Response("ok");
		});

		expect(seen).toBe("books");
	});

	test("resolves the provider per request when given a factory", async () => {
		let tenants = new Map([["eu", new MemoryNewsletter({ connection: "eu" })]]);
		let context = new RequestContext(new Request("https://eu.example.com/subscribe"));
		let seen: string | undefined;

		await newsletterMiddleware({
			provider: (current) => tenants.get(current.url.hostname.split(".")[0] ?? "") ?? provider(),
		})(context, async () => {
			seen = context.newsletter.connection;
			return new Response("ok");
		});

		expect(seen).toBe("eu");
	});
});

/** The fallback a factory answers for an unknown tenant. */
function provider(): MemoryNewsletter {
	return new MemoryNewsletter({ connection: "default" });
}
