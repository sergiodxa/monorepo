/**
 * Tests the WebFinger endpoint through the real route table: the answers RFC 7033 asks
 * for a missing and an unknown resource, `rel` selection, and the CORS header every
 * answer carries so a browser-based fediverse client can read it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { parse } from "@sdxc/well-known/webfinger";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import type { AppContext } from "~/app/http/context";

import { PROFILE } from "~/config/profile";
import routes from "~/routes/web";

import wellKnown from "./well-known";

/** Sends one WebFinger lookup with the given query string through the controller. */
async function lookup(query: string, init?: RequestInit): Promise<Response> {
	let router = createRouter<AppContext>();
	router.map(routes.wellKnown, wellKnown);
	return await router.fetch(
		new Request(`https://sergiodxa.com/.well-known/webfinger${query}`, init),
	);
}

/** The lookup for the site's own account, with any extra parameters appended. */
function forAccount(extra = ""): string {
	return `?resource=${encodeURIComponent(PROFILE.canonical.resource)}${extra}`;
}

describe("GET /.well-known/webfinger", () => {
	test("answers a missing resource with a 400", async () => {
		let response = await lookup("");

		expect(response.status).toBe(400);
		expect(await response.json()).toHaveProperty("error");
	});

	test("answers someone else's resource with a 404", async () => {
		let response = await lookup("?resource=acct%3Asomeone%40example.com");

		expect(response.status).toBe(404);
	});

	test("serves the JRD for the site's account", async () => {
		let response = await lookup(forAccount());

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("application/jrd+json");

		let document = parse(await response.text());
		expect(document.status).toBe("success");
		if (document.status !== "success") return;
		expect(document.data.subject).toBe(PROFILE.canonical.resource);
		expect(document.data.links.map((link) => link.rel)).toContain("me");
	});

	test("resolves the homepage URL to the same account", async () => {
		let response = await lookup(`?resource=${encodeURIComponent(PROFILE.canonical.origin)}`);
		let document = parse(await response.text());

		expect(document.status === "success" && document.data.subject).toBe(PROFILE.canonical.resource);
	});

	test("keeps only the links a rel parameter asks for", async () => {
		let response = await lookup(
			forAccount(
				`&rel=${encodeURIComponent("http://webfinger.net/rel/avatar")}&rel=${encodeURIComponent("self")}`,
			),
		);
		let document = parse(await response.text());

		expect(document.status).toBe("success");
		if (document.status !== "success") return;
		expect(document.data.links.map((link) => link.rel)).toEqual([
			"self",
			"http://webfinger.net/rel/avatar",
		]);
		expect(document.data.properties["http://schema.org/name"]).toBe(PROFILE.name);
	});

	/**
	 * Regression: the document went out without `Access-Control-Allow-Origin`, which RFC 7033
	 * §5 requires, so a lookup from a browser could not read it.
	 */
	test.each([
		["a found account", forAccount()],
		["a missing resource", ""],
		["an unknown resource", "?resource=acct%3Asomeone%40example.com"],
	])("allows any origin for %s", async (_label, query) => {
		let response = await lookup(query, { headers: { Origin: "https://client.example" } });

		expect(response.headers.get("access-control-allow-origin")).toBe("*");
	});
});
