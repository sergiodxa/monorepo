/**
 * Tests reference decoding, covering the five predefined entities, numeric
 * references, and the malformed forms that a caller receives as an error.
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

	test("fails on an entity the document never declares", () => {
		let result = decodeEntities("caf&eacute;");

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.message).toBe("entity not found:&eacute;");
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
