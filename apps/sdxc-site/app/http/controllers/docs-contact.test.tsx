/**
 * Tests the docs contact form through the site's router: the page keeps the same-site page the
 * reader came from, a valid question emails the inbox with the reader as reply-to, an invalid
 * one comes back with its errors, and a filled trap is thanked without sending anything.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Honeypot } from "@sdxc/honeypot";

import { MemoryTransport } from "@sdxc/mail/memory";
import { failure, unwrap } from "@sdxc/result";
import { beforeEach, describe, expect, test, vi } from "vitest";

/** Every delivery the form makes, cleared before each test. */
let transport = new MemoryTransport();

vi.doMock("~/app/initializers/mail-transport", () => ({ transport }));

let { fetchApp } = await import("~/app/test/router");
let { honeypot } = await import("~/app/initializers/honeypot");
let { default: routes } = await import("~/routes/web");

/** Posts the form with fresh honeypot fields, the trap set to `trap`. */
async function submit(fields: Record<string, string>, trap = "") {
	let issued: Honeypot.Fields = unwrap(await honeypot.issue({ now: new Date(Date.now() - 5000) }));
	return fetchApp(routes.docs.contact.action.href(), {
		method: "POST",
		body: new URLSearchParams({
			[issued.tokenField]: issued.token,
			[issued.trapField]: trap,
			...fields,
		}),
	});
}

beforeEach(() => {
	transport.clear();
});

describe("GET /docs/contact", () => {
	test("renders the form, carrying the page the reader came from", async () => {
		let response = await fetchApp("/docs/contact?page=%2Fdocs%2Fsdxc%2Fdeploy");

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain('action="/docs/contact"');
		expect(body).toContain('name="email"');
		expect(body).toContain('name="message"');
		expect(body).toContain(`name="${honeypot.tokenField}"`);
		expect(body).toContain('value="/docs/sdxc/deploy"');
		expect(body).toContain('content="noindex, follow"');
	});

	test("is answered by the contact route, not read as a guide's slug", async () => {
		let response = await fetchApp("/docs/contact");

		expect(response.status).toBe(200);
		expect(await response.text()).not.toContain("Page not found");
	});

	test("drops a page on another site", async () => {
		let body = await (await fetchApp("/docs/contact?page=https%3A%2F%2Fevil.com%2Fx")).text();

		expect(body).not.toContain("evil.com");
	});

	test("thanks the reader after a sent question", async () => {
		let body = await (await fetchApp("/docs/contact?sent=1&page=%2Fdocs")).text();

		expect(body).toContain("Thanks, your message is on its way");
		expect(body).not.toContain('action="/docs/contact"');
	});
});

describe("a guide's feedback block", () => {
	test("links to the contact form naming the guide", async () => {
		let body = await (await fetchApp("/docs/getting-started/what-these-are")).text();

		expect(body).toContain('href="/docs/contact?page=%2Fdocs%2Fgetting-started%2Fwhat-these-are"');
	});
});

describe("POST /docs/contact", () => {
	test("emails the inbox with the reader as reply-to and redirects to the thank-you", async () => {
		let response = await submit({
			name: "Ada",
			email: "ada@example.com",
			message: "How do I run a migration before the deploy?",
			page: "/docs/sdxc/deploy",
		});

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(
			"/docs/contact?sent=1&page=%2Fdocs%2Fsdxc%2Fdeploy",
		);
		expect(transport.messages).toHaveLength(1);
		let [message] = transport.messages;
		expect(message?.from).toEqual({ email: "no-reply@sdxc.dev", name: "sdxc" });
		expect(message?.to).toEqual([{ email: "hello+sdxc@sergiodxa.com" }]);
		expect(message?.replyTo).toEqual([{ email: "ada@example.com", name: "Ada" }]);
		expect(message?.subject).toBe("[sdxc docs] Question from Ada");
		expect(message?.text).toContain("https://sdxc.dev/docs/sdxc/deploy");
		expect(message?.text).toContain("How do I run a migration before the deploy?");
	});

	test("drops a page on another site from the email and the redirect", async () => {
		let response = await submit({
			email: "ada@example.com",
			message: "Hi",
			page: "https://evil.com/phish",
		});

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe("/docs/contact?sent=1");
		expect(transport.messages[0]?.text).not.toContain("evil.com");
	});

	test("brings an invalid form back with its errors and values, sending nothing", async () => {
		let response = await submit({ name: "Ada", email: "ada", message: "" });

		expect(response.status).toBe(400);
		let body = await response.text();
		expect(body).toContain("Enter the email address the reply should go to.");
		expect(body).toContain("Write your question before sending.");
		expect(body).toContain('value="Ada"');
		expect(body).toContain('value="ada"');
		expect(transport.messages).toHaveLength(0);
	});

	test("thanks a filled trap without sending anything", async () => {
		let response = await submit({ email: "bot@example.com", message: "spam" }, "filled");

		expect(response.status).toBe(303);
		expect(transport.messages).toHaveLength(0);
	});

	test("refuses a submission without the honeypot token", async () => {
		let response = await fetchApp(routes.docs.contact.action.href(), {
			method: "POST",
			body: new URLSearchParams({ email: "bot@example.com", message: "spam" }),
		});

		expect(response.status).toBe(303);
		expect(transport.messages).toHaveLength(0);
	});

	test("keeps the reader's words and names the inbox when sending fails", async () => {
		let send = vi
			.spyOn(transport, "send")
			.mockResolvedValueOnce(failure(new Error("binding refused")) as never);

		let response = await submit({ email: "ada@example.com", message: "Still stuck" });

		expect(response.status).toBe(502);
		let body = await response.text();
		expect(body).toContain("hello+sdxc@sergiodxa.com");
		expect(body).toContain("Still stuck");
		send.mockRestore();
	});
});
