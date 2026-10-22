/**
 * Help rendered from the contract: the usage line, the description, the subcommands, the
 * arguments, then the flags with their value names and defaults, under their headings. Every `--help` and every usage
 * error prints it, so the text and what the parser accepts come from one declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { iife } from "@sdxc/iife";

import type { FlagSpec } from "./flag.js";
import type { Style } from "./style.js";
import type { Entry } from "./tree.js";

import { groupSpec, isGroup } from "./command.js";
import { visibleWidth } from "./style.js";

/** What the help knows about the program beyond the contract. */
export interface HelpProgram {
	version: string | undefined;
	/** Shown at the root when the root group has no description of its own. */
	description: string | undefined;
}

/** One row of a two-column section. */
type Row = readonly [left: string, right: string];

/** Renders `entry`'s help, ending with a newline. */
export function renderHelp(entry: Entry, program: HelpProgram, style: Style): string {
	let node = entry.node;
	let sections: string[] = [];
	let lines: string[] = [];
	if (isGroup(node)) lines.push(`${entry.title} <command> [options]`);
	if (!isGroup(node) || entry.arguments.length > 0 || entry.flags.length > 0) {
		let usage = [entry.title];
		for (let argument of entry.arguments) usage.push(argumentLabel(argument.key, argument.spec));
		usage.push("[options]");
		lines.push(usage.join(" "));
	}
	let indent = " ".repeat("Usage: ".length);
	sections.push(`${style.bold("Usage:")} ${lines.join(`\n${indent}`)}`);

	let description = isGroup(node) ? groupSpec(node).description : node.description;
	if (entry.parent === undefined) description ??= program.description;
	if (description !== undefined) sections.push(description);

	if (isGroup(node)) {
		let rows: Row[] = [];
		for (let [name, child] of entry.children) {
			let spec = isGroup(child.node) ? groupSpec(child.node) : child.node;
			if (spec.hidden) continue;
			rows.push([name, spec.description ?? ""]);
		}
		sections.push(section("Commands:", rows, style));
	}

	if (entry.arguments.length > 0) {
		let rows: Row[] = entry.arguments.map(({ key, spec }) => {
			let notes = spec.description ?? "";
			if (spec.hasDefault) notes = withDefault(notes, spec.default);
			return [argumentLabel(key, spec), notes];
		});
		sections.push(section("Arguments:", rows, style));
	}

	let headings = new Map<string, Row[]>([["Options", []]]);
	for (let { spec } of entry.flags) {
		if (spec.hidden) continue;
		let heading = spec.heading ?? "Options";
		let rows = headings.get(heading) ?? [];
		headings.set(heading, rows);
		rows.push([flagLabel(spec), flagNotes(spec)]);
	}
	let builtins = headings.get("Options") as Row[];
	if (entry.tasks) builtins.push(["--no-progress", "Print tasks without animation"]);
	if (program.version !== undefined && entry.parent === undefined) {
		builtins.push(["--version", "Print the version"]);
	}
	builtins.push(["-h, --help", "Show this help"]);
	for (let [heading, rows] of headings) sections.push(section(`${heading}:`, rows, style));

	if (!isGroup(node) && node.examples.length > 0) {
		let program = entry.title.split(" ")[0] as string;
		let lines = node.examples.map((example) => `  ${program} ${example}`);
		sections.push(`${style.bold("Examples:")}\n${lines.join("\n")}`);
	}
	return `${sections.join("\n\n")}\n`;
}

/** A titled section of aligned rows, flag and command names styled. */
function section(title: string, rows: readonly Row[], style: Style): string {
	let width = Math.max(0, ...rows.map(([left]) => visibleWidth(left)));
	let lines = rows.map(([left, right]) => {
		let padded = left + " ".repeat(width - visibleWidth(left));
		return right === "" ? `  ${style.cyan(left)}` : `  ${style.cyan(padded)}  ${right}`;
	});
	return `${style.bold(title)}\n${lines.join("\n")}`;
}

/** `<name>`, `[name]` or `<name...>`, as the usage line writes an argument. */
function argumentLabel(
	key: string,
	spec: { variadic: boolean; min: number; valueName: string | undefined },
): string {
	let name = spec.valueName ?? key;
	if (spec.variadic) return spec.min > 0 ? `<${name}...>` : `[${name}...]`;
	return spec.min > 0 ? `<${name}>` : `[${name}]`;
}

/**
 * The left column for one flag: its short alias, its names, and its value. A boolean shows the
 * spelling that changes something: `--name` when it defaults to false, `--no-name` when it
 * defaults to true, and `--[no-]name` when it asks or is left unset.
 */
function flagLabel(spec: FlagSpec): string {
	let names: string[] = [];
	if (spec.short !== undefined) names.push(`-${spec.short}`);
	if (spec.kind === "boolean") {
		let prefix = iife(() => {
			if (spec.prompt !== undefined || spec.default === undefined) return "[no-]";
			if (spec.default === true) return "no-";
			return "";
		});
		names.push(`--${prefix}${spec.name}`);
		for (let alias of spec.aliases) names.push(`--${prefix}${alias}`);
		return names.join(", ");
	}
	for (let name of [spec.name, ...spec.aliases]) names.push(`--${name}`);
	let value = spec.valueName ?? (spec.kind === "number" ? "number" : "value");
	if (spec.list) value = `${value},...`;
	let label = names.join(", ");
	return spec.optionalValue ? `${label}[=<${value}>]` : `${label} <${value}>`;
}

/** The right column for one flag: its description, whether it repeats, and its default. */
function flagNotes(spec: FlagSpec): string {
	let notes = spec.description ?? "";
	if (spec.multiple) notes = `${notes} (repeatable)`.trim();
	if (spec.required && spec.prompt === undefined) notes = `${notes} (required)`.trim();
	if (spec.kind !== "boolean" && spec.hasDefault) notes = withDefault(notes, spec.default);
	return notes;
}

/** A default value as the help prints it. */
function display(value: unknown): string {
	return typeof value === "string" ? value : JSON.stringify(value);
}

/** `notes` with the default appended, when there is one worth showing. */
function withDefault(notes: string, value: unknown): string {
	if (value === undefined || (Array.isArray(value) && value.length === 0)) return notes;
	let shown = Array.isArray(value) ? value.map(display).join(",") : display(value);
	return `${notes} (default: ${shown})`.trim();
}
