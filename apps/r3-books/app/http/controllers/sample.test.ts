/**
 * Tests for `/sample` — the gated chapter. The gate is the point: a valid address unlocks the
 * chapter, an address already on the list unlocks it too, and a malformed one never reaches
 * the newsletter.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { FakeButtondown } from "~/app/lib/test/buttondown";
import { fetchApp } from "~/app/lib/test/router";
import { Buttondown } from "~/app/services/buttondown";

/** The chapter's first heading, which only the unlocked page renders. */
const CHAPTER_HEADING = "OAuth2 in Simple Terms";

/** Submits the sample form against a scripted newsletter client. */
function submit(buttondown: FakeButtondown, email: string) {
	return fetchApp("/sample", {
		method: "POST",
		body: new URLSearchParams({ email }),
		services: [[Buttondown, buttondown]],
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
		let buttondown = new FakeButtondown();

		let response = await submit(buttondown, "reader@example.com");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain(CHAPTER_HEADING);
		expect(buttondown.subscribed.map((entry) => entry.email)).toEqual(["reader@example.com"]);
	});

	test("renders the chapter for an address already on the list", async () => {
		let buttondown = new FakeButtondown({ subscribed: ["reader@example.com"] });

		let response = await submit(buttondown, "reader@example.com");
		let body = await response.text();

		// Already subscribed is a success here, not an error: the reader asked for a chapter.
		expect(response.status).toBe(200);
		expect(body).toContain(CHAPTER_HEADING);
		expect(buttondown.subscribed).toEqual([]);
	});

	test("renders the chapter when the provider rejects the address as already existing", async () => {
		let buttondown = new FakeButtondown({ failWith: "email_already_exists" });

		let response = await submit(buttondown, "reader@example.com");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain(CHAPTER_HEADING);
	});

	test("renders the chapter's code fences, in every language the chapter uses", async () => {
		let body = await submit(new FakeButtondown(), "reader@example.com").then((response) =>
			response.text(),
		);

		// The parser normalizes each fence's language alias, so the chapter's `js` and `ts`
		// fences render as the Prism identifiers the syntax theme is written against.
		expect(body).toContain('class="language-javascript');
		expect(body).toContain('class="language-typescript');
		expect(body).toContain('class="language-txt');
		// Six fences: three plain text, two TypeScript, one JavaScript.
		expect(body.match(/<pre class="language-/g)).toHaveLength(6);
	});

	test("keeps the chapter out of the index, since the URL's other state is the form", async () => {
		let body = await submit(new FakeButtondown(), "reader@example.com").then((response) =>
			response.text(),
		);

		expect(body).toContain("noindex");
	});

	test("re-renders the form with the error inline for a malformed address", async () => {
		let buttondown = new FakeButtondown();

		let response = await submit(buttondown, "not-an-email");
		let body = await response.text();

		expect(response.status).toBe(400);
		expect(body).toContain("Invalid email address");
		expect(body).toContain("Get a Free Sample");
		expect(body).not.toContain(CHAPTER_HEADING);
		// Validation happens before the newsletter is touched at all.
		expect(buttondown.subscribed).toEqual([]);
	});

	test("shows the provider's blocked rejection as the copy written for a reader", async () => {
		let buttondown = new FakeButtondown({ failWith: "subscriber_blocked" });

		let response = await submit(buttondown, "reader@example.com");
		let body = await response.text();

		expect(response.status).toBe(400);
		expect(body).toContain("blocking you");
		expect(body).not.toContain(CHAPTER_HEADING);
	});

	test("shows a generic message rather than the provider's own error text", async () => {
		let buttondown = new FakeButtondown({ throws: new Error("Buttondown: 503 upstream detail") });

		let response = await submit(buttondown, "reader@example.com");
		let body = await response.text();

		expect(response.status).toBe(400);
		expect(body).toContain("Something went wrong");
		expect(body).not.toContain("upstream detail");
	});
});
