/**
 * Tests for `userAgent()`.
 *
 * The contract is that a handler reads `ctx.userAgent` — or the key, for a
 * handler whose chain is not known — and gets the same shape for every request,
 * including one that sends no header at all.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createRouter, RequestContext } from "remix/router";
import { describe, expect, test } from "vitest";

import type { UserAgent } from "./types.js";

import { CurrentUserAgent, userAgent } from "./middleware.js";

const IPHONE =
	"Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";

/** Runs one request through a router carrying the middleware and answers what the handler saw. */
async function handle(headers?: HeadersInit): Promise<UserAgent> {
	let seen: UserAgent | undefined;

	let router = createRouter({ middleware: [userAgent()] });
	router.get("/", (ctx) => {
		seen = ctx.userAgent;
		return new Response("ok");
	});

	await router.fetch(new Request("https://example.com/", { headers }));

	if (seen === undefined) throw new Error("The handler never ran.");

	return seen;
}

describe(userAgent, () => {
	test("publishes the read header as ctx.userAgent", async () => {
		let agent = await handle({ "User-Agent": IPHONE });

		expect(agent.browser).toEqual({ name: "Safari", version: "17.4" });
		expect(agent.os).toEqual({ name: "iOS", version: "17.4" });
		expect(agent.device).toEqual({ type: "mobile", vendor: "Apple", model: "iPhone" });
	});

	test("reads as the unknown agent when the request sends no header", async () => {
		let agent = await handle();

		expect(agent).toEqual(CurrentUserAgent.defaultValue);
	});

	test("answers the same value through the context key", async () => {
		let seen: UserAgent | undefined;

		let router = createRouter({ middleware: [userAgent()] });
		router.get("/", (ctx) => {
			seen = ctx.get(CurrentUserAgent);
			return new Response("ok");
		});

		await router.fetch(new Request("https://example.com/", { headers: { "User-Agent": IPHONE } }));

		expect(seen?.device.model).toBe("iPhone");
	});

	test("reads the unknown agent on a context the middleware never touched", () => {
		let ctx = new RequestContext(new Request("https://example.com/"));

		expect(ctx.get(CurrentUserAgent)).toEqual({
			browser: { name: null, version: null },
			engine: { name: null, version: null },
			os: { name: null, version: null },
			device: { type: null, vendor: null, model: null },
		});
	});
});
