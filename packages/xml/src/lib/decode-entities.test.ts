/**
 * Tests reference decoding, covering the five predefined entities, numeric
 * references, the XHTML named entity sets, and the malformed forms that a caller
 * receives as an error.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { decodeEntities } from "./decode-entities.js";

describe("decodeEntities", () => {
	test("decodes the five predefined entities", () => {
		let result = decodeEntities("a &amp; b &lt; c &gt; d &quot;e&quot; &apos;f&apos;");

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) expect(result.data).toBe(`a & b < c > d "e" 'f'`);
	});

	test("decodes decimal and hexadecimal references", () => {
		let decimal = decodeEntities("&#8217;&#65;");
		let hexadecimal = decodeEntities("&#x2019;&#x41;");

		expect(isSuccess(decimal)).toBe(true);
		expect(isSuccess(hexadecimal)).toBe(true);
		if (isSuccess(decimal)) expect(decimal.data).toBe("’A");
		if (isSuccess(hexadecimal)) expect(hexadecimal.data).toBe("’A");
	});

	test("decodes a reference above the basic plane", () => {
		let result = decodeEntities("&#128512;");

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) expect(result.data).toBe("😀");
	});

	test("decodes an escaped ampersand without re-reading the result", () => {
		let result = decodeEntities("a&#38;b");

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) expect(result.data).toBe("a&b");
	});

	test("keeps an ampersand that starts no reference", () => {
		let result = decodeEntities("a & b");

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) expect(result.data).toBe("a & b");
	});

	test("returns text with no ampersand unchanged", () => {
		let result = decodeEntities("héllo 😀");

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) expect(result.data).toBe("héllo 😀");
	});

	test("decodes a Latin-1 entity the document never declares", () => {
		let result = decodeEntities("caf&eacute;");

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) expect(result.data).toBe("café");
	});

	test("decodes the punctuation feeds are written with", () => {
		let result = decodeEntities("one&nbsp;two&mdash;three&hellip;&rsquo;s &ldquo;four&rdquo;");

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result))
			expect(result.data).toBe("one\u00A0two\u2014three\u2026\u2019s \u201Cfour\u201D");
	});

	test("decodes entities from the symbol set", () => {
		let result = decodeEntities("&alpha;&bull;&trade;&rarr;&le;");

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) expect(result.data).toBe("\u03B1\u2022\u2122\u2192\u2264");
	});

	test("resolves a name the XML predefines before the XHTML sets", () => {
		let result = decodeEntities("&amp;&lt;&gt;");

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) expect(result.data).toBe("&<>");
	});

	test("fails on a name no entity set declares", () => {
		let result = decodeEntities("a &bogus; b");

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.message).toBe("entity not found:&bogus;");
	});

	test("fails on a malformed numeric reference", () => {
		let result = decodeEntities("&#xZZ;");

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error.message).toBe("entity not matching Reference production: &#xZZ;");
		}
	});

	test("fails on a numeric reference outside the code point range", () => {
		let unpaired = decodeEntities("&#xD800;");
		let beyondLastPlane = decodeEntities("&#x110000;");

		expect(isFailure(unpaired)).toBe(true);
		expect(isFailure(beyondLastPlane)).toBe(true);
	});
});
