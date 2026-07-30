/**
 * Tests for the Buttondown client: the three calls the funnel makes, the error envelope
 * it turns into a {@link ButtondownError} with the provider's code, and the 403 that
 * means the API key itself is no longer usable. Buttondown is intercepted with MSW, so
 * the client's real request shape — URL, method, auth header, body — is under test.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";

import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import { Buttondown, ButtondownError } from "./buttondown";

const SUBSCRIBER_URL = "https://api.buttondown.com/v1/subscribers/:email";
const SUBSCRIBERS_URL = "https://api.buttondown.com/v1/subscribers";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

let buttondown = new Buttondown({ apiKey: "key-1" });

describe("Buttondown", () => {
	test("requires an API key", () => {
		expect(() => new Buttondown({ apiKey: "" })).toThrow("BUTTONDOWN_API_KEY is required");
	});

	test("isSubscribed authorizes the request and reports a known subscriber", async () => {
		let authorizations: Array<string | null> = [];

		server.use(
			http.get(SUBSCRIBER_URL, ({ request }) => {
				authorizations.push(request.headers.get("authorization"));
				return HttpResponse.json({ email: "reader@example.com" });
			}),
		);

		expect(await buttondown.isSubscribed("reader@example.com")).toBe(true);
		expect(authorizations).toEqual(["Token key-1"]);
	});

	test("isSubscribed reports an unknown subscriber", async () => {
		server.use(http.get(SUBSCRIBER_URL, () => new HttpResponse(null, { status: 404 })));

		expect(await buttondown.isSubscribed("stranger@example.com")).toBe(false);
	});

	test("subscribe sends the address, UTM attribution, and IP", async () => {
		let received: unknown;

		server.use(
			http.post(SUBSCRIBERS_URL, async ({ request }) => {
				received = await request.json();
				return HttpResponse.json({ id: "sub_1" }, { status: 201 });
			}),
		);

		await buttondown.subscribe(
			"reader@example.com",
			{ source: "newsletter", campaign: "launch", medium: "email" },
			"203.0.113.7",
		);

		expect(received).toEqual({
			email: "reader@example.com",
			utm_source: "newsletter",
			utm_campaign: "launch",
			utm_medium: "email",
			ip_address: "203.0.113.7",
		});
	});

	test("subscribe raises the provider's error code", async () => {
		server.use(
			http.post(SUBSCRIBERS_URL, () =>
				HttpResponse.json(
					{ code: "subscriber_blocked", detail: "Subscriber is blocked" },
					{ status: 400 },
				),
			),
		);

		let error: unknown;
		try {
			await buttondown.subscribe("blocked@example.com", {}, null);
		} catch (thrown) {
			error = thrown;
		}

		expect(error).toBeInstanceOf(ButtondownError);
		expect((error as ButtondownError).code).toBe("subscriber_blocked");
		expect((error as ButtondownError).message).toBe("Subscriber is blocked");
	});

	test("a 403 is a dead API key, not a per-request failure", async () => {
		server.use(http.get(SUBSCRIBER_URL, () => new HttpResponse(null, { status: 403 })));

		expect(buttondown.isSubscribed("reader@example.com")).rejects.toThrow("Forbidden");
	});

	test("addMetadata patches the subscriber", async () => {
		let received: unknown;

		server.use(
			http.patch(SUBSCRIBER_URL, async ({ request }) => {
				received = await request.json();
				return HttpResponse.json({ id: "sub_1" });
			}),
		);

		await buttondown.addMetadata("reader@example.com", { purchase: "complete" });

		expect(received).toEqual({ metadata: { purchase: "complete" } });
	});

	test("addMetadata fails when the patch is rejected", async () => {
		server.use(http.patch(SUBSCRIBER_URL, () => new HttpResponse(null, { status: 400 })));

		expect(buttondown.addMetadata("reader@example.com", { purchase: "complete" })).rejects.toThrow(
			"Failed to add metadata",
		);
	});
});
