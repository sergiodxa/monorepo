/**
 * Writes a JavaScript value as YAML in the block style, over the same subset the
 * parser reads, so `parse(stringify(value))` returns the value it started from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import { YAMLStringifyError } from "./errors.js";
import { resolvePlain } from "./scalars.js";

/**
 * Settings for one serialization.
 */
export interface StringifyOptions {
	/**
	 * Spaces each nesting level adds. Defaults to 2.
	 */
	indent?: number;
}

/**
 * A value written out: `head` goes on the line its key or dash opens, and `body`
 * carries the lines beneath it.
 */
interface Emitted {
	head: string | null;
	body: string[];
}

/**
 * The escapes a double-quoted scalar spells out, for the control characters that
 * would otherwise be written as a hexadecimal escape.
 */
const ESCAPES: Record<string, string> = {
	"\b": "\\b",
	"\t": "\\t",
	"\n": "\\n",
	"\v": "\\v",
	"\f": "\\f",
	"\r": "\\r",
};

/**
 * The characters a plain scalar may not open with, since YAML reads each of them
 * as the start of something other than text.
 */
const OPENERS = new Set([
	"#",
	"&",
	"*",
	"!",
	"|",
	">",
	"'",
	'"',
	"%",
	"@",
	"`",
	",",
	"[",
	"]",
	"{",
	"}",
	"?",
	":",
]);

/**
 * Writes a value as a YAML document, ending in a line break.
 *
 * Values follow `JSON.stringify`: a `toJSON` method is used when present, an
 * `undefined` object entry is dropped, and an `undefined` array entry becomes
 * `null`. Infinities and `NaN`, which JSON cannot write, become `.inf` and `.nan`.
 *
 * @param value - The value to write
 * @param options - Serialization settings
 * @returns The YAML text, or a failure for a value with no representation
 * @example
 * stringify({ title: "Hello", tags: ["remix"] });
 */
export function stringify(
	value: unknown,
	options?: StringifyOptions,
): Result<string, YAMLStringifyError> {
	let indent = options?.indent ?? 2;

	try {
		let emitted = emit(value, indent, new Set(), "");

		/**
		 * A block scalar standing as the whole document still needs its content indented,
		 * since no key or dash above it supplies the indentation the parser reads it by.
		 */
		let pad = " ".repeat(indent);
		let body = emitted.body.map((line) => (line === "" ? "" : pad + line));
		let lines = emitted.head === null ? emitted.body : [emitted.head, ...body];

		return success(`${lines.join("\n")}\n`);
	} catch (error) {
		if (error instanceof YAMLStringifyError) return failure(error);
		throw error;
	}
}

/**
 * Writes one value, returning the line its parent opens on and the lines below it.
 *
 * @param value - The value to write
 * @param indent - Spaces each nesting level adds
 * @param seen - Objects on the path to here, which a cycle would revisit
 * @param path - Path to this value, for the error a cycle or a bad type reports
 * @returns The value's head line and body lines
 */
function emit(value: unknown, indent: number, seen: Set<object>, path: string): Emitted {
	let resolved = unwrap(value, path);

	if (resolved === null) return { head: "null", body: [] };
	if (typeof resolved === "boolean") return { head: String(resolved), body: [] };
	if (typeof resolved === "number") return { head: writeNumber(resolved), body: [] };
	if (typeof resolved === "string") return writeString(resolved);

	if (seen.has(resolved)) {
		throw new YAMLStringifyError("Converting circular structure to YAML", path);
	}

	seen.add(resolved);
	let emitted = Array.isArray(resolved)
		? writeSequence(resolved, indent, seen, path)
		: writeMapping(resolved as Record<string, unknown>, indent, seen, path);
	seen.delete(resolved);

	return emitted;
}

/**
 * Reduces a value to one the writer handles, applying `toJSON` where a value has it.
 *
 * @param value - The value to reduce
 * @param path - Path to this value, for the error an unwritable type reports
 * @returns The value to write, `null` for one YAML has no notation for
 */
function unwrap(value: unknown, path: string): null | boolean | number | string | object {
	if (value === null || value === undefined) return null;

	if (typeof value === "object" && "toJSON" in value && typeof value.toJSON === "function") {
		return unwrap(value.toJSON() as unknown, path);
	}

	if (typeof value === "bigint") {
		throw new YAMLStringifyError("A bigint has no YAML representation", path);
	}

	if (typeof value === "function" || typeof value === "symbol") return null;
	if (typeof value === "object") return value;

	return value as boolean | number | string;
}

/**
 * Writes a mapping, dropping the entries `JSON.stringify` would drop.
 *
 * @param value - The object to write
 * @param indent - Spaces each nesting level adds
 * @param seen - Objects on the path to here
 * @param path - Path to this object
 * @returns The mapping's lines
 */
