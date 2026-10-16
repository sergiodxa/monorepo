/**
 * Tests the spam middleware through a router: it reads the submission from the form, the
 * request and the honeypot's render time, refuses a spam verdict before the handler, and
 * publishes the assessment for every other one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import getClientIP from "@sdxc/get-client-ip/middleware";
import { Honeypot } from "@sdxc/honeypot";
import { honeypot } from "@sdxc/honeypot/middleware";
import { unwrap } from "@sdxc/result";
import { userAgent } from "@sdxc/user-agent/middleware";
import { formData } from "remix/middleware/form-data";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import type { SpamFilter } from "./filter.js";

import { createSpamFilter } from "./filter.js";
import { MemoryCheck } from "./memory.js";
import { spam } from "./middleware.js";

/** A POST of `fields` as a URL-encoded form, with `headers` added. */
function post(fields: Record<string, string>, headers: Record<string, string> = {}): RequestInit {
	return {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded", ...headers },
		body: new URLSearchParams(fields).toString(),
	};
}

describe("spam", () => {
	test("scores the named fields, ctx.ip and ctx.userAgent", async () => {
		let check = new MemoryCheck({ stage: "local" });
		let router = createRouter({ middleware: [getClientIP(), userAgent()] });
		router.post("/contact", {
			middleware: [
				spam(createSpamFilter({ checks: [check] }), {
					fields: { content: "message", name: "name", email: "email" },
					format: "markdown",
					languages: ["en"],
				}),
			],
			handler: () => new Response("saved"),
		});

		await router.fetch(
			"https://example.com/contact",
			post(
				{ message: "hello", name: "Ada", email: "ada@example.com" },
				{ "CF-Connecting-IP": "203.0.113.7", "User-Agent": "Browser/1.0" },
			),
		);

		expect(check.last).toEqual({
			content: "hello",
			format: "markdown",
			languages: ["en"],
			renderedAt: undefined,
			author: {
				name: "Ada",
				email: "ada@example.com",
				url: undefined,
				ip: "203.0.113.7",
				userAgent: "Browser/1.0",
			},
		});
	});

	test("joins several content fields into one text", async () => {
		let check = new MemoryCheck({ stage: "local" });
		let router = createRouter({ middleware: [formData()] });
		router.post("/contact", {
			middleware: [
				spam(createSpamFilter({ checks: [check] }), {
					fields: { content: ["subject", "body", "missing"] },
				}),
			],
			handler: () => new Response("saved"),
		});

		await router.fetch("https://example.com/contact", post({ subject: "Hi", body: "there" }));

		expect(check.last?.content).toBe("Hi\nthere\n");
	});

	test("leaves the address and User-Agent out without their middleware", async () => {
		let check = new MemoryCheck({ stage: "local" });
		let router = createRouter();
		router.post("/contact", {
			middleware: [spam(createSpamFilter({ checks: [check] }), { fields: { content: "message" } })],
			handler: () => new Response("saved"),
		});

		await router.fetch(
			"https://example.com/contact",
			post(
				{ message: "hello" },
				{ "CF-Connecting-IP": "203.0.113.7", "User-Agent": "Browser/1.0" },
			),
		);

		expect(check.last?.author).toMatchObject({ ip: undefined, userAgent: undefined });
	});

	test("passes the render time the honeypot verified", async () => {
		let trap = new Honeypot({ secret: "s3cret" });
		let check = new MemoryCheck({ stage: "local" });
		let router = createRouter();
		router.post("/contact", {
			middleware: [
				honeypot(trap),
				spam(createSpamFilter({ checks: [check] }), { fields: { content: "m" } }),
			],
			handler: () => new Response("saved"),
		});
		let fields = unwrap(await trap.issue({ now: new Date("2026-10-16T00:00:00Z") }));

		await router.fetch(
			"https://example.com/contact",
			post({ [fields.tokenField]: fields.token, m: "hello" }),
		);

		expect(check.last?.renderedAt).toEqual(new Date("2026-10-16T00:00:00Z"));
	});

	test("refuses spam with a 422 before the handler", async () => {
		let reached = false;
		let filter = createSpamFilter({
			checks: [new MemoryCheck({ stage: "local", signals: [{ check: "test", score: 10 }] })],
		});
		let router = createRouter();
		router.post("/contact", {
			middleware: [spam(filter, { fields: { content: "message" } })],
			handler() {
				reached = true;
				return new Response("saved");
			},
		});

		let response = await router.fetch("https://example.com/contact", post({ message: "buy" }));

		expect(response.status).toBe(422);
		expect(reached).toBe(false);
	});

	test("hands spam to the handler when onSpam answers null", async () => {
		let seen: SpamFilter.Assessment | undefined;
		let filter = createSpamFilter({
			checks: [new MemoryCheck({ stage: "local", signals: [{ check: "test", score: 10 }] })],
		});
		let router = createRouter();
		router.post("/contact", {
			middleware: [spam(filter, { fields: { content: "message" }, onSpam: () => null })],
			handler(ctx) {
				seen = ctx.spamAssessment;
				return new Response("received");
			},
		});

		let response = await router.fetch("https://example.com/contact", post({ message: "buy" }));

		expect(response.status).toBe(200);
		expect(seen?.verdict).toBe("spam");
	});

	test("publishes an unsure verdict and leaves the body readable", async () => {
		let seen: SpamFilter.Assessment | undefined;
		let body: FormDataEntryValue | null = null;
		let filter = createSpamFilter({
			checks: [new MemoryCheck({ stage: "local", signals: [{ check: "test", score: 6 }] })],
		});
		let router = createRouter();
		router.post("/contact", {
			middleware: [spam(filter, { fields: { content: "message" } })],
			async handler(ctx) {
				seen = ctx.spamAssessment;
				body = (await ctx.request.formData()).get("message");
				return new Response("held");
			},
		});

		await router.fetch("https://example.com/contact", post({ message: "hello" }));

		expect(seen?.verdict).toBe("unsure");
		expect(body).toBe("hello");
	});

	test("scores a body that is not a form as empty content", async () => {
		let check = new MemoryCheck({ stage: "local" });
		let router = createRouter();
		router.post("/contact", {
			middleware: [spam(createSpamFilter({ checks: [check] }), { fields: { content: "message" } })],
			handler: () => new Response("saved"),
		});

		await router.fetch("https://example.com/contact", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ message: "hello" }),
		});

		expect(check.last?.content).toBe("");
	});

	test("lets a GET through unscored", async () => {
		let check = new MemoryCheck({ stage: "local" });
		let router = createRouter();
		router.get("/contact", {
			middleware: [spam(createSpamFilter({ checks: [check] }), { fields: { content: "message" } })],
			handler: () => new Response("form"),
		});

		let response = await router.fetch("https://example.com/contact");

		expect(response.status).toBe(200);
		expect(check.calls).toHaveLength(0);
	});
});
