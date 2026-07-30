/**
 * Tests for `POST /api/subscribe` — the funnel's front door. Covers the happy path, the
 * already-subscribed path Buttondown reports as an error, the two provider rejections
 * that get their own visitor-facing copy, and validation failure. Every failure path
 * re-renders the homepage with the error inline, which is what dropping the client-side
 * fetcher changed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { FakeButtondown } from "~/app/lib/test/buttondown";
import { fetchApp } from "~/app/lib/test/router";
import { Buttondown } from "~/app/services/buttondown";

/**
 * Posts the subscribe form against a scripted newsletter client. The body is
 * url-encoded, not multipart: the form has no file input, so this is what a browser
 * actually sends.
 */
function submit(
	buttondown: FakeButtondown,
	email: string,
	attribution: Record<string, string> = {},
) {
	let body = new URLSearchParams({ email, ...attribution });

	return fetchApp("/api/subscribe", {
		method: "POST",
		body,
		services: [[Buttondown, buttondown]],
	});
}

describe("POST /api/subscribe", () => {
	test("subscribes a new address and redirects to the sales page", async () => {
		let buttondown = new FakeButtondown();

		let response = await submit(buttondown, "reader@example.com", {
			source: "newsletter",
			campaign: "launch",
			medium: "email",
		});

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe("/release");
		// Attribution has to reach the newsletter, which is the only place it is stored.
		expect(buttondown.subscribed).toEqual([
			{
				email: "reader@example.com",
				attribution: { source: "newsletter", campaign: "launch", medium: "email" },
			},
		]);
	});

	test("treats an address already on the list as success without re-subscribing", async () => {
		let buttondown = new FakeButtondown({ subscribed: ["reader@example.com"] });

		let response = await submit(buttondown, "reader@example.com");

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe("/release");
		expect(buttondown.subscribed).toEqual([]);
	});

	test("redirects to the sales page when the provider reports the address already exists", async () => {
		let buttondown = new FakeButtondown({ failWith: "email_already_exists" });

		let response = await submit(buttondown, "reader@example.com");

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe("/release");
	});

	test("re-renders the homepage with the blocked-subscriber copy", async () => {
		let buttondown = new FakeButtondown({ failWith: "subscriber_blocked" });

		let response = await submit(buttondown, "reader@example.com");
		let body = await response.text();

		expect(response.status).toBe(400);
		expect(body).toContain("My upstream provider is blocking you");
		// The page itself comes back, not a bare JSON error.
		expect(body).toContain("React Router OAuth2 Handbook");
	});

	test("re-renders the homepage with the invalid-email copy", async () => {
		let buttondown = new FakeButtondown({ failWith: "email_invalid" });

		let response = await submit(buttondown, "reader@example.com");

		expect(response.status).toBe(400);
		expect(await response.text()).toContain("Invalid email address.");
	});

	test("shows a generic message rather than the provider's own error text", async () => {
		let buttondown = new FakeButtondown({
			throws: new Error("upstream provider internals leaked here"),
		});

		let response = await submit(buttondown, "reader@example.com");
		let body = await response.text();

		expect(response.status).toBe(400);
		expect(body).toContain("Something went wrong, please try again.");
		expect(body).not.toContain("upstream provider internals leaked here");
	});

	test("re-renders the homepage with the validation message for a malformed address", async () => {
		let buttondown = new FakeButtondown();

		let response = await submit(buttondown, "not-an-email");

		expect(response.status).toBe(400);
		expect(await response.text()).toContain("Invalid email address");
		// A failed validation must not reach the newsletter at all.
		expect(buttondown.subscribed).toEqual([]);
	});
});
