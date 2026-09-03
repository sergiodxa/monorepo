/**
 * Tests for YAML serialization: the shape of the output, the rules it borrows from
 * `JSON.stringify`, and the values it declines to write.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { YAMLStringifyError } from "./errors";
import { stringify } from "./stringify";

/**
 * Writes a value the subset covers, failing the test when it does not.
 *
 * @param value - The value to write
 * @param indent - Spaces each nesting level adds
 * @returns The YAML text
 */
function write(value: unknown, indent?: number): string {
	let result = stringify(value, indent === undefined ? undefined : { indent });
	if (isFailure(result)) throw result.error;
	return result.data;
}

describe("stringify", () => {
	describe("scalars", () => {
		test("writes the types the core schema resolves", () => {
			expect(write({ a: null, b: true, c: false, d: 1, e: -1.5 })).toBe(
				"a: null\nb: true\nc: false\nd: 1\ne: -1.5\n",
			);
		});

		test("writes the numbers JSON cannot", () => {
			expect(
				write({ a: Number.NaN, b: Number.POSITIVE_INFINITY, c: Number.NEGATIVE_INFINITY }),
			).toBe("a: .nan\nb: .inf\nc: -.inf\n");
		});

		test("leaves an unambiguous string unquoted", () => {
			expect(write({ title: "Team & Settings" })).toBe("title: Team & Settings\n");
			expect(write({ note: "it's fine" })).toBe("note: it's fine\n");
			expect(write({ note: 'say "hi"' })).toBe('note: say "hi"\n');
		});

		test("quotes a string that would come back as another type", () => {
			expect(write({ a: "123", b: "true", c: "null", d: "~", e: ".inf" })).toBe(
				'a: "123"\nb: "true"\nc: "null"\nd: "~"\ne: ".inf"\n',
			);
		});

		test("leaves a date unquoted, since the core schema reads it back as text", () => {
			expect(write({ lastUpdated: "2026-08-02" })).toBe("lastUpdated: 2026-08-02\n");
		});

		test("quotes a string YAML would read as structure", () => {
			expect(write({ a: "x: y", b: "x # y", c: "- x", d: "[x]", e: "", f: " padded " })).toBe(
				'a: "x: y"\nb: "x # y"\nc: "- x"\nd: "[x]"\ne: ""\nf: " padded "\n',
			);
		});

		test("escapes what a quoted scalar reads specially", () => {
			expect(write({ a: '"quoted"', b: "back\\slash: here", c: "tab\tstop" })).toBe(
				'a: "\\"quoted\\""\nb: "back\\\\slash: here"\nc: "tab\\tstop"\n',
			);
		});

		test("leaves a quote or a backslash inside a value unquoted", () => {
			expect(write({ a: 'say "hi"', b: "back\\slash" })).toBe('a: say "hi"\nb: back\\slash\n');
		});
	});

	describe("collections", () => {
		test("nests a mapping by the indentation asked for", () => {
			expect(write({ a: { b: { c: 1 } } })).toBe("a:\n  b:\n    c: 1\n");
			expect(write({ a: { b: { c: 1 } } }, 4)).toBe("a:\n    b:\n        c: 1\n");
		});

		test("keeps a sequence entry's first key on its dash", () => {
			expect(write({ items: [{ title: "a", order: 1 }, { title: "b" }] })).toBe(
				"items:\n  - title: a\n    order: 1\n  - title: b\n",
			);
		});

		test("nests a sequence inside a sequence", () => {
			expect(write([[1, 2], [3]])).toBe("- - 1\n  - 2\n- - 3\n");
		});

		test("writes an empty collection in the flow style", () => {
			expect(write({ a: {}, b: [] })).toBe("a: {}\nb: []\n");
			expect(write({})).toBe("{}\n");
			expect(write([])).toBe("[]\n");
		});

		test("quotes a key under the same rules as a scalar", () => {
			expect(write({ "a b": 1, "a: b": 2, "": 3, 1: 4 })).toBe(
				'"1": 4\na b: 1\n"a: b": 2\n"": 3\n',
			);
		});
	});

	describe("multi-line strings", () => {
		test("writes a literal block, chomping to match the trailing break", () => {
			expect(write({ a: "one\ntwo\n" })).toBe("a: |\n  one\n  two\n");
			expect(write({ a: "one\ntwo" })).toBe("a: |-\n  one\n  two\n");
		});

		test("indents a block standing as the whole document", () => {
			expect(write("one\ntwo\n")).toBe("|\n  one\n  two\n");
		});

		test("quotes instead when a block would not read back the same", () => {
			expect(write({ a: "one \ntwo" })).toBe('a: "one \\ntwo"\n');
			expect(write({ a: "  leading\nspace" })).toBe('a: "  leading\\nspace"\n');
			expect(write({ a: "two\ntrailing\n\n" })).toBe('a: "two\\ntrailing\\n\\n"\n');
		});
	});

	describe("the rules it borrows from JSON.stringify", () => {
		test("uses a toJSON method where a value has one", () => {
			expect(write({ when: new Date("2026-08-02T10:00:00Z") })).toBe(
				"when: 2026-08-02T10:00:00.000Z\n",
			);
		});

		test("drops an undefined mapping entry and nulls an undefined sequence entry", () => {
			expect(write({ a: 1, b: undefined, c: 2 })).toBe("a: 1\nc: 2\n");
			expect(write([1, undefined, 2])).toBe("- 1\n- null\n- 2\n");
		});

		test("treats a function and a symbol the same way", () => {
			expect(write({ a: 1, b: () => 1, c: Symbol("c") })).toBe("a: 1\n");
			expect(write([() => 1])).toBe("- null\n");
		});
	});

	describe("failures", () => {
		test("declines a circular structure, naming the path back to itself", () => {
			let value: Record<string, unknown> = { items: [{}] };
			(value.items as Record<string, unknown>[])[0]!.parent = value;

			let result = stringify(value);

			expect(isFailure(result)).toBe(true);
			if (!isFailure(result)) return;
			expect(result.error).toBeInstanceOf(YAMLStringifyError);
			expect(result.error.path).toBe("items.0.parent");
		});

		test("declines a bigint, which YAML has no notation for", () => {
			let result = stringify({ big: 1n });

			expect(isFailure(result)).toBe(true);
			if (!isFailure(result)) return;
			expect(result.error.message).toContain("bigint");
			expect(result.error.path).toBe("big");
		});
	});
});
