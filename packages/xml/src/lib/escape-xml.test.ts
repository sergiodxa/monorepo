/**
 * Tests the escaping applied to XML text nodes and attribute values, pinning the
 * exact entities the serializer emits so output stays stable across round trips.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { escapeAttribute, escapeText } from "./escape-xml";

describe("escapeText", () => {
	test("escapes the markup delimiters", () => {
		expect(escapeText("a & b < c > d")).toBe("a &amp; b &lt; c &gt; d");
	});

	test("escapes a raw CDATA terminator", () => {
		expect(escapeText("a]]>b")).toBe("a]]&gt;b");
	});

	test("leaves quotes and whitespace alone", () => {
		expect(escapeText(`say "hi"\tand\n'bye'`)).toBe(`say "hi"\tand\n'bye'`);
	});

	test("returns text with nothing to escape unchanged", () => {
		expect(escapeText("héllo 😀")).toBe("héllo 😀");
	});
});

describe("escapeAttribute", () => {
	test("escapes the markup delimiters and double quotes", () => {
		expect(escapeAttribute(`x"y<z>&w`)).toBe("x&quot;y&lt;z&gt;&amp;w");
	});

	test("escapes tabs and line breaks as numeric references", () => {
		expect(escapeAttribute("one\ttwo\nthree\rfour")).toBe("one&#9;two&#10;three&#13;four");
	});

	test("leaves single quotes alone", () => {
		expect(escapeAttribute("it's")).toBe("it's");
	});
});
