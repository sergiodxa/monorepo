/**
 * Exercises `parseQuery` on the GET requests of the Micropub W3C Recommendation's
 * querying section and the `q=category` extension, including an endpoint URL that
 * carries its own query string, which clients must append to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { Micropub } from "./index.js";

import { MicropubRequestError, parseQuery } from "./index.js";

/** A GET for `search` at the endpoint, authorized in the header unless `token` is `null`. */
function get(search: string, token: string | null = "xxxxxxxxx"): Request {
	let headers = new Headers({ Accept: "application/json" });
	if (token !== null) headers.set("Authorization", `Bearer ${token}`);
	return new Request(`https://aaronpk.example/micropub?${search}`, { headers });
}

/** The parsed query, failing the test when parsing fails. */
function query(request: Request): Micropub.Query {
	return unwrap(parseQuery(request)).body;
}

describe(parseQuery, () => {
	test("Example 20: q=config", () => {
		expect(query(get("q=config"))).toEqual({ q: "config" });
	});

	test("Example 24: q=syndicate-to", () => {
		expect(query(get("q=syndicate-to"))).toEqual({ q: "syndicate-to" });
	});

	test("Example 21: q=source with bracketed properties", () => {
		expect(
			query(
				get(
					"q=source&properties[]=published&properties[]=category&url=https://aaronpk.example/post/1000",
				),
			),
		).toEqual({
			q: "source",
			url: "https://aaronpk.example/post/1000",
			properties: ["published", "category"],
		});
	});

	test("Example 22: q=source without properties asks for everything", () => {
		expect(query(get("q=source&url=https://aaronpk.example/post/1000"))).toEqual({
			q: "source",
			url: "https://aaronpk.example/post/1000",
			properties: [],
		});
	});

	test("Example 23: a single unbracketed property", () => {
		expect(
			query(get("q=source&properties=content&url=https://aaronpk.example/post/1000")),
		).toMatchObject({ properties: ["content"] });
	});

	test("q=category with and without a filter", () => {
		expect(query(get("q=category"))).toEqual({ q: "category", filter: null });
		expect(query(get("q=category&filter=indie"))).toEqual({ q: "category", filter: "indie" });
	});

	test("passes any other q through as an extension with its parameters", () => {
		let parsed = query(get("q=channel&limit=5"));

		expect(parsed.q).toBe("extension");
		if (parsed.q !== "extension") return;
		expect(parsed.name).toBe("channel");
		expect(parsed.params.get("limit")).toBe("5");
	});

	test("reads q after the endpoint's own query string", () => {
		let request = new Request("https://aaronpk.example/?micropub=endpoint&q=config");

		expect(query(request)).toEqual({ q: "config" });
	});

	test("returns the header token", () => {
		expect(unwrap(parseQuery(get("q=config", "abc"))).accessToken).toBe("abc");
		expect(unwrap(parseQuery(get("q=config", null))).accessToken).toBeNull();
	});

	test.each([
		["no q", "url=https://aaronpk.example/post/1000"],
		["an empty q", "q="],
		["a source query without url", "q=source"],
		["a source query with a relative url", "q=source&url=/post/1000"],
	])("rejects %s", (_, search) => {
		let result = parseQuery(get(search));

		expect(isFailure(result) && result.error).toBeInstanceOf(MicropubRequestError);
	});
});
