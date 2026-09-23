/**
 * Checks `MessageFormat` against the TC39 proposal's surface: construction, string and
 * parts output, markup parts, plural and exact selection, custom functions, bidi isolation
 * and error reporting.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { MessageData, MessageFunction } from "./index.js";

import { MessageError, MessageFormat } from "./index.js";

/** Formats without bidi isolation, collecting error names. */
function format(source: string, values: Record<string, unknown> = {}, locale = "en") {
	let errors: string[] = [];
	let output = new MessageFormat(locale, source, { bidiIsolation: "none" }).format(
		values,
		(error) => errors.push(error instanceof MessageError ? error.type : error.name),
	);
	return { output, errors };
}

describe("MessageFormat", () => {
	test("formats the fallback silently when no onError is given", () => {
		let mf = new MessageFormat("en", "Hi {$name} {$x :nope}", { bidiIsolation: "none" });
		expect(mf.format()).toBe("Hi {$name} {$x}");
		expect(mf.formatToParts().map((part) => part.type)).toEqual([
			"text",
			"fallback",
			"text",
			"fallback",
		]);
	});

	test("formats a number with grouping and drops markup from strings", () => {
		let message = new MessageFormat("en", "{#b}{$count :number}{/b} new posts");
		expect(message.format({ count: 1200 })).toBe("1,200 new posts");
	});

	test("keeps markup as parts for a caller to render", () => {
		let message = new MessageFormat("en", "Read {#link href=$url}the docs{/link}{#br/}");
		expect(message.formatToParts({ url: "/docs" })).toEqual([
			{ type: "text", value: "Read " },
			{ type: "markup", kind: "open", source: "#link", name: "link", options: { href: "/docs" } },
			{ type: "text", value: "the docs" },
			{ type: "markup", kind: "close", source: "/link", name: "link" },
			{ type: "markup", kind: "standalone", source: "#br/", name: "br" },
		]);
	});

	test("selects exact numbers before plural categories, and `*` last", () => {
		let source = ".input {$n :number}\n.match $n\n0 {{none}}\none {{one}}\n* {{{$n} many}}";
		expect([0, 1, 2].map((n) => format(source, { n }).output)).toEqual(["none", "one", "2 many"]);
	});

	test("uses the locale's plural rules", () => {
		let source =
			".input {$n :integer}\n.match $n\none {{jeden}}\nfew {{kilka}}\nmany {{wiele}}\n* {{ułamek}}";
		expect([1, 3, 5, 22].map((n) => format(source, { n }, "pl").output)).toEqual([
			"jeden",
			"kilka",
			"wiele",
			"kilka",
		]);
	});

	test("selects ordinals with select=ordinal", () => {
		let source =
			".input {$n :number select=ordinal}\n.match $n\none {{{$n}st}}\ntwo {{{$n}nd}}\nfew {{{$n}rd}}\n* {{{$n}th}}";
		expect([1, 2, 3, 4, 11].map((n) => format(source, { n }).output)).toEqual([
			"1st",
			"2nd",
			"3rd",
			"4th",
			"11th",
		]);
	});

	test("prefers the variant matching the earlier selector", () => {
		let source =
			".input {$a :string}\n.input {$b :string}\n.match $a $b\nx * {{x any}}\n* y {{any y}}\n* * {{other}}";
		expect(format(source, { a: "x", b: "y" }).output).toBe("x any");
		expect(format(source, { a: "z", b: "y" }).output).toBe("any y");
	});

	test("reports an unresolved variable and formats its fallback", () => {
		expect(format("Hello {$name}!")).toEqual({
			output: "Hello {$name}!",
			errors: ["unresolved-variable"],
		});
	});

	test("reports an unknown function with the operand as fallback", () => {
		expect(format("{|x y| :nope}")).toEqual({ output: "{|x y|}", errors: ["unknown-function"] });
	});

	test("formats without an error handler", () => {
		expect(new MessageFormat("en", "Hi {$who}").format()).toBe("Hi \u2068{$who}\u2069");
	});

	test("throws a MessageError from the constructor on a syntax error", () => {
		expect(() => new MessageFormat("en", "{oops")).toThrow(MessageError);
	});

	test("accepts a data model object and validates it", () => {
		let data: MessageData = {
			type: "message",
			declarations: [],
			pattern: ["Hi ", { type: "expression", arg: { type: "variable", name: "who" } }],
		};
		expect(new MessageFormat("en", data, { bidiIsolation: "none" }).format({ who: "Ana" })).toBe(
			"Hi Ana",
		);
		let invalid: MessageData = {
			type: "select",
			declarations: [],
			selectors: [{ type: "variable", name: "x" }],
			variants: [{ keys: [{ type: "*" }], value: [] }],
		};
		expect(() => new MessageFormat("en", invalid)).toThrow(/annotation/);
	});

	test("calls custom functions with the context, options and operand", () => {
		let calls: unknown[] = [];
		let upper: MessageFunction = (context, options, input) => {
			calls.push({ locales: context.locales, source: context.source, options, input });
			let value = String(input).toUpperCase();
			return {
				type: "upper",
				locale: context.locales[0] ?? "und",
				dir: "auto",
				source: context.source,
				toParts: () => [{ type: "upper", source: context.source, value }],
				toString: () => value,
			};
		};
		let message = new MessageFormat("en-US", "{$who :ns:upper mode=loud}", {
			bidiIsolation: "none",
			functions: { "ns:upper": upper },
		});
		expect(message.format({ who: "ana" })).toBe("ANA");
		expect(calls).toEqual([
			{ locales: ["en-US"], source: "$who", options: { mode: "loud" }, input: "ana" },
		]);
	});

	test("a throwing custom function yields a fallback and a function-error", () => {
		let broken: MessageFunction = () => {
			throw new TypeError("nope");
		};
		let errors: Error[] = [];
		let message = new MessageFormat("en", "{:broken}", { functions: { broken } });
		expect(message.formatToParts({}, (error) => errors.push(error))).toEqual([
			{ type: "bidiIsolation", value: "\u2068" },
			{ type: "fallback", source: ":broken" },
			{ type: "bidiIsolation", value: "\u2069" },
		]);
		expect(errors[0]).toMatchObject({ type: "function-error", cause: expect.any(TypeError) });
	});

	test("isolates strings but not numbers in a left-to-right message", () => {
		let message = new MessageFormat("en", "{$name} has {$n :number} posts");
		expect(message.format({ name: "שרה", n: 3 })).toBe("\u2068שרה\u2069 has 3 posts");
	});

	test("evaluates each declaration once per call", () => {
		let count = 0;
		let counter: MessageFunction = (context) => {
			count += 1;
			return {
				type: "counter",
				locale: "en",
				dir: "ltr",
				source: context.source,
				toParts: () => [],
				toString: () => String(count),
			};
		};
		let message = new MessageFormat("en", ".local $c = {:counter} {{{$c} {$c}}}", {
			bidiIsolation: "none",
			functions: { counter },
		});
		expect(message.format()).toBe("1 1");
		expect(message.format()).toBe("2 2");
	});

	test("resolvedOptions reports the defaults and the custom functions", () => {
		let message = new MessageFormat("ar", "x");
		expect(message.resolvedOptions()).toEqual({
			bidiIsolation: "compatibility",
			dir: "rtl",
			functions: {},
			localeMatcher: "best fit",
		});
	});

	test("an integer truncates before formatting and selecting", () => {
		expect(format("{$n :integer}", { n: 4.9 }).output).toBe("4");
		expect(format(".input {$n :integer} .match $n 4 {{four}} * {{other}}", { n: 4.9 }).output).toBe(
			"four",
		);
	});
});
