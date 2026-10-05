/**
 * Tests the middleware: `ctx.ip` holds the parsed header, the context key reads the
 * same value, and a missing or malformed header, or a context the middleware never
 * ran on, reads `null`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { IP } from "@sdxc/ip";

import { createRouter, RequestContext } from "remix/router";
import { describe, expect, test } from "vitest";

import getClientIP, { ClientIP } from "./middleware.js";

/** Runs one request through a router carrying the middleware and answers what the handler saw. */
async function handle(header?: string): Promise<IP | null> {
	let seen: IP | null | undefined;

	let router = createRouter({ middleware: [getClientIP()] });
	router.get("/", (ctx) => {
		seen = ctx.ip;
		return new Response("ok");
	});

	let headers = new Headers();
	if (header !== undefined) headers.set("CF-Connecting-IP", header);
	await router.fetch(new Request("https://example.com/", { headers }));

	if (seen === undefined) throw new Error("The handler never ran.");

	return seen;
}

describe("getClientIP middleware", () => {
	test("publishes an IPv4 header as ctx.ip", async () => {
		let ip = await handle("203.0.113.42");

		expect(ip?.toString()).toBe("203.0.113.42");
	});

	test("publishes an IPv6 header as ctx.ip", async () => {
		let ip = await handle("2001:DB8::1");

		expect(ip?.version).toBe(6);
		expect(ip?.toString()).toBe("2001:db8::1");
	});

	test("reads null when the header is missing", async () => {
		expect(await handle()).toBeNull();
	});

	test("reads null when the header is malformed", async () => {
		expect(await handle("not-an-address")).toBeNull();
	});

	test("answers the same value through the context key", async () => {
		let seen: IP | null = null;

		let router = createRouter({ middleware: [getClientIP()] });
		router.get("/", (ctx) => {
			seen = ctx.get(ClientIP);
			return new Response("ok");
		});

		await router.fetch(
			new Request("https://example.com/", { headers: { "CF-Connecting-IP": "198.51.100.7" } }),
		);

		expect(String(seen)).toBe("198.51.100.7");
	});

	test("reads null on a context the middleware never touched", () => {
		let ctx = new RequestContext(new Request("https://example.com/"));

		expect(ctx.get(ClientIP)).toBeNull();
	});
});
