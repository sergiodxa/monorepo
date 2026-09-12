/**
 * Tests the attribute writer: the fixed order the shorthands take so a second pass
 * writes the list identically, the spellings that fall back to a full pair, and the
 * form each literal value is written in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { writeAnnotation, writeAttributes } from "./attributes.js";

describe("writeAttributes", () => {
	test("writes nothing for a node that carries no attributes", () => {
		expect(writeAttributes({}, true)).toBe("");
	});

	test("puts the id first, the classes next and everything else after them", () => {
		expect(writeAttributes({ title: "Setup", class: "wide lead", id: "install" }, true)).toBe(
			'#install .wide .lead title="Setup"',
		);
	});

	test("writes one shorthand per class name", () => {
		expect(writeAttributes({ class: "one two three" }, true)).toBe(".one .two .three");
	});

	test("keeps the remaining attributes in the order they were written", () => {
		expect(writeAttributes({ zeta: "1", alpha: "2", middle: "3" }, true)).toBe(
			'zeta="1" alpha="2" middle="3"',
		);
	});

	test("falls back to a pair for an id no shorthand can spell", () => {
		expect(writeAttributes({ id: "1-install" }, true)).toBe('id="1-install"');
		expect(writeAttributes({ id: "two words" }, true)).toBe('id="two words"');
	});

	test("falls back to a pair when a class name holds a character a shorthand cannot carry", () => {
		expect(writeAttributes({ class: "wide lead.in" }, true)).toBe('class="wide lead.in"');
	});

	test("falls back to a pair for a class that is nothing but whitespace", () => {
		expect(writeAttributes({ class: "   " }, true)).toBe('class="   "');
	});

	test("falls back to a pair for an id or a class the source wrote as a literal", () => {
		expect(writeAttributes({ id: 42, class: true }, true)).toBe("id={42} class");
	});

	test("writes a string value in quotes", () => {
		expect(writeAttributes({ title: "Setup" }, true)).toBe('title="Setup"');
	});

	test("escapes the quote and the backslash a string value holds", () => {
		expect(writeAttributes({ title: 'say "hi"' }, true)).toBe('title="say \\"hi\\""');
		expect(writeAttributes({ path: "a\\b" }, true)).toBe('path="a\\\\b"');
	});

	test("writes a number in braces", () => {
		expect(writeAttributes({ lines: 42 }, true)).toBe("lines={42}");
	});

	test("writes a true as the bare key it was written as", () => {
		expect(writeAttributes({ wrap: true }, true)).toBe("wrap");
	});

	test("writes a false in braces, since a bare key cannot say it", () => {
		expect(writeAttributes({ wrap: false }, true)).toBe("wrap={false}");
	});

	test("joins several attributes with one space", () => {
		expect(writeAttributes({ wrap: true, lines: 3, title: "Setup" }, true)).toBe(
			'wrap lines={3} title="Setup"',
		);
	});

	test("writes every attribute as a pair where a tag rules the shorthands out", () => {
		expect(writeAttributes({ id: "install", class: "wide lead" }, false)).toBe(
			'id="install" class="wide lead"',
		);
	});
});

describe("writeAnnotation", () => {
	test("wraps the attribute list in the delimiters a block's annotation takes", () => {
		expect(writeAnnotation({ class: "wide" })).toBe("{% .wide %}");
		expect(writeAnnotation({ id: "install", title: "Setup" })).toBe('{% #install title="Setup" %}');
	});

	test("writes no annotation for a block that carries no attributes", () => {
		expect(writeAnnotation({})).toBeNull();
	});
});
