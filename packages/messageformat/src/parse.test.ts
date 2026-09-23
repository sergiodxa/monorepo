/**
 * Checks the data model the parser produces for each construct, and the errors it reports:
 * syntax errors with their offset, data model errors, and the cases the conformance suite
 * cannot express, such as unpaired surrogates.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { parse } from "./index.js";

/** Parses `source`, failing the test with the parse error when it is rejected. */
function parsed(source: string) {
	let result = parse(source);
	if (isFailure(result)) throw result.error;
	return result.data;
}

/** Parses `source`, failing the test when it is accepted, and returns the error. */
function rejected(source: string) {
	let result = parse(source);
	if (isSuccess(result)) throw new Error(`Expected ${JSON.stringify(source)} to be rejected`);
	return result.error;
}

describe("parse", () => {
	test("a simple message keeps its leading whitespace as text", () => {
		expect(parsed("  Hello {$name}!")).toEqual({
			type: "message",
			declarations: [],
			pattern: [
				"  Hello ",
				{ type: "expression", arg: { type: "variable", name: "name" }, attributes: {} },
				"!",
			],
		});
	});

	test("escapes are processed in text and quoted literals", () => {
		expect(parsed("a\\{b\\} {|c\\|d|}")).toMatchObject({
			pattern: ["a{b} ", { arg: { type: "literal", value: "c|d" } }],
		});
	});

	test("functions carry options and expressions carry attributes", () => {
		let message = parsed("{$n :number minimumFractionDigits=2 style=$s @locale=en @translate}");
		expect(message).toMatchObject({
			pattern: [
				{
					type: "expression",
					arg: { type: "variable", name: "n" },
					function: {
						type: "function",
						name: "number",
						options: {
							minimumFractionDigits: { type: "literal", value: "2" },
							style: { type: "variable", name: "s" },
						},
					},
					attributes: { locale: { type: "literal", value: "en" }, translate: true },
				},
			],
		});
	});

	test("markup comes in open, standalone and close kinds", () => {
		let message = parsed("{#link href=|/a|}x{/link}{#br/}");
		expect(message).toMatchObject({
			pattern: [
				{ type: "markup", kind: "open", name: "link", options: { href: { value: "/a" } } },
				"x",
				{ type: "markup", kind: "close", name: "link" },
				{ type: "markup", kind: "standalone", name: "br" },
			],
		});
	});

	test("declarations and a matcher with several selectors", () => {
		let message = parsed(
			".input {$a :number}\n.local $b = {$c :string}\n.match $a $b\n1 x {{one x}}\n* * {{other}}",
		);
		expect(message).toMatchObject({
			type: "select",
			declarations: [
				{ type: "input", name: "a" },
				{ type: "local", name: "b", value: { arg: { name: "c" } } },
			],
			selectors: [
				{ type: "variable", name: "a" },
				{ type: "variable", name: "b" },
			],
			variants: [
				{
					keys: [
						{ type: "literal", value: "1" },
						{ type: "literal", value: "x" },
					],
					value: ["one x"],
				},
				{ keys: [{ type: "*" }, { type: "*" }], value: ["other"] },
			],
		});
	});

	test("names are normalized to NFC", () => {
		let message = parsed(".local $D\u0323\u0307 = {x} {{{$\u1E0C\u0307}}}");
		expect(message.declarations[0]?.name).toBe("\u1E0C\u0307");
		expect(message).toMatchObject({ pattern: [{ arg: { name: "\u1E0C\u0307" } }] });
	});

	test("a syntax error reports its offset", () => {
		let error = rejected("hello {world");
		expect(error.type).toBe("syntax-error");
		expect(error.start).toBe(12);
	});

	test("unpaired surrogates are syntax errors in text and literals", () => {
		expect(rejected("a\ud800b").type).toBe("syntax-error");
		expect(rejected("{|\udc00|}").type).toBe("syntax-error");
	});

	test("a syntax error outranks an earlier duplicate option name", () => {
		expect(rejected("{:f a=1 a=2} {").type).toBe("syntax-error");
		expect(rejected("{:f a=1 a=2}").type).toBe("duplicate-option-name");
	});

	test("data model errors are reported by name", () => {
		expect(rejected(".input {$x :number} .match $x 1 {{one}}").type).toBe(
			"missing-fallback-variant",
		);
		expect(rejected(".local $x = {$x} {{}}").type).toBe("duplicate-declaration");
	});

	test("an option named __proto__ is an own entry", () => {
		let message = parsed("{:f __proto__=1}");
		let expression = message.type === "message" ? message.pattern[0] : undefined;
		let options =
			expression && typeof expression === "object" && expression.type === "expression"
				? expression.function?.options
				: undefined;
		expect(Object.hasOwn(options ?? {}, "__proto__")).toBe(true);
	});
});
