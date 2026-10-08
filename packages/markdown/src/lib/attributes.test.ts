/**
 * Covers the dialect's two scanners and the attribute reader behind them: the
 * quoting that keeps a delimiter from closing early, every literal value form an
 * author may write, and the index a failed read stops at.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { Markdown } from "../index.js";

import {
	AttributeError,
	parseAttributeList,
	readVariableName,
	scanAnnotation,
	scanTagClose,
	scanTagOpen,
} from "./attributes.js";

/**
 * @param text - The attribute list, without its delimiters
 * @param shorthands - Whether `#id` and `.class` are allowed
 * @returns The attributes the reader made of it
 */
function read(text: string, shorthands = false): Markdown.Attributes {
	return unwrap(parseAttributeList(text, shorthands));
}

/**
 * Drops the positions variable nodes carry, so a case names the values it reads.
 *
 * @param value - Attributes or one value inside them
 * @returns The same structure with every `position` removed
 */
function shape(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(shape);
	if (value === null || typeof value !== "object") return value;

	let out: Record<string, unknown> = {};
	for (let [key, item] of Object.entries(value)) if (key !== "position") out[key] = shape(item);
	return out;
}

/**
 * @param text - The attribute list the reader is expected to reject
 * @param shorthands - Whether `#id` and `.class` are allowed
 * @returns The error it stopped with
 */
function rejected(text: string, shorthands = false): AttributeError {
	let result = parseAttributeList(text, shorthands);
	if (!isFailure(result)) throw new Error(`Expected "${text}" to be rejected`);
	return result.error;
}

describe("scanAnnotation", () => {
	test("reads the body between the delimiters and where it ends", () => {
		expect(scanAnnotation('{% type="warning" %}', 0)).toEqual({
			body: 'type="warning"',
			bodyStart: 3,
			end: 20,
		});
	});

	test("reads an annotation that starts part way into the line", () => {
		expect(scanAnnotation("A paragraph. {% wide %}", 13)).toEqual({
			body: "wide",
			bodyStart: 16,
			end: 23,
		});
	});

	test("keeps a closing delimiter written inside a quoted value from ending it", () => {
		expect(scanAnnotation('{% title="100%} done" %}', 0)).toEqual({
			body: 'title="100%} done"',
			bodyStart: 3,
			end: 24,
		});
	});

	test("keeps an escaped quote from ending the value it sits in", () => {
		expect(scanAnnotation('{% a="x\\"y" %}', 0)).toEqual({
			body: 'a="x\\"y"',
			bodyStart: 3,
			end: 14,
		});
	});

	test("reads a single-quoted value the same way", () => {
		expect(scanAnnotation("{% a='%} b' %}", 0)).toEqual({
			body: "a='%} b'",
			bodyStart: 3,
			end: 14,
		});
	});

	test("finds nothing when the opening delimiter is not there", () => {
		expect(scanAnnotation("{ wide %}", 0)).toBeNull();
	});

	test("finds nothing when nothing closes the annotation", () => {
		expect(scanAnnotation("{% wide", 0)).toBeNull();
	});

	test("finds nothing when a quote swallows the closing delimiter", () => {
		expect(scanAnnotation('{% a="x %}', 0)).toBeNull();
	});
});

describe("readVariableName", () => {
	test("reads a variable reference written with the leading marker", () => {
		expect(readVariableName("$title")).toBe("title");
	});

	test("reads a name carrying hyphens after its first character", () => {
		expect(readVariableName("$my-var")).toBe("my-var");
	});

	test("reads nothing from an attribute list, which a bare name would start", () => {
		expect(readVariableName('type="warning"')).toBeNull();
		expect(readVariableName("wide")).toBeNull();
	});

	test("reads nothing when the marker names nothing", () => {
		expect(readVariableName("$")).toBeNull();
	});

	test("reads nothing when anything follows the name", () => {
		expect(readVariableName("$title extra")).toBeNull();
	});
});

