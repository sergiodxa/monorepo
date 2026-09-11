/**
 * The built-in `str` capability: string composition, which the language has no
 * operator for. `str.format` fills `${…}` holes in a template from the call's
 * arguments — positional by index or named by key — and is strict about the
 * pairing, so a template and its arguments cannot drift apart silently. Pure
 * computation over its arguments, so it needs no permission grant.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { SpecError } from "../errors.js";
import type { Plugin, ToolDescriptor } from "../plugin.js";
import type { ToolArg, Value, ValueObject } from "../values.js";

import { ToolError } from "../errors.js";
import { formatValue } from "../values.js";

/** Descriptors of every tool the `str` namespace exposes. */
const DESCRIPTORS: ToolDescriptor[] = [
	{
		name: "format",
		summary: "Fill a template's ${…} holes from positional arguments or one named object.",
		kind: "action",
		params: [
			{
				name: "template",
				kind: "value",
				required: true,
				summary:
					'The template string; holes are ${0} by index or ${name} by key, and "{{" writes a literal "${".',
			},
			{
				name: "values",
				kind: "value",
				required: false,
				summary:
					"One value per positional hole, in index order, or a single object keyed by the named holes.",
			},
		],
	},
];

/** One piece of a parsed template: literal text, or a hole to fill. */
type Segment = { kind: "text"; text: string } | { kind: "hole"; name: string };

/**
 * Create the built-in `str` plugin (namespace `"str"`): a single `format`
 * tool that returns the filled template, or a {@link ToolError} naming the
 * template and the offending hole, argument or key.
 */
export function createStrPlugin(): Plugin {
	return {
		namespace: "str",
		describe() {
			return DESCRIPTORS;
		},
		async call(tool, args) {
			if (tool !== "format") {
				return failure(new ToolError(`str has no tool "${tool}"; available tools: format`));
			}
			return format(args);
		},
	};
}

/**
 * `str.format <template> <values…>` → the filled string. Holes are matched to
 * arguments exactly: every hole is filled and every argument is used, or the
 * call fails rather than composing a half-written value.
 */
function format(args: ToolArg[]): Result<Value, SpecError> {
	let template = readTemplate(args);
	if (isFailure(template)) return template;
	let values = readValues(template.data, args.slice(1));
	if (isFailure(values)) return values;
	let segments = parseTemplate(template.data);
	if (isFailure(segments)) return segments;

	let holes = segments.data.filter((segment) => segment.kind === "hole").map((hole) => hole.name);
	let positional = holes.filter(isIndex);
	if (positional.length > 0 && positional.length < holes.length) {
		return failure(
			new ToolError(
				`str.format cannot mix positional and named holes; the template ${quote(template.data)} has both ${hole(positional[0] ?? "")} and ${hole(holes.find((name) => !isIndex(name)) ?? "")}`,
			),
		);
	}

	let filled =
		positional.length === holes.length
			? fillByIndex(template.data, holes, values.data)
			: fillByKey(template.data, holes, values.data);
	if (isFailure(filled)) return filled;
	return success(write(segments.data, filled.data));
}

/**
 * Split a template into literal text and holes. `{{` writes the two characters
 * `${`, which is how a spec puts a hole's own notation in the output; a `$`
 * that no `{` follows is ordinary text and needs no escape.
 */
function parseTemplate(template: string): Result<Segment[], SpecError> {
	let segments: Segment[] = [];
	let text = "";
	let index = 0;
	while (index < template.length) {
		if (template.startsWith("{{", index)) {
			text += "${";
			index += 2;
			continue;
		}
		if (template.startsWith("${", index)) {
			let close = template.indexOf("}", index + 2);
			if (close === -1) {
				return failure(
					new ToolError(
						`str.format found an unclosed hole in the template ${quote(template)}; a hole opened with "\${" ends at "}"`,
					),
				);
			}
			let name = template.slice(index + 2, close);
			if (name === "") {
				return failure(
					new ToolError(
						`str.format found an empty hole "\${}" in the template ${quote(template)}; a hole names an argument index or an object key`,
					),
				);
			}
			if (text !== "") segments.push({ kind: "text", text });
			text = "";
			segments.push({ kind: "hole", name });
			index = close + 1;
			continue;
		}
		text += template[index];
		index += 1;
	}
	if (text !== "") segments.push({ kind: "text", text });
	return success(segments);
}

