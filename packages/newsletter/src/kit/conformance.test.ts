/**
 * Runs the shared conformance suite against the Kit provider, served by a
 * stateful MSW model of Kit's documented API behind a double opt-in form, so
 * the provider is held to the same rules as every other newsletter.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { setupServer } from "msw/node";
import { afterAll, beforeAll, beforeEach } from "vitest";

import type { Newsletter } from "../contract.js";
import type { Subscriber } from "../types.js";

import { conformance } from "../conformance.js";

import { FakeKit, kitSignature } from "./fake-kit.js";

import { KitNewsletter } from "./index.js";

/** The key the fake account accepts. */
const API_KEY = "kit_conformance_key";

/** The webhook endpoint's signing secret. */
const WEBHOOK_SECRET = "kit-conformance-secret";

/** The double opt-in form every subscription goes through. */
const FORM_ID = "55";

/** Custom fields the fake account already has, which Kit requires before a value is written. */
const CUSTOM_FIELDS = ["first_source", "last_source"] as const;

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
	server.resetHandlers(
		...new FakeKit({ apiKey: API_KEY, customFields: CUSTOM_FIELDS, forms: [FORM_ID] }).handlers,
	);
});
afterAll(() => server.close());

/** Builds the provider the way an app configures one. */
function kit(webhookSecret = WEBHOOK_SECRET): KitNewsletter {
	return new KitNewsletter({
		apiKey: API_KEY,
		webhookSecret,
		form: { id: FORM_ID, confirmation: "double" },
	});
}

/** Signs a `subscriber.activated` delivery about a subscriber, as Kit sends one. */
async function deliver(_provider: Newsletter, subscriber: Subscriber) {
	let body = JSON.stringify({
		delivery_id: 1,
		events: [
			{
				id: crypto.randomUUID(),
				type: "subscriber.activated",
				created: new Date().toISOString(),
				data: {
					subscriber: {
						id: Number(subscriber.id),
						first_name: null,
						email_address: subscriber.email,
						state: "active",
						created_at: subscriber.createdAt.toISOString(),
						fields: subscriber.metadata,
					},
				},
			},
		],
	});
	let timestamp = Math.floor(Date.now() / 1000);
	let signature = await kitSignature(WEBHOOK_SECRET, body, timestamp);

	return {
		request: new Request("https://app.example.com/webhooks/kit", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-kit-signature": `t=${timestamp},v1=${signature}`,
			},
			body,
		}),
		body,
	};
}

conformance({
	name: "KitNewsletter",
	create: () => kit(),
	createWithoutSecret: () => kit(""),
	confirmation: "double",
	deliver,
	metadataKeys: CUSTOM_FIELDS,
	missingId: "999999999",
});
