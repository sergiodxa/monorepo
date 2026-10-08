/**
 * Tests for `POST /api/subscribe` — the funnel's front door. Covers the happy path, an
 * address already on the list, the two newsletter refusals that get their own
 * visitor-facing copy, and validation failure. Every failure path
 * re-renders the homepage with the error inline, which is what dropping the client-side
 * fetcher changed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { MemoryNewsletter } from "@sdxc/newsletter/memory";
import { describe, expect, test } from "vitest";

import { landFrom } from "~/app/lib/test/attribution";
import { subscribed } from "~/app/lib/test/newsletter";
import { fetchApp } from "~/app/lib/test/router";

/**
 * Posts the subscribe form against an in-memory newsletter, sending the attribution cookie a
 * landing set when one is given. The body is url-encoded, matching what a browser sends for a
 * form built only from text fields.
 */
function submit(
	newsletter: MemoryNewsletter,
	email: string,
	fields: Record<string, string> = {},
	cookie?: string,
) {
	let body = new URLSearchParams({ email, ...fields });
	let headers: Record<string, string> = cookie ? { cookie } : {};

	return fetchApp("/api/subscribe", { method: "POST", body, headers, newsletter });
}

describe("POST /api/subscribe", () => {
	test("records the visitor's IP from CF-Connecting-IP in its canonical spelling", async () => {
		let newsletter = new MemoryNewsletter();
		let body = new URLSearchParams({ email: "reader@example.com" });

		await fetchApp("/api/subscribe", {
			method: "POST",
			body,
			headers: { "cf-connecting-ip": "2001:DB8::0:1" },
			newsletter,
		});

		expect(newsletter.ip("reader@example.com")?.toString()).toBe("2001:db8::1");
	});

	test("subscribes without an IP when CF-Connecting-IP is malformed", async () => {
		let newsletter = new MemoryNewsletter();
		let body = new URLSearchParams({ email: "reader@example.com" });

		await fetchApp("/api/subscribe", {
			method: "POST",
			body,
			headers: { "cf-connecting-ip": "unknown" },
			newsletter,
		});

		expect(await subscribed(newsletter)).toEqual(["reader@example.com"]);
		expect(newsletter.ip("reader@example.com")).toBeNull();
	});

	test("subscribes a new address and redirects to the sales page", async () => {
		let newsletter = new MemoryNewsletter();

		let cookie = await landFrom(
			"/sample?utm_source=Newsletter&utm_campaign=Launch&utm_medium=email",
		);

		let response = await submit(newsletter, "reader@example.com", {}, cookie);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe("/release");
		/**
		 * The campaign is read from the cookie the landing page set, on a later page than the
		 * one the visitor arrived on, and has to reach the newsletter, the only place it is stored.
		 */
		expect(await subscribed(newsletter)).toEqual(["reader@example.com"]);
		expect(newsletter.attribution("reader@example.com")).toEqual({
			source: "newsletter",
			campaign: "launch",
			medium: "email",
			landingPage: "https://books.test/sample",
		});
	});

	test("ignores campaign fields posted with the form", async () => {
		let newsletter = new MemoryNewsletter();

		await submit(newsletter, "reader@example.com", { source: "forged", campaign: "forged" });

		expect(newsletter.attribution("reader@example.com")).toBeNull();
	});

	test("treats an address already on the list as success without re-subscribing", async () => {
		let newsletter = new MemoryNewsletter();
		newsletter.seed([{ email: "reader@example.com" }]);

		let cookie = await landFrom("/?utm_source=later");
		let response = await submit(newsletter, "reader@example.com", {}, cookie);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe("/release");
		expect(await subscribed(newsletter)).toEqual(["reader@example.com"]);
		expect(newsletter.attribution("reader@example.com")).toBeNull();
	});

	test("re-renders the homepage with the blocked-subscriber copy", async () => {
		let newsletter = new MemoryNewsletter({ faults: { "subscribers.subscribe": "suppressed" } });

		let response = await submit(newsletter, "reader@example.com");
		let body = await response.text();

		expect(response.status).toBe(400);
		expect(body).toContain("My upstream provider is blocking you");
		expect(body).toContain("React Router OAuth2 Handbook");
	});

	test("re-renders the homepage with the invalid-email copy", async () => {
		let newsletter = new MemoryNewsletter({
			faults: { "subscribers.subscribe": "invalid_address" },
		});

		let response = await submit(newsletter, "reader@example.com");

		expect(response.status).toBe(400);
		expect(await response.text()).toContain("Invalid email address.");
	});

	test("shows a generic message rather than the provider's own error text", async () => {
		let newsletter = new MemoryNewsletter({ faults: { "subscribers.subscribe": "unknown" } });

		let response = await submit(newsletter, "reader@example.com");
		let body = await response.text();

		expect(response.status).toBe(400);
		expect(body).toContain("Something went wrong, please try again.");
		expect(body).not.toContain("armed fault");
	});

	test("re-renders the homepage with the validation message for a malformed address", async () => {
		let newsletter = new MemoryNewsletter();

		let response = await submit(newsletter, "not-an-email");

		expect(response.status).toBe(400);
		expect(await response.text()).toContain("Invalid email address");
		/**
		 * Validation failure keeps the address local; only a valid address is
		 * forwarded to the newsletter.
		 */
		expect(await subscribed(newsletter)).toEqual([]);
	});

	test("refuses an IP-literal address the parser rejects, forwarding nothing", async () => {
		let newsletter = new MemoryNewsletter();

		let response = await submit(newsletter, "reader@127.0.0.1");

		expect(response.status).toBe(400);
		expect(await response.text()).toContain("Invalid email address");
		expect(await subscribed(newsletter)).toEqual([]);
	});

	test("subscribes the parsed address: trimmed, with its domain lowercased", async () => {
		let newsletter = new MemoryNewsletter();

		let response = await submit(newsletter, " Reader@Example.COM ");

		expect(response.status).toBe(303);
		expect(await subscribed(newsletter)).toEqual(["Reader@example.com"]);
	});

	test("refuses a disposable address with its own copy", async () => {
		let newsletter = new MemoryNewsletter();

		let response = await submit(newsletter, "reader@inbox.mailinator.com");

		expect(response.status).toBe(400);
		expect(await response.text()).toContain("Temporary inboxes");
		expect(await subscribed(newsletter)).toEqual([]);
	});

	test("keeps refusing a disposable address that arrives marked as confirmed", async () => {
		let newsletter = new MemoryNewsletter();

		let response = await submit(newsletter, "reader@mailinator.com", {
			confirmed: "reader@mailinator.com",
		});

		expect(response.status).toBe(400);
		expect(await subscribed(newsletter)).toEqual([]);
	});

	test("suggests the provider for a mistyped domain, prefilling the address as typed", async () => {
		let newsletter = new MemoryNewsletter();

		let response = await submit(newsletter, "reader@gnail.com");
		let body = await response.text();

		expect(response.status).toBe(400);
		expect(body).toContain("Did you mean reader@gmail.com?");
		expect(body).toContain('value="reader@gnail.com"');
		expect(body).toContain('name="confirmed" value="reader@gnail.com"');
		expect(await subscribed(newsletter)).toEqual([]);
	});

	test("subscribes a mistyped-looking address once the visitor submits it again", async () => {
		let newsletter = new MemoryNewsletter();

		let response = await submit(newsletter, "reader@gnail.com", { confirmed: "reader@gnail.com" });

		expect(response.status).toBe(303);
		expect(await subscribed(newsletter)).toEqual(["reader@gnail.com"]);
	});

	test("suggests the provider for a typo domain the disposable list carries, then refuses it if kept", async () => {
		let newsletter = new MemoryNewsletter();

		let prompt = await submit(newsletter, "reader@gmial.com");

		expect(prompt.status).toBe(400);
		expect(await prompt.text()).toContain("Did you mean reader@gmail.com?");

		let kept = await submit(newsletter, "reader@gmial.com", { confirmed: "reader@gmial.com" });

		expect(kept.status).toBe(400);
		expect(await kept.text()).toContain("Temporary inboxes");
		expect(await subscribed(newsletter)).toEqual([]);
	});

	test("asks again when the address changed since the suggestion was shown", async () => {
		let newsletter = new MemoryNewsletter();

		let response = await submit(newsletter, "reader@yaho.com", {
			confirmed: "reader@gnail.com",
		});

		expect(response.status).toBe(400);
		expect(await response.text()).toContain("Did you mean reader@yahoo.com?");
		expect(await subscribed(newsletter)).toEqual([]);
	});
});
