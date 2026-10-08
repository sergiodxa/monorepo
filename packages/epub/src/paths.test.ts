/**
 * Checks how references resolve against the document holding them and how the package
 * writes relative links, which every reference and stylesheet check builds on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { isRemote, mediaTypeOf, pathProblem, relativePath, resolveReference } from "./paths.js";

describe("resolveReference", () => {
	test.each([
		["text/a.xhtml", "../images/x.png", { path: "images/x.png", fragment: undefined }],
		["text/a.xhtml", "b.xhtml#top", { path: "text/b.xhtml", fragment: "top" }],
		["text/a.xhtml", "#top", { fragment: "top" }],
		["text/a.xhtml", "./b.xhtml?x=1", { path: "text/b.xhtml", fragment: undefined }],
		["text/a.xhtml", "my%20file.png", { path: "text/my file.png", fragment: undefined }],
		["styles/a.css", "../fonts/a.woff2", { path: "fonts/a.woff2", fragment: undefined }],
	])("resolves %j + %j", (from, reference, expected) => {
		expect(resolveReference(from, reference)).toEqual(expected);
	});

	test.each([["/images/x.png"], ["../../x.png"], ["%E0%A4%A.png"]])("refuses %j", (reference) => {
		expect(resolveReference("text/a.xhtml", reference)).toBeUndefined();
	});
});

describe("relativePath", () => {
	test.each([
		["text/a.xhtml", "styles/book.css", "../styles/book.css"],
		["text/a.xhtml", "text/b.xhtml", "b.xhtml"],
		["cover.xhtml", "images/cover.png", "images/cover.png"],
		["text/a.xhtml", "book.css", "../book.css"],
	])("from %j to %j is %j", (from, to, expected) => {
		expect(relativePath(from, to)).toBe(expected);
	});
});

describe("the remaining rules", () => {
	test("recognises schemes and network paths as remote", () => {
		expect(isRemote("https://example.com/a.png")).toBe(true);
		expect(isRemote("//example.com/a.png")).toBe(true);
		expect(isRemote("mailto:a@example.com")).toBe(true);
		expect(isRemote("../images/a.png")).toBe(false);
	});

	test("maps extensions to core media types, ignoring case", () => {
		expect(mediaTypeOf("images/A.JPG")).toBe("image/jpeg");
		expect(mediaTypeOf("fonts/a.woff2")).toBe("font/woff2");
		expect(mediaTypeOf("a.txt")).toBeUndefined();
		expect(mediaTypeOf("README")).toBeUndefined();
	});

	test("accepts portable relative paths only", () => {
		expect(pathProblem("images/cover-1_a.png")).toBeUndefined();
		expect(pathProblem("images/.hidden")).toBeDefined();
		expect(pathProblem("a b.png")).toBeDefined();
	});
});
