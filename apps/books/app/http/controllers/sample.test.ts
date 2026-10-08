/**
 * Tests for `/sample` — the gated chapter. The gate is the point: a valid
 * address unlocks the chapter, an address already on the list unlocks it
 * too, and a malformed address is caught before it reaches the newsletter.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { MemoryNewsletter } from "@sdxc/newsletter/memory";
import { describe, expect, test } from "vitest";

import { subscribed } from "~/app/lib/test/newsletter";
import { fetchApp } from "~/app/lib/test/router";

/** The chapter's first heading, which only the unlocked page renders. */
const CHAPTER_HEADING = "OAuth2 in Simple Terms";

function submit(newsletter: MemoryNewsletter, email: string, fields: Record<string, string> = {}) {
	return fetchApp("/sample", {
		method: "POST",
		body: new URLSearchParams({ email, ...fields }),
		newsletter,
	});
}

describe("GET /sample", () => {
	test("renders the offer and its email field, not the chapter", async () => {
		let response = await fetchApp("/sample");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain("Get a Free Sample");
		expect(body).toContain("Read free sample");
		expect(body).toContain('action="/sample"');
		expect(body).not.toContain(CHAPTER_HEADING);
	});
});

describe("POST /sample", () => {
	test("subscribes a new address and renders the chapter", async () => {
		let newsletter = new MemoryNewsletter();

		let response = await submit(newsletter, "reader@example.com");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain(CHAPTER_HEADING);
		expect(await subscribed(newsletter)).toEqual(["reader@example.com"]);
	});

	test("renders the chapter for an address already on the list", async () => {
		let newsletter = new MemoryNewsletter();
		newsletter.seed([{ email: "reader@example.com", status: "unsubscribed" }]);

		let response = await submit(newsletter, "reader@example.com");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain(CHAPTER_HEADING);
		expect(await subscribed(newsletter)).toEqual(["reader@example.com"]);
	});

	test("renders the chapter's code fences, in every language the chapter uses", async () => {
		let body = await submit(new MemoryNewsletter(), "reader@example.com").then((response) =>
			response.text(),
		);

		expect(body).toContain('class="language-javascript');
		expect(body).toContain('class="language-typescript');
		expect(body).toContain('class="language-plain');
		expect(body.match(/<pre class="language-/g)).toHaveLength(6);
	});

	test("keeps the chapter out of the index, since the URL's other state is the form", async () => {
		let body = await submit(new MemoryNewsletter(), "reader@example.com").then((response) =>
			response.text(),
		);

		expect(body).toContain("noindex");
	});

	test("re-renders the form with the error inline for a malformed address", async () => {
		let newsletter = new MemoryNewsletter();

		let response = await submit(newsletter, "not-an-email");
		let body = await response.text();

		expect(response.status).toBe(400);
		expect(body).toContain("Invalid email address");
		expect(body).toContain("Get a Free Sample");
		expect(body).not.toContain(CHAPTER_HEADING);
		expect(await subscribed(newsletter)).toEqual([]);
	});

	test("shows the provider's blocked rejection as the copy written for a reader", async () => {
		let newsletter = new MemoryNewsletter({ faults: { "subscribers.subscribe": "suppressed" } });

		let response = await submit(newsletter, "reader@example.com");
		let body = await response.text();

		expect(response.status).toBe(400);
		expect(body).toContain("blocking you");
		expect(body).not.toContain(CHAPTER_HEADING);
	});

	test("shows a generic message rather than the provider's own error text", async () => {
		let newsletter = new MemoryNewsletter({ faults: { "subscribers.subscribe": "unknown" } });

		let response = await submit(newsletter, "reader@example.com");
		let body = await response.text();

		expect(response.status).toBe(400);
		expect(body).toContain("Something went wrong");
		expect(body).not.toContain("armed fault");
	});

	test("refuses an address with a zero-width character the parser rejects", async () => {
		let newsletter = new MemoryNewsletter();

		let response = await submit(newsletter, "reader\u200b@example.com");

		expect(response.status).toBe(400);
		expect(await response.text()).toContain("Invalid email address");
		expect(await subscribed(newsletter)).toEqual([]);
	});

	test("refuses a disposable address without unlocking the chapter", async () => {
		let newsletter = new MemoryNewsletter();

		let response = await submit(newsletter, "reader@mailinator.com");
		let body = await response.text();

		expect(response.status).toBe(400);
		expect(body).toContain("Temporary inboxes");
		expect(body).not.toContain(CHAPTER_HEADING);
		expect(await subscribed(newsletter)).toEqual([]);
	});

	test("asks about a mistyped provider, then unlocks the chapter when the address is kept", async () => {
		let newsletter = new MemoryNewsletter();

		let prompt = await submit(newsletter, "reader@gnail.com");
		let body = await prompt.text();

		expect(prompt.status).toBe(400);
		expect(body).toContain("Did you mean reader@gmail.com?");
		expect(body).toContain('name="confirmed" value="reader@gnail.com"');
		expect(await subscribed(newsletter)).toEqual([]);

		let kept = await submit(newsletter, "reader@gnail.com", { confirmed: "reader@gnail.com" });

		expect(kept.status).toBe(200);
		expect(await kept.text()).toContain(CHAPTER_HEADING);
		expect(await subscribed(newsletter)).toEqual(["reader@gnail.com"]);
	});
});
