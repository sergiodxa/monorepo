/**
 * Tests base and language scoping: that a nested base composes with the one above
 * it, that a reference with no base survives untouched, and that an unusable pair
 * yields the original text rather than an invented value.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { extendScope, resolveUri } from "./xml-base.js";

describe("extendScope", () => {
	test("returns the same scope when an element declares neither attribute", () => {
		let scope = { base: "https://example.com/", lang: "en" };
		expect(extendScope(scope, { name: "entry" })).toBe(scope);
	});

	test("composes a relative base with the enclosing one", () => {
		let scope = extendScope(
			{ base: "https://example.com/blog/" },
			{ name: "entry", attributes: { "xml:base": "2026/" } },
		);

		expect(scope.base).toBe("https://example.com/blog/2026/");
	});

	test("replaces the base when the element declares an absolute one", () => {
		let scope = extendScope(
			{ base: "https://example.com/blog/" },
			{ name: "entry", attributes: { "xml:base": "https://elsewhere.test/" } },
		);

		expect(scope.base).toBe("https://elsewhere.test/");
	});

	test("inherits the language until an element overrides it", () => {
		let inherited = extendScope(
			{ lang: "en" },
			{ name: "entry", attributes: { "xml:base": "https://example.com/" } },
		);
		expect(inherited.lang).toBe("en");

		let overridden = extendScope(
			{ lang: "en" },
			{ name: "entry", attributes: { "xml:lang": "es" } },
		);
		expect(overridden.lang).toBe("es");
	});
});

describe("resolveUri", () => {
	test("returns the reference unchanged when no base is in scope", () => {
		expect(resolveUri({}, "/home")).toBe("/home");
	});

	test("resolves a relative reference against the base", () => {
		expect(resolveUri({ base: "https://example.com/a/b" }, "c.html")).toBe(
			"https://example.com/a/c.html",
		);
	});

	test("leaves an absolute reference alone", () => {
		expect(resolveUri({ base: "https://example.com/" }, "https://other.test/x")).toBe(
			"https://other.test/x",
		);
	});

	test("returns the reference when the pair cannot form a URL", () => {
		expect(resolveUri({ base: "not a url" }, "also relative")).toBe("also relative");
	});
});