describe("scanTagOpen", () => {
	test("reads the name, its attribute text and where the element ends", () => {
		expect(scanTagOpen('<callout type="info">', 0)).toEqual({
			name: "callout",
			attributeText: ' type="info"',
			attributeStart: 8,
			selfClosing: false,
			end: 21,
		});
	});

	test("keeps a closing angle bracket written inside a quoted value from ending it", () => {
		expect(scanTagOpen('<callout label="a > b">text', 0)).toEqual({
			name: "callout",
			attributeText: ' label="a > b"',
			attributeStart: 8,
			selfClosing: false,
			end: 23,
		});
	});

	test("marks an element the source closed on its own line and drops the slash", () => {
		expect(scanTagOpen('<video src="x" />', 0)).toEqual({
			name: "video",
			attributeText: ' src="x" ',
			attributeStart: 6,
			selfClosing: true,
			end: 17,
		});
	});

	test("reads the attributes of a self-closing element without the slash", () => {
		let tag = scanTagOpen('<video src="x" />', 0);

		expect(unwrap(parseAttributeList(tag?.attributeText ?? "", false))).toEqual({ src: "x" });
	});

	test("reads an element with no attributes at all", () => {
		expect(scanTagOpen("<note>", 0)).toEqual({
			name: "note",
			attributeText: "",
			attributeStart: 5,
			selfClosing: false,
			end: 6,
		});
	});

	test("finds nothing when nothing closes the element", () => {
		expect(scanTagOpen('<note type="a"', 0)).toBeNull();
	});

	test("finds nothing at a closing element", () => {
		expect(scanTagOpen("</note>", 0)).toBeNull();
	});

	test("finds nothing where no name follows the opening bracket", () => {
		expect(scanTagOpen("< note>", 0)).toBeNull();
		expect(scanTagOpen("note>", 0)).toBeNull();
	});
});

describe("scanTagClose", () => {
	test("reads the name it closes and where it ends", () => {
		expect(scanTagClose("</note>", 0)).toEqual({ name: "note", end: 7 });
	});

	test("reads a closing element that starts part way into the line", () => {
		expect(scanTagClose("text</note>", 4)).toEqual({ name: "note", end: 11 });
	});

	test("allows whitespace between the name and the closing bracket", () => {
		expect(scanTagClose("</note  >", 0)).toEqual({ name: "note", end: 9 });
	});

	test("finds nothing at an opening element", () => {
		expect(scanTagClose("<note>", 0)).toBeNull();
	});

	test("finds nothing when anything but whitespace follows the name", () => {
		expect(scanTagClose('</note type="a">', 0)).toBeNull();
	});

	test("finds nothing when nothing closes it", () => {
		expect(scanTagClose("</note", 0)).toBeNull();
	});

	test("finds nothing where no name follows the marker", () => {
		expect(scanTagClose("</ note>", 0)).toBeNull();
	});
});

describe("parseAttributeList", () => {
	test("reads a quoted string, in either quote", () => {
		expect(read('type="warning"')).toEqual({ type: "warning" });
		expect(read("type='warning'")).toEqual({ type: "warning" });
	});

	test("resolves a backslash escape inside a quoted value", () => {
		expect(read('label="a \\"b\\""')).toEqual({ label: 'a "b"' });
	});

	test("reads a braced integer as a number", () => {
		expect(read("count={42}")).toEqual({ count: 42 });
	});

	test("reads a braced negative decimal as a number", () => {
		expect(read("ratio={-1.5}")).toEqual({ ratio: -1.5 });
	});

	test("reads a braced boolean as a boolean", () => {
		expect(read("open={true}")).toEqual({ open: true });
		expect(read("open={false}")).toEqual({ open: false });
	});

	test("ignores the whitespace padding a braced literal", () => {
		expect(read("count={ 7 }")).toEqual({ count: 7 });
	});

	test("reads a bare name as the boolean it stands for", () => {
		expect(read("wide")).toEqual({ wide: true });
	});

	test("reads every attribute a whitespace-separated list holds", () => {
		expect(read('wide type="warning" count={2}')).toEqual({
			wide: true,
			type: "warning",
			count: 2,
		});
	});

	test("reads nothing out of an empty list", () => {
		expect(read("")).toEqual({});
		expect(read("   ")).toEqual({});
	});

	test("writes the identifier shorthand as an id attribute", () => {
		expect(read("#top", true)).toEqual({ id: "top" });
	});

	test("joins every class shorthand into one class attribute", () => {
		expect(read(".lead .wide .first", true)).toEqual({ class: "lead wide first" });
	});

	test("reads shorthands alongside ordinary attributes", () => {
		expect(read('#top .lead type="warning"', true)).toEqual({
			id: "top",
			class: "lead",
			type: "warning",
		});
	});

	test("rejects a shorthand where the caller does not allow one", () => {
		let error = rejected("#top");

		expect(error).toBeInstanceOf(AttributeError);
		expect(error.name).toBe("AttributeError");
		expect(error.message).toBe("Expected an attribute name");
		expect(error.index).toBe(0);
	});

	test("rejects a class shorthand where the caller does not allow one", () => {
		expect(rejected(".lead").index).toBe(0);
	});

	test("stops at the marker a shorthand names nothing after", () => {
		let error = rejected("wide #", true);

		expect(error.message).toBe('Expected a name after "#"');
		expect(error.index).toBe(5);
	});

	test("stops where a name was expected", () => {
		let error = rejected('="warning"');

		expect(error.message).toBe("Expected an attribute name");
		expect(error.index).toBe(0);
	});

	test("stops after the equals sign a value never follows", () => {
		let error = rejected("type=");

		expect(error.message).toBe('Expected a value for "type"');
		expect(error.index).toBe(5);
	});

	test("stops at an unquoted value, which the dialect has no form for", () => {
		expect(rejected("type=warning").index).toBe(5);
	});

	test("stops at a quoted value nothing closes", () => {
		expect(rejected('type="warning').index).toBe(5);
	});

	test("stops at a braced value that is neither a number nor a boolean", () => {
		expect(rejected("type={warning}").index).toBe(5);
	});

	test("stops at a braced value nothing closes", () => {
		expect(rejected("count={42").index).toBe(6);
	});
});

