/**
 * `parse` against JSONC documents and against V8's `JSON.parse`: values match it exactly, and a
 * corpus of invalid documents must fail at the very position V8 names, so the package's own
 * positions agree with Node's while also being available where an engine reports none.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vite-plus/test";

import { JSONCParseError, parse, strip } from "./index.js";

/** V8's position for a failure it locates: the index it prints, or the length at end of input. */
function v8Offset(text: string): number | null {
	try {
		JSON.parse(text);
		return null;
	} catch (error) {
		let message = (error as Error).message;
		if (message.startsWith("Unexpected end of JSON input")) return text.length;
		let position = /at position (\d+)/.exec(message)?.[1];
		return position === undefined ? null : Number(position);
	}
}

/** Valid documents the mutation corpus starts from, covering every JSON construct. */
const SEEDS = [
	'{"name":"sdxc","version":"2026.10.14","private":true,"tags":["a","b"],"n":null}',
	'[1,-2.5,3e10,-0.1E-2,0,{"nested":{"deep":[true,false,null]}},"\\u00e9\\n\\"q\\""]',
	'{\n\t"compilerOptions": {\n\t\t"strict": true,\n\t\t"paths": { "~/*": ["./app/*"] }\n\t}\n}',
	'  "a string with spaces and \\t escapes"  ',
	"[[[[]]],{},[{}],12345678901234567890]",
];

/** A seeded linear congruential generator, so the corpus is the same on every run. */
function random(seed: number): () => number {
	let state = seed;
	return () => {
		state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
		return state / 2_147_483_648;
	};
}

/** The seeds with one character deleted, inserted or replaced, a few thousand times over. */
function mutations(): string[] {
	let next = random(42);
	let alphabet = '{}[]:,"\\-+.0123456789eEtfnulrsax \n\t\u0001';
	let corpus: string[] = [];
	for (let seed of SEEDS) {
		for (let round = 0; round < 800; round += 1) {
			let at = Math.floor(next() * (seed.length + 1));
			let char = alphabet[Math.floor(next() * alphabet.length)] ?? "x";
			let kind = Math.floor(next() * 3);
			if (kind === 0) corpus.push(seed.slice(0, at) + seed.slice(at + 1));
			else if (kind === 1) corpus.push(seed.slice(0, at) + char + seed.slice(at));
			else corpus.push(seed.slice(0, at) + char + seed.slice(at + 1));
		}
	}
	return corpus;
}

/** Hand-picked invalid documents, one per kind of failure V8 distinguishes. */
const INVALID = [
	"",
	" ",
	"{",
	"[",
	'{"a"',
	'{"a":',
	'{"a":1',
	"[1 2]",
	'{"a" 1}',
	'{"a":1 "b":2}',
	"{a:1}",
	"{'a':1}",
	"{,}",
	"tru",
	'"abc',
	'"a\\x"',
	'"a\\u12g4"',
	'"a\nb"',
	"01",
	"-01",
	"1.",
	"1.e3",
	"-",
	"[-]",
	"1e",
	"1e+",
	"1 2",
	"[1]]",
	'"\\',
	'"\\u12',
	'{"a":[1,2}',
	'{"a" :1, "b"}',
	"0x10",
];

describe("parse", () => {
	test("accepts comments, trailing commas and a byte-order mark", () => {
		let text =
			'\uFEFF{\n\t// line\n\t"a": [1, 2,], /* block\n*/ "b": { "c": "//not a comment", },\n}';

		expect(unwrap(parse(text))).toEqual({ a: [1, 2], b: { c: "//not a comment" } });
	});

	test("produces exactly what JSON.parse produces for plain JSON", () => {
		for (let seed of SEEDS) expect(unwrap(parse(seed))).toEqual(JSON.parse(seed));
	});

	test("rejects JSON5 extensions and commas that follow no value", () => {
		for (let text of ["{a: 1}", "['a']", "0x10", "[,]", "{,}", "[1,,]", '{"a":1,,}']) {
			expect(isFailure(parse(text)), text).toBe(true);
		}
	});

	test("rejects a block comment that never closes, at the comment", () => {
		let result = parse('{"a": 1}\n/* left open');

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error).toBeInstanceOf(JSONCParseError);
			expect(result.error.message).toBe("Unterminated block comment at line 2, column 1");
		}
	});

	test("positions an error in the original text, past comments that came before it", () => {
		let result = parse('{\n  /* a comment */ "a": 1\n  // another\n  "b" 2\n}');

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error.reason).toBe("Expected ',' or '}' after a property value");
			expect([result.error.line, result.error.column]).toEqual([4, 3]);
		}
	});

	test("counts CRLF and lone CR as single line breaks", () => {
		let crlf = parse('{\r\n"a" 1}');
		let cr = parse('{\r"a" 1}');

		expect(isFailure(crlf) && [crlf.error.line, crlf.error.column]).toEqual([2, 5]);
		expect(isFailure(cr) && [cr.error.line, cr.error.column]).toEqual([2, 5]);
	});

	test("fails at the position V8 reports, for every invalid document it locates", () => {
		let compared = 0;
		for (let text of [...INVALID, ...mutations()]) {
			if (text.includes("/") || strip(text) !== text) continue;
			let expected = v8Offset(text);
			let result = parse(text);
			if (expected === null) {
				if (isSuccess(result)) expect(result.data).toEqual(JSON.parse(text));
				continue;
			}
			expect(isFailure(result), JSON.stringify(text)).toBe(true);
			if (isFailure(result)) expect(result.error.offset, JSON.stringify(text)).toBe(expected);
			compared += 1;
		}
		expect(compared).toBeGreaterThan(1_000);
	});
});
