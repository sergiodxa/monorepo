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
			end: 20,
		});
	});

	test("reads an annotation that starts part way into the line", () => {
		expect(scanAnnotation("A paragraph. {% wide %}", 13)).toEqual({ body: "wide", end: 23 });
	});

	test("keeps a closing delimiter written inside a quoted value from ending it", () => {
		expect(scanAnnotation('{% title="100%} done" %}', 0)).toEqual({
			body: 'title="100%} done"',
			end: 24,
		});
	});

	test("keeps an escaped quote from ending the value it sits in", () => {
		expect(scanAnnotation('{% a="x\\"y" %}', 0)).toEqual({ body: 'a="x\\"y"', end: 14 });
	});

	test("reads a single-quoted value the same way", () => {
		expect(scanAnnotation("{% a='%} b' %}", 0)).toEqual({ body: "a='%} b'", end: 14 });
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
			selfClosing: false,
			end: 21,
		});
	});

	test("keeps a closing angle bracket written inside a quoted value from ending it", () => {
		expect(scanTagOpen('<callout label="a > b">text', 0)).toEqual({
			name: "callout",
			attributeText: ' label="a > b"',
			selfClosing: false,
			end: 23,
		});
	});

	test("marks an element the source closed on its own line and drops the slash", () => {
		expect(scanTagOpen('<video src="x" />', 0)).toEqual({
			name: "video",
			attributeText: ' src="x" ',
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

describe("AttributeError", () => {
	test("carries the index it stopped at, as an error a caller may catch", () => {
		let error = new AttributeError("Expected an attribute name", 4);

		expect(error).toBeInstanceOf(Error);
		expect(error.name).toBe("AttributeError");
		expect(error.message).toBe("Expected an attribute name");
		expect(error.index).toBe(4);
	});
});
