/**
 * The `UriTemplate` API beyond expansion: its parts and variable names, and matching, both
 * on hand-picked URIs and as the inverse of every expansion in the uritemplate-test suite.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { Variables } from "./expand.js";

import { UriTemplate } from "./uri-template.js";

/** A parsed template, failing the test when it does not parse. */
function template(source: string): UriTemplate {
	return unwrap(UriTemplate.parse(source));
}

/** Every successful expansion in the suite, as template and URI. */
const EXPANSIONS = [
	"spec-examples.json",
	"spec-examples-by-section.json",
	"extended-tests.json",
].flatMap((file) =>
	Object.values(
		JSON.parse(
			readFileSync(join(import.meta.dirname, "fixtures/uritemplate-test", file), "utf8"),
		) as Record<string, { variables: Variables; testcases: [string, unknown][] }>,
	).flatMap(({ variables, testcases }) =>
		testcases
			.filter(([, expected]) => expected !== false)
			.map(([source]) => ({ source, uri: unwrap(template(source).expand(variables)) })),
	),
);

describe("UriTemplate", () => {
	test("exposes its parts, variable names and source", () => {
		let parsed = template("/users/{id}{?fields*,id}");
		expect(parsed.parts).toEqual([
			"/users/",
			{ operator: "", variables: [{ name: "id", prefix: null, explode: false }], offset: 7 },
			{
				operator: "?",
				variables: [
					{ name: "fields", prefix: null, explode: true },
					{ name: "id", prefix: null, explode: false },
				],
				offset: 11,
			},
		]);
		expect(parsed.variableNames).toEqual(["id", "fields"]);
		expect(String(parsed)).toBe("/users/{id}{?fields*,id}");
		expect(JSON.stringify({ href: parsed })).toBe('{"href":"/users/{id}{?fields*,id}"}');
	});

	test("percent-encodes non-ASCII literal text", () => {
		expect(unwrap(template("/café/{x}").expand({ x: "1" }))).toBe("/caf%C3%A9/1");
	});

	test("reports where a template is invalid", () => {
		let result = UriTemplate.parse("/a/{b");
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.offset).toBe(3);
	});

	test("refuses a prefix on a list at expansion, pointing at the expression", () => {
		let result = template("x{list:2}").expand({ list: ["a"] });
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.offset).toBe(1);
	});
});

describe("match", () => {
	test.each([
		["file:///{+path}", "file:///docs/a%20b.txt", { path: "docs/a b.txt" }],
		["users://{id}/profile", "users://42/profile", { id: "42" }],
		["/search{?q,page}", "/search?page=2&q=a%20b", { q: "a b", page: "2" }],
		["/search{?q,page}", "/search", {}],
		["{/segments*}", "/a/b/c", { segments: ["a", "b", "c"] }],
		["/list/{items}", "/list/x,y", { items: ["x", "y"] }],
		["{?filters*}", "?state=open&label=bug", { filters: { state: "open", label: "bug" } }],
		["{?tags*}", "?tags=a&tags=b", { tags: ["a", "b"] }],
		["/items{?page}{&size}", "/items?page=1&size=20", { page: "1", size: "20" }],
		["/items{?page}{&size}", "/items&size=20", { size: "20" }],
	])("matches %s against %s", (source, uri, expected) => {
		expect(unwrap(template(source).match(uri))).toEqual(expected);
	});

	test.each([
		["users://{id}/profile", "users://42/settings"],
		["/user/{id}", "/user/a/b"],
		["/search{?q}", "/search?q=x&other=1"],
		["/x/{id}", "/x/%FF"],
	])("does not match %s against %s", (source, uri) => {
		expect(unwrap(template(source).match(uri))).toBeNull();
	});

	test("keeps reserved octets encoded in a reserved expansion", () => {
		expect(unwrap(template("{+id}").match("admin%2Fx%20y"))).toEqual({ id: "admin%2Fx y" });
	});

	test("fails for a template whose adjacent expressions have no boundary", () => {
		let result = template("{a}{b}").match("xy");
		expect(isFailure(result)).toBe(true);
	});

	test.each(EXPANSIONS)("inverts the expansion of $source", ({ source, uri }) => {
		let parsed = template(source);
		let matched = parsed.match(uri);
		if (isFailure(matched)) return;
		expect(matched.data).not.toBeNull();
		expect(unwrap(parsed.expand(matched.data ?? {}))).toBe(uri);
	});
});
