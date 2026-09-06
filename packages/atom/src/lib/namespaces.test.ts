/**
 * Tests namespace resolution, which is what lets an element be judged by the
 * namespace it belongs to rather than by the prefix a document happened to pick.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import {
	extendNamespaceScope,
	isAtomName,
	namespaceOf,
	readNamespaceDeclarations,
} from "./namespaces.js";

let ATOM = "http://www.w3.org/2005/Atom";

describe("readNamespaceDeclarations", () => {
	test("reads the default declaration under the empty prefix", () => {
		expect(readNamespaceDeclarations({ name: "feed", attributes: { xmlns: ATOM } })).toEqual({
			"": ATOM,
		});
	});

	test("reads prefixed declarations and ignores other attributes", () => {
		expect(
			readNamespaceDeclarations({
				name: "feed",
				attributes: { "xmlns:a": ATOM, "xml:lang": "en" },
			}),
		).toEqual({ a: ATOM });
	});

	test("reports no declarations for an element carrying none", () => {
		expect(readNamespaceDeclarations({ name: "feed" })).toEqual({});
	});
});

describe("extendNamespaceScope", () => {
	test("keeps the same scope when an element declares nothing", () => {
		let scope = { "": ATOM };
		expect(extendNamespaceScope(scope, { name: "entry" })).toBe(scope);
	});

	test("lets a nested element rebind a prefix for its own subtree", () => {
		let scope = extendNamespaceScope(
			{ a: ATOM },
			{ name: "entry", attributes: { "xmlns:a": "http://example.com/other" } },
		);

		expect(scope["a"]).toBe("http://example.com/other");
	});
});

describe("isAtomName", () => {
	test("accepts an unprefixed name under a default Atom binding", () => {
		expect(isAtomName("title", { "": ATOM })).toBe(true);
	});

	test("accepts a prefixed name bound to Atom", () => {
		expect(isAtomName("a:title", { a: ATOM })).toBe(true);
	});

	test("refuses a name whose prefix is bound elsewhere", () => {
		expect(isAtomName("media:rating", { "": ATOM, media: "http://search.yahoo.com/mrss/" })).toBe(
			false,
		);
	});

	test("refuses a name whose prefix is unbound", () => {
		expect(isAtomName("dc:creator", { "": ATOM })).toBe(false);
		expect(namespaceOf("dc:creator", { "": ATOM })).toBeUndefined();
	});
});
