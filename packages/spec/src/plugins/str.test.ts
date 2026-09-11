/**
 * Tests for the built-in `str` plugin. Most of the surface is the strictness:
 * `format` composes a string only when every hole has a value and every value
 * has a hole, so each case here is one way a template and its arguments can
 * disagree and the message that names the disagreement.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { SpecError } from "../errors.js";
import type { ToolArg, Value } from "../values.js";

import { createToolContext } from "../tool-context.js";

import { createStrPlugin } from "./str.js";

const PLUGIN = createStrPlugin();

const CONTEXT = createToolContext();

function value(data: Value): ToolArg {
	return { kind: "value", value: data };
}

function word(name: string): ToolArg {
	return { kind: "word", word: name };
}

/** Call `str.format` with the given arguments. */
async function format(...args: ToolArg[]): Promise<Result<Value, SpecError>> {
	return await PLUGIN.call("format", args, CONTEXT);
}

/** Unwrap a failed result into its error, failing the test on success. */
function unwrapError(result: Result<Value, SpecError>): SpecError {
	if (!isFailure(result)) {
		throw new Error(`expected a failure, got ${JSON.stringify(result.data)}`);
	}
	return result.error;
}

describe(createStrPlugin.name, () => {
	test("describes one permissionless action", () => {
		expect(PLUGIN.namespace).toBe("str");
		let tools = PLUGIN.describe();
		expect(tools.map((tool) => tool.name)).toEqual(["format"]);
		for (let tool of tools) {
			expect(tool.kind).toBe("action");
			expect(tool.requires).toBeUndefined();
		}
	});

	test("an unknown tool names the ones that exist", async () => {
		let error = unwrapError(await PLUGIN.call("join", [value("a")], CONTEXT));
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain('str has no tool "join"');
		expect(error.message).toContain("format");
	});

	describe("positional holes", () => {
		test("fills a hole from the argument at its index", async () => {
			expect(unwrap(await format(value("/${0}"), value("marta")))).toBe("/marta");
		});

		test("indices select arguments, so holes may be written in any order", async () => {
			expect(unwrap(await format(value("${1}, ${0}"), value("world"), value("hello")))).toBe(
				"hello, world",
			);
		});

		test("one argument fills every hole that names its index", async () => {
			expect(unwrap(await format(value("${0}/${0}"), value("x")))).toBe("x/x");
		});

		test("a template with no holes returns itself", async () => {
			expect(unwrap(await format(value("/portfolios")))).toBe("/portfolios");
		});
	});

	describe("named holes", () => {
		test("fills each hole from the key of its name", async () => {
			let result = await format(value("/${slug}/invite"), value({ slug: "team-a" }));
			expect(unwrap(result)).toBe("/team-a/invite");
		});

		test("a key fills every hole that names it", async () => {
			let result = await format(value("${who} and ${who}"), value({ who: "me" }));
			expect(unwrap(result)).toBe("me and me");
		});

		test("keys are read as written, so a dotted-looking key still resolves", async () => {
			let result = await format(value("${og:title}"), value({ "og:title": "Invest" }));
			expect(unwrap(result)).toBe("Invest");
		});
	});

	describe("stringifying a value", () => {
		test("a string is itself", async () => {
			expect(unwrap(await format(value("${0}"), value("plain")))).toBe("plain");
		});

		test("a number is its decimal form, unquoted", async () => {
			expect(unwrap(await format(value("?page=${0}"), value(12)))).toBe("?page=12");
			expect(unwrap(await format(value("${0}"), value(-1.5)))).toBe("-1.5");
		});

		test("a boolean is true or false", async () => {
			expect(unwrap(await format(value("?on=${0}"), value(true)))).toBe("?on=true");
			expect(unwrap(await format(value("?on=${0}"), value(false)))).toBe("?on=false");
		});

		test("null is an error naming the hole, never the text null", async () => {
			let error = unwrapError(await format(value("/u/${slug}"), value({ slug: null })));
			expect(error.code).toBe("tool-error");
			expect(error.message).toContain("${slug}");
			expect(error.message).toContain('"/u/${slug}"');
			expect(error.message).not.toBe("/u/null");
		});

		test("an object is an error naming the hole", async () => {
			let error = unwrapError(await format(value("${0}"), value({ id: 1 })));
			expect(error.message).toContain("${0}");
			expect(error.message).toContain('"${0}"');
		});

		test("an array is an error naming the hole", async () => {
			let error = unwrapError(await format(value("${0}"), value([1, 2])));
			expect(error.message).toContain("${0}");
		});
	});

	describe("escaping", () => {
		test("a bare dollar is literal", async () => {
			expect(unwrap(await format(value("costs $5")))).toBe("costs $5");
		});

		test("a trailing dollar is literal", async () => {
			expect(unwrap(await format(value("100$")))).toBe("100$");
		});

		test("{{ writes the two characters that open a hole", async () => {
			expect(unwrap(await format(value("write {{name} for a hole")))).toBe(
				"write ${name} for a hole",
			);
		});

		test("a single brace is ordinary text", async () => {
			expect(unwrap(await format(value("{a} }")))).toBe("{a} }");
		});

		test("an escaped hole consumes no argument", async () => {
			expect(unwrap(await format(value("{{0} is ${0}"), value("a")))).toBe("${0} is a");
		});
	});

	describe("strictness", () => {
		test("a positional hole with no argument names the hole and the template", async () => {
			let error = unwrapError(await format(value("/${0}/${1}"), value("only")));
			expect(error.code).toBe("tool-error");
			expect(error.message).toContain("${1}");
			expect(error.message).toContain('"/${0}/${1}"');
		});

		test("a named hole with no key names the hole and the template", async () => {
			let error = unwrapError(await format(value("/${slug}"), value({ other: "x" })));
			expect(error.message).toContain("${slug}");
			expect(error.message).toContain('"/${slug}"');
		});

		test("a named template with no argument at all still names the hole", async () => {
			let error = unwrapError(await format(value("/${slug}")));
			expect(error.message).toContain("${slug}");
		});

		test("an argument no hole consumes is an error", async () => {
			let error = unwrapError(await format(value("/${0}"), value("used"), value("spare")));
			expect(error.message).toContain("no hole uses");
			expect(error.message).toContain('"/${0}"');
			expect(error.message).toContain('"spare"');
		});

		test("an argument to a hole-less template is an error", async () => {
			let error = unwrapError(await format(value("/portfolios"), value("spare")));
			expect(error.message).toContain("no hole uses");
			expect(error.message).toContain('"/portfolios"');
		});

		test("a key no hole consumes is an error naming the key", async () => {
			let result = await format(value("/${slug}"), value({ slug: "a", extra: "b" }));
			let error = unwrapError(result);
			expect(error.message).toContain("no hole uses");
			expect(error.message).toContain('"extra"');
		});

		test("mixing positional and named holes is an error naming both", async () => {
			let error = unwrapError(await format(value("/${0}/${slug}"), value("a")));
			expect(error.message).toContain("mix positional and named");
			expect(error.message).toContain("${0}");
			expect(error.message).toContain("${slug}");
		});

		test("named holes take one object, not several arguments", async () => {
			let result = await format(value("${a}/${b}"), value({ a: "1" }), value({ b: "2" }));
			let error = unwrapError(result);
			expect(error.message).toContain("one object argument");
		});

		test("a named template handed a scalar reports what it got", async () => {
			let error = unwrapError(await format(value("/${slug}"), value("team-a")));
			expect(error.message).toContain("one object argument");
			expect(error.message).toContain('"team-a"');
		});

		test("a named template handed an array reports what it got", async () => {
			let error = unwrapError(await format(value("/${slug}"), value(["team-a"])));
			expect(error.message).toContain("one object argument");
		});

		test("an unclosed hole is an error naming the template", async () => {
			let error = unwrapError(await format(value("/${slug"), value({ slug: "a" })));
			expect(error.message).toContain("unclosed hole");
			expect(error.message).toContain('"/${slug"');
		});

		test("an empty hole is an error", async () => {
			let error = unwrapError(await format(value("/${}"), value("a")));
			expect(error.message).toContain("empty hole");
		});

		test("a missing template is an error", async () => {
			let error = unwrapError(await format());
			expect(error.message).toContain("template string");
		});

		test("a non-string template is an error", async () => {
			let error = unwrapError(await format(value(42)));
			expect(error.message).toContain("template string");
		});

		test("a bare word argument is an error naming the word", async () => {
			let error = unwrapError(await format(value("/${0}"), word("exists")));
			expect(error.message).toContain('bare word "exists"');
		});
	});
});