describe("attribute expressions", () => {
	test("reads a braced variable as a variable node located in the list", () => {
		expect(read("src={$cdn}")).toEqual({
			src: {
				type: "variable",
				name: "cdn",
				position: {
					start: { line: 1, column: 6, offset: 5 },
					end: { line: 1, column: 10, offset: 9 },
				},
			},
		});
	});

	test("locates a variable through the caller's mapping", () => {
		let point = (index: number) => ({ line: 4, column: 10 + index, offset: 100 + index });
		let result = unwrap(
			parseAttributeList("src={$cdn}", false, (start, end) => ({
				start: point(start),
				end: point(end),
			})),
		);

		expect(result.src).toMatchObject({ position: { start: { line: 4, column: 15, offset: 105 } } });
	});

	test("reads a braced string and null", () => {
		expect(read('label={"x"} empty={null}')).toEqual({ label: "x", empty: null });
	});

	test("reads an array of literals and variables", () => {
		expect(shape(read('data={[1, "two", true, null, $four]}'))).toEqual({
			data: [1, "two", true, null, { type: "variable", name: "four" }],
		});
	});

	test("reads an object with bare and quoted keys, nested values included", () => {
		expect(shape(read('opts={{ size: "lg", "max-width": 3, rows: [$a, { b: false }], }}'))).toEqual(
			{
				opts: {
					size: "lg",
					"max-width": 3,
					rows: [{ type: "variable", name: "a" }, { b: false }],
				},
			},
		);
	});

	test("reads expressions across lines and inside an annotation", () => {
		expect(shape(read("#top data={[\n  1,\n  $two\n]}", true))).toEqual({
			id: "top",
			data: [1, { type: "variable", name: "two" }],
		});
	});

	test("reads an empty array and an empty object", () => {
		expect(read("a={[]} b={{}}")).toEqual({ a: [], b: {} });
	});

	test("rejects anything beyond a literal or a variable", () => {
		expect(rejected("n={$a + 1}").message).toBe('Expected a value for "n"');
		expect(rejected("n={fn()}").message).toBe('Expected a value for "n"');
		expect(rejected("n={[1 2]}").message).toBe('Expected a value for "n"');
		expect(rejected("n={{a 1}}").message).toBe('Expected a value for "n"');
	});

	test("rejects an object a variable node could be mistaken for", () => {
		let error = rejected('n={{ type: "variable", name: "x" }}');

		expect(error.message).toBe(
			'"type": "variable" is reserved for variables, so write {$x} instead',
		);
		expect(error.index).toBe(2);
	});

	test("stops at a variable with no name", () => {
		expect(rejected("src={$}").index).toBe(4);
	});
});

describe("AttributeError", () => {
	test("carries the index it stopped at, as an error a caller may catch", () => {
		let error = new AttributeError("Expected an attribute name", 4);

		expect(error).toBeInstanceOf(Error);
		expect(error.name).toBe("AttributeError");
		expect(error.message).toBe("Expected an attribute name");
		expect(error.index).toBe(4);
	});
});
