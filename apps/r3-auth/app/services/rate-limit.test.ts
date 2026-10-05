/**
 * Tests the address budget key through a router running the client-address
 * middleware: an IPv4 client keeps its own key, an IPv6 client shares its `/64`,
 * and a missing or malformed `CF-Connecting-IP` falls into the shared budget.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import getClientIP from "@sdxc/get-client-ip/middleware";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import { clientAddressKey } from "~/app/services/rate-limit";

/** Runs one request through the middleware and answers the key its handler computed. */
async function keyFor(header?: string): Promise<string> {
	let key: string | null = null;

	let router = createRouter({ middleware: [getClientIP()] });
	router.get("/", (ctx) => {
		key = clientAddressKey(ctx);
		return new Response("ok");
	});

	let headers = new Headers();
	if (header !== undefined) headers.set("CF-Connecting-IP", header);
	await router.fetch(new Request("https://example.com/", { headers }));

	if (key === null) throw new Error("The handler never ran.");

	return key;
}

describe("clientAddressKey", () => {
	test("keys an IPv4 client by its own address", async () => {
		expect(await keyFor("203.0.113.7")).toBe("203.0.113.7/32");
	});

	test("keys every IPv6 address in one /64 alike", async () => {
		let first = await keyFor("2001:db8:1:2::1");
		let second = await keyFor("2001:db8:1:2:ffff::9");

		expect(first).toBe("2001:db8:1:2::/64");
		expect(second).toBe(first);
	});

	test("puts a request without the header in the shared budget", async () => {
		expect(await keyFor()).toBe("unknown");
	});

	test("puts a malformed header in the shared budget", async () => {
		expect(await keyFor("not-an-address")).toBe("unknown");
	});
});
