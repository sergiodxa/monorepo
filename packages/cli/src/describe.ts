/**
 * The contract as plain data: every command with its arguments, flags and examples, the same
 * facts the help prints. `--help --json` prints it, and a tool reads it to check what a script,
 * a guide or an agent passes against what the program accepts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { FlagKind, FlagSpec } from "./flag.js";
import type { Entry } from "./tree.js";

import { groupSpec, isGroup } from "./command.js";

/** One argument of a command, in the order the command line takes them. */
export interface ArgumentDescription {
	name: string;
	description: string | null;
	/** A value is needed; a missing one is asked for on a terminal when the argument prompts. */
	required: boolean;
	/** Takes every remaining positional. */
	variadic: boolean;
	/** Takes every token after the command's name unparsed, flags included. */
	rest: boolean;
	/** The default, when one is declared. */
	default?: unknown;
}

/** One flag of a command, or one every command answers to (`builtin`). */
export interface FlagDescription {
	/** The long name, written `--<name>`. */
	name: string;
	aliases: string[];
	/** The one-character alias, written `-<short>`. */
	short: string | null;
	kind: FlagKind;
	/** A boolean's `--no-<name>` spelling is accepted. */
	negatable: boolean;
	/** What the help shows in `<…>` after the flag; `null` for a boolean. */
	value: string | null;
	/** The flag may appear bare or with `=value`. */
	optionalValue: boolean;
	/** One value holds several, separated by commas. */
	list: boolean;
	/** Repeating the flag collects every value. */
	repeatable: boolean;
	required: boolean;
	description: string | null;
	/** Answered by every command the program runs: `--help`, `--version`, `--no-progress`. */
	builtin: boolean;
	/** The default, when one is declared. */
	default?: unknown;
}

/** One command or group, with every visible member below it. */
export interface CommandDescription {
	/** The words typed after the program to reach it; empty for the root. */
	path: string[];
	/** The program name and the path, as the help prints it. */
	title: string;
	description: string | null;
	arguments: ArgumentDescription[];
	flags: FlagDescription[];
	/** Example command lines, each starting with the program name. */
	examples: string[];
	/** Members of a group by name; empty for a command. */
	commands: CommandDescription[];
}

/** The program's own facts the description includes beside the contract. */
export interface DescribeProgram {
	version: string | undefined;
	description: string | undefined;
}

/**
 * Describes `entry` and every visible member under it. Hidden commands and flags stay out, as
 * they do from the help.
 */
export function describeEntry(entry: Entry, program: DescribeProgram): CommandDescription {
	let node = entry.node;
	let spec = isGroup(node) ? groupSpec(node) : node;
	let description =
		spec.description ?? (entry.parent === undefined ? program.description : undefined);
	let flags = entry.flags.filter(({ spec }) => !spec.hidden).map(({ spec }) => describeFlag(spec));
	if (entry.tasks) flags.push(builtin("progress", "Print tasks without animation", true));
	if (program.version !== undefined && entry.parent === undefined) {
		flags.push(builtin("version", "Print the version", false));
	}
	flags.push({ ...builtin("help", "Show this help", false), short: "h" });

	let programName = entry.title.split(" ")[0] as string;
	let commands: CommandDescription[] = [];
	for (let child of entry.children.values()) {
		let childSpec = isGroup(child.node) ? groupSpec(child.node) : child.node;
		if (childSpec.hidden) continue;
		commands.push(describeEntry(child, program));
	}
	return {
		path: [...entry.path],
		title: entry.title,
		description: description ?? null,
		arguments: entry.arguments.map(({ key, spec }) => ({
			name: spec.valueName ?? key,
			description: spec.description ?? null,
			required: !spec.optional && !spec.hasDefault && (spec.variadic ? spec.min > 0 : true),
			variadic: spec.variadic,
			rest: spec.rest,
			...(spec.hasDefault ? { default: spec.default } : {}),
		})),
		flags,
		examples: isGroup(node) ? [] : node.examples.map((example) => `${programName} ${example}`),
		commands,
	};
}

/** A declared flag as data. */
function describeFlag(spec: FlagSpec): FlagDescription {
	let boolean = spec.kind === "boolean";
	return {
		name: spec.name,
		aliases: [...spec.aliases],
		short: spec.short ?? null,
		kind: spec.kind,
		negatable: boolean,
		value: boolean ? null : (spec.valueName ?? (spec.kind === "number" ? "number" : "value")),
		optionalValue: spec.optionalValue,
		list: spec.list,
		repeatable: spec.multiple,
		required: spec.required && spec.prompt === undefined,
		description: spec.description ?? null,
		builtin: false,
		...(spec.hasDefault && spec.default !== undefined ? { default: spec.default } : {}),
	};
}

/**
 * A flag the runtime answers for every command. `--no-progress` is the one spelled negated, so
 * its name is `progress` and it is negatable.
 */
function builtin(name: string, description: string, negatable: boolean): FlagDescription {
	return {
		name,
		aliases: [],
		short: null,
		kind: "boolean",
		negatable,
		value: null,
		optionalValue: false,
		list: false,
		repeatable: false,
		required: false,
		description,
		builtin: true,
	};
}
