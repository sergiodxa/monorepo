/**
 * Tests the honeypot middleware through a router: it refuses bot submissions before the handler,
 * publishes the verification for accepted ones, reuses a parsed form, and leaves the body readable.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { formData } from "remix/middleware/form-data";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import type { HoneypotOutcome } from "./middleware.js";

import { honeypot } from "./middleware.js";

import { Honeypot } from "./index.js";

/** The honeypot every route here is guarded by. */
const HONEYPOT = new Honeypot({ secret: "s3cret" });

/** A POST of `fields` as a URL-encoded form. */
function post(fields: Record<string, string>): RequestInit {
	return {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams(fields).toString(),
	};
}

/** A form entry's text, or `undefined` for a file or a missing field. */
function textOf(value: FormDataEntryValue | null): string | undefined {
	return typeof value === "string" ? value : undefined;
}

/** A form body with freshly issued fields, the trap set to `trapValue`. */
async function issuedForm(trapValue = ""): Promise<Record<string, string>> {
	let fields = unwrap(await HONEYPOT.issue());
	return { [fields.tokenField]: fields.token, [fields.trapField]: trapValue, content: "hello" };
}

describe("honeypot", () => {
	test("passes an untouched form to the handler with its render time", async () => {
		let seen: HoneypotOutcome | undefined;
		let body: string | undefined;
		let router = createRouter();
		router.post("/comments", {
			middleware: [honeypot(HONEYPOT)],
			async handler(ctx) {
				seen = ctx.honeypot;
				body = textOf((await ctx.request.formData()).get("content"));
				return new Response("saved");
			},
		});

		let response = await router.fetch("https://example.com/comments", post(await issuedForm()));

		expect(response.status).toBe(200);
		expect(seen !== undefined && isSuccess(seen) && seen.data.renderedAt).toBeInstanceOf(Date);
		expect(body).toBe("hello");
	});

	test("refuses a filled trap with a 400 before the handler", async () => {
		let reached = false;
		let router = createRouter();
		router.post("/comments", {
			middleware: [honeypot(HONEYPOT)],
			handler() {
				reached = true;
				return new Response("saved");
			},
		});

		let response = await router.fetch(
			"https://example.com/comments",
			post(await issuedForm("https://seo.example")),
		);

		expect(response.status).toBe(400);
		expect(reached).toBe(false);
	});

	test("refuses a body that is not a form as missing-token", async () => {
		let codes: string[] = [];
		let router = createRouter();
		router.post("/comments", {
			middleware: [
				honeypot(HONEYPOT, {
					onFailure: (error) => {
						codes.push(error.code);
						return new Response(null, { status: 422 });
					},
				}),
			],
			handler: () => new Response("saved"),
		});

		let response = await router.fetch("https://example.com/comments", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ content: "hello" }),
		});

		expect(response.status).toBe(422);
		expect(codes).toEqual(["missing-token"]);
	});

	test("continues with the failure published when onFailure answers null", async () => {
		let seen: HoneypotOutcome | undefined;
		let router = createRouter();
		router.post("/comments", {
			middleware: [honeypot(HONEYPOT, { onFailure: () => null })],
			handler(ctx) {
				seen = ctx.honeypot;
				return new Response("received");
			},
		});

		let response = await router.fetch("https://example.com/comments", post({ content: "hello" }));

		expect(response.status).toBe(200);
		expect(seen !== undefined && isFailure(seen) && seen.error.code).toBe("missing-token");
	});

	test("reuses the form parsed by formData()", async () => {
		let router = createRouter({ middleware: [formData()] });
		router.post("/comments", {
			middleware: [honeypot(HONEYPOT)],
			handler: (ctx) => new Response(textOf(ctx.get(FormData).get("content"))),
		});

		let response = await router.fetch("https://example.com/comments", post(await issuedForm()));

		expect(await response.text()).toBe("hello");
	});
});
