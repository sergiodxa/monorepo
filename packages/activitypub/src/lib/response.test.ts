/**
 * Content negotiation between HTML and ActivityStreams, and the headers, statuses and
 * revalidation `respond` answers a document with.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { ACTIVITY_ACCEPT } from "./constants.js";
import { parseObject } from "./parse.js";
import { respond, wantsActivity } from "./response.js";
import { tombstone } from "./tombstone.js";

/** The URL every request here asks for. */
const URL = "https://letters.blog/articles/remix-v3";

/** The document every response here serves. */
const ARTICLE = { id: URL, type: "Article", name: "Remix v3" };

/**
 * A GET with the given `Accept`, or none.
 *
 * @param accept - The header value.
 */
function get(accept?: string): Request {
	return new Request(URL, { headers: accept === undefined ? {} : { Accept: accept } });
}

describe("wantsActivity", () => {
	test.each([
		["Mastodon's Accept", ACTIVITY_ACCEPT, true],
		["activity+json alone", "application/activity+json", true],
		[
			"ld+json with the AS2 profile",
			'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
			true,
		],
		["AS2 preferred over HTML by quality", "text/html;q=0.1, application/activity+json", true],
		["a browser", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", false],
		["a wildcard", "*/*", false],
		["no Accept", undefined, false],
		["HTML first", "text/html, application/activity+json", false],
		["plain JSON", "application/json", false],
	])("%s → %s", (_label, accept, expected) => {
		expect(wantsActivity(get(accept))).toBe(expected);
	});
});

describe("respond", () => {
	test("answers the AS2 media type, a 5-minute public policy and an ETag", async () => {
		let response = await respond(ARTICLE);
		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("application/activity+json; charset=utf-8");
		expect(response.headers.get("Cache-Control")).toBe("public, max-age=300");
		expect(response.headers.get("ETag")).toMatch(/^"[\w-]+"$/);
		expect(response.headers.get("Vary")).toBeNull();
		let body = await response.json();
		expect(parseObject(body)).toMatchObject({ status: "success", data: { name: "Remix v3" } });
	});

	test("adds Vary: Accept when asked, and applies extra headers last", async () => {
		let response = await respond(ARTICLE, {
			vary: true,
			cache: { visibility: "public", maxAge: "1 hour" },
			headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" },
		});
		expect(response.headers.get("Vary")).toBe("accept");
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
	});

	test("answers 304 to a client whose copy is current, keeping Vary", async () => {
		let first = await respond(ARTICLE, { request: get(ACTIVITY_ACCEPT), vary: true });
		let tag = first.headers.get("ETag") ?? "";
		let request = new Request(URL, { headers: { Accept: ACTIVITY_ACCEPT, "If-None-Match": tag } });
		let second = await respond(ARTICLE, { request, vary: true });
		expect(second.status).toBe(304);
		expect(second.headers.get("Vary")).toBe("accept");
		expect(await second.text()).toBe("");
	});

	test("answers HEAD without a body", async () => {
		let response = await respond(ARTICLE, { request: new Request(URL, { method: "HEAD" }) });
		expect(response.status).toBe(200);
		expect(await response.text()).toBe("");
	});

	test("answers 410 for a Tombstone, even when the client's copy matches", async () => {
		let deleted = tombstone({ id: URL, formerType: "Article" });
		let first = await respond(deleted);
		expect(first.status).toBe(410);
		let request = new Request(URL, {
			headers: { "If-None-Match": first.headers.get("ETag") ?? "" },
		});
		expect((await respond(deleted, { request })).status).toBe(410);
	});

	test("uses the status the caller states", async () => {
		expect((await respond(ARTICLE, { status: 202 })).status).toBe(202);
	});
});