function writeMapping(
	value: Record<string, unknown>,
	indent: number,
	seen: Set<object>,
	path: string,
): Emitted {
	let body: string[] = [];
	let pad = " ".repeat(indent);

	for (let [key, entry] of Object.entries(value)) {
		if (entry === undefined || typeof entry === "function" || typeof entry === "symbol") continue;

		let emitted = emit(entry, indent, seen, path === "" ? key : `${path}.${key}`);
		let written = writeKey(key);

		if (emitted.head === null) body.push(`${written}:`);
		else body.push(`${written}: ${emitted.head}`);

		body.push(...emitted.body.map((line) => (line === "" ? "" : pad + line)));
	}

	if (body.length === 0) return { head: "{}", body: [] };
	return { head: null, body };
}

/**
 * Writes a sequence, turning the entries `JSON.stringify` drops into `null`.
 *
 * @param value - The array to write
 * @param indent - Spaces each nesting level adds
 * @param seen - Objects on the path to here
 * @param path - Path to this array
 * @returns The sequence's lines
 */
function writeSequence(value: unknown[], indent: number, seen: Set<object>, path: string): Emitted {
	if (value.length === 0) return { head: "[]", body: [] };

	let body: string[] = [];

	for (let [index, entry] of value.entries()) {
		let emitted = emit(entry, indent, seen, path === "" ? String(index) : `${path}.${index}`);
		let lines = emitted.head === null ? emitted.body : [emitted.head, ...emitted.body];

		/**
		 * Continuation lines line up under the text after the dash, which is what lets a
		 * mapping keep its first key on the dash's own line.
		 */
		for (let [position, line] of lines.entries()) {
			if (position === 0) body.push(`- ${line}`);
			else body.push(line === "" ? "" : `  ${line}`);
		}
	}

	return { head: null, body };
}

/**
 * Writes a number, including the two YAML has notation for and JSON does not.
 *
 * @param value - The number to write
 * @returns The scalar text
 */
function writeNumber(value: number): string {
	if (Number.isNaN(value)) return ".nan";
	if (value === Number.POSITIVE_INFINITY) return ".inf";
	if (value === Number.NEGATIVE_INFINITY) return "-.inf";
	if (Object.is(value, -0)) return "-0.0";

	return String(value);
}

/**
 * Writes a string plain where that reads back unchanged, as a literal block where
 * it spans lines, and quoted otherwise.
 *
 * @param value - The string to write
 * @returns The scalar's head line and, for a block, its content lines
 */
function writeString(value: string): Emitted {
	if (value.includes("\n")) {
		let block = writeBlock(value);
		if (block) return block;
	}

	if (isPlain(value)) return { head: value, body: [] };

	return { head: quote(value), body: [] };
}

/**
 * Writes a multi-line string as a literal block, or answers `null` when a block
 * would not read back as the same text.
 *
 * @param value - The string to write
 * @returns The block's lines, or `null` to leave the string to the quoting path
 */
function writeBlock(value: string): Emitted | null {
	let trailing = /\n*$/.exec(value)?.[0].length ?? 0;
	if (trailing > 1) return null;

	let lines = value.slice(0, value.length - trailing).split("\n");
	let readable = lines.every((line, index) => {
		if (/[\t\r]|\s$/.test(line)) return false;
		return index === 0 ? !line.startsWith(" ") && line !== "" : true;
	});

	if (!readable) return null;

	return { head: trailing === 1 ? "|" : "|-", body: lines };
}

/**
 * Whether a string reads back as itself when written without quotes.
 *
 * @param value - The string to test
 * @returns `true` when the string is safe to write plain
 */
function isPlain(value: string): boolean {
	if (value === "" || value !== value.trim()) return false;
	if (resolvePlain(value) !== value) return false;
	if (value === "---" || value === "...") return false;
	if (/[\n\t\r]/.test(value)) return false;
	if (value.includes(": ") || value.includes(" #") || value.endsWith(":")) return false;
	if (value.startsWith("- ") || value === "-") return false;

	return !OPENERS.has(value[0] ?? "");
}

/**
 * Writes a key, quoting it under the same rules a scalar follows.
 *
 * @param key - The key to write
 * @returns The key's text
 */
function writeKey(key: string): string {
	return isPlain(key) ? key : quote(key);
}

/**
 * Writes a string as a double-quoted scalar, escaping what YAML reads specially.
 *
 * @param value - The string to write
 * @returns The quoted scalar
 */
function quote(value: string): string {
	let escaped = "";

	for (let char of value) {
		let code = char.codePointAt(0) ?? 0;

		if (char === '"' || char === "\\") escaped += `\\${char}`;
		else if (code < 0x20 || code === 0x7f) {
			escaped += ESCAPES[char] ?? `\\x${code.toString(16).padStart(2, "0")}`;
		} else escaped += char;
	}

	return `"${escaped}"`;
}