/** Pair positional holes with the call's remaining arguments, by index. */
function fillByIndex(
	template: string,
	holes: string[],
	values: Value[],
): Result<Map<string, string>, SpecError> {
	let filled = new Map<string, string>();
	for (let name of holes) {
		let value = values[Number(name)];
		if (value === undefined) {
			return failure(missingValue(template, name));
		}
		let text = stringify(template, name, value);
		if (isFailure(text)) return text;
		filled.set(name, text.data);
	}
	for (let [index, value] of values.entries()) {
		if (holes.includes(String(index))) continue;
		return failure(
			new ToolError(
				`str.format was given an argument no hole uses; the template ${quote(template)} has no hole ${hole(String(index))} for argument ${index + 2}, ${formatValue(value)}`,
			),
		);
	}
	return success(filled);
}

/** Pair named holes with the keys of the call's single object argument. */
function fillByKey(
	template: string,
	holes: string[],
	values: Value[],
): Result<Map<string, string>, SpecError> {
	if (values.length === 0) {
		let first = holes[0];
		if (first === undefined) return success(new Map());
		return failure(missingValue(template, first));
	}
	if (values.length > 1) {
		return failure(
			new ToolError(
				`str.format takes one object argument for a template with named holes; the template ${quote(template)} was given ${values.length} arguments`,
			),
		);
	}
	let object = values[0];
	if (typeof object !== "object" || object === null || Array.isArray(object)) {
		return failure(
			new ToolError(
				`str.format takes one object argument for a template with named holes; the template ${quote(template)} was given ${formatValue(object ?? null)}`,
			),
		);
	}
	let named: ValueObject = object;
	let filled = new Map<string, string>();
	for (let name of holes) {
		let value = named[name];
		if (value === undefined) return failure(missingValue(template, name));
		let text = stringify(template, name, value);
		if (isFailure(text)) return text;
		filled.set(name, text.data);
	}
	for (let key of Object.keys(named)) {
		if (holes.includes(key)) continue;
		return failure(
			new ToolError(
				`str.format was given a key no hole uses; the template ${quote(template)} has no hole for the key "${key}"`,
			),
		);
	}
	return success(filled);
}

/** Join the parsed segments, substituting each hole's rendered text. */
function write(segments: Segment[], filled: Map<string, string>): string {
	let output = "";
	for (let segment of segments) {
		output += segment.kind === "text" ? segment.text : (filled.get(segment.name) ?? "");
	}
	return output;
}

/**
 * Render one value as JSON would without its quotes. `null`, arrays and
 * objects have no such form, so they fail here rather than writing the text
 * `null` into a URL a later assertion would then read as real.
 */
function stringify(template: string, name: string, value: Value): Result<string, SpecError> {
	if (typeof value === "string") return success(value);
	if (typeof value === "number" && Number.isFinite(value)) return success(String(value));
	if (typeof value === "boolean") return success(value ? "true" : "false");
	return failure(
		new ToolError(
			`str.format cannot write ${formatValue(value)} into the hole ${hole(name)} of the template ${quote(template)}; only strings, numbers and booleans have a text form`,
		),
	);
}

/** Validate the first argument, the template itself. */
function readTemplate(args: ToolArg[]): Result<string, SpecError> {
	let first = args[0];
	if (first === undefined || first.kind !== "value" || typeof first.value !== "string") {
		return failure(new ToolError("str.format requires its first argument to be a template string"));
	}
	return success(first.value);
}

/** Validate the remaining arguments: values only, never bare words. */
function readValues(template: string, rest: ToolArg[]): Result<Value[], SpecError> {
	let values: Value[] = [];
	for (let [index, argument] of rest.entries()) {
		if (argument.kind === "word") {
			return failure(
				new ToolError(
					`str.format fills the template ${quote(template)} from values; argument ${index + 2} is the bare word "${argument.word}"`,
				),
			);
		}
		values.push(argument.value);
	}
	return success(values);
}

function missingValue(template: string, name: string): SpecError {
	return new ToolError(
		`str.format found no value for the hole ${hole(name)} in the template ${quote(template)}`,
	);
}

/** Whether a hole names an argument position rather than an object key. */
function isIndex(name: string): boolean {
	return /^\d+$/.test(name);
}

/** A hole as it is written in the template, for a diagnostic to quote back. */
function hole(name: string): string {
	return `"\${${name}}"`;
}

function quote(template: string): string {
	return JSON.stringify(template);
}
