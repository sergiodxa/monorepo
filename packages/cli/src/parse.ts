/**
 * Splits an argument vector into the command it names, its positionals and every flag
 * occurrence, against the indexed contract. Every problem is collected rather than stopping at
 * the first, so one usage error lists all of them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Entry, FlagEntry, Tree } from "./tree.js";

import { isGroup } from "./command.js";
import { closest } from "./suggest.js";

/** One appearance of a flag on the command line. */
export interface Occurrence {
	/** The text after `=` or the next token; `true` for a boolean or a bare optional value. */
	value: string | true;
	/** Written as `--no-<name>`. */
	negated: boolean;
	/** The flag as typed, `--allow-net` or `-f`, for error messages. */
	spelled: string;
}

/** What one argument vector asks for. */
export interface Parsed {
	/** The command or group it reaches. */
	entry: Entry;
	help: boolean;
	version: boolean;
	/** `--no-progress`: tasks print without animation. */
	noProgress: boolean;
	positionals: string[];
	/** Occurrences by the flag's key, in command-line order. */
	occurrences: Map<string, Occurrence[]>;
	issues: string[];
}

/** A token that starts a flag: a dash and something after it, other than a negative number. */
function isFlagToken(token: string): boolean {
	return token.startsWith("-") && token !== "-" && !/^-\d/.test(token);
}

/**
 * Parses `argv` against `tree`. Combined short flags (`-xvf`) are read as one unknown name.
 *
 * @param withVersion - Whether `--version` is answered, which it is only at the root of a CLI
 * that declares a version
 */
export function parseArgv(tree: Tree, argv: readonly string[], withVersion: boolean): Parsed {
	let parsed: Parsed = {
		entry: tree.root,
		help: false,
		version: false,
		noProgress: false,
		positionals: [],
		occurrences: new Map(),
		issues: [],
	};
	let index = 0;
	let rest = false;
	/** Flag tokens read at a group, replayed against the member the command line goes on to name. */
	let atGroup: string[] = [];
	/** How many issues stood before the current group's flags were read. */
	let groupIssues = 0;

	/** Records a global flag, answering whether `token` was one. */
	function global(token: string): boolean {
		if (token === "--help" || token === "-h") parsed.help = true;
		else if (token === "--no-progress") parsed.noProgress = true;
		else if (token === "--version" && withVersion && parsed.entry === tree.root) {
			parsed.version = true;
		} else return false;
		return true;
	}

	while (index < argv.length) {
		let token = argv[index] as string;
		index += 1;
		if (rest) {
			parsed.positionals.push(token);
			continue;
		}
		if (token === "--") {
			rest = true;
			continue;
		}
		if (isFlagToken(token)) {
			if (global(token)) continue;
			let start = index - 1;
			index = readFlag(tree, parsed, argv, index, token);
			if (isGroup(parsed.entry.node)) atGroup.push(...argv.slice(start, index));
			continue;
		}
		if (isGroup(parsed.entry.node) && parsed.positionals.length === 0) {
			let child = parsed.entry.children.get(token);
			if (child === undefined && parsed.entry.arguments.length > 0) {
				parsed.positionals.push(token);
				continue;
			}
			if (child === undefined) {
				let suggestion = closest(token, parsed.entry.children.keys());
				let hint = suggestion === undefined ? "" : `; did you mean "${suggestion}"?`;
				parsed.issues.push(`Unknown command "${token}" for ${parsed.entry.title}${hint}`);
				for (let remaining of argv.slice(index)) {
					if (remaining === "--help" || remaining === "-h") parsed.help = true;
				}
				return parsed;
			}
			parsed.entry = child;
			parsed.issues.length = groupIssues;
			replay(tree, parsed, atGroup);
			groupIssues = parsed.issues.length;
			if (child.rest) rest = true;
			continue;
		}
		parsed.positionals.push(token);
	}
	if (
		rest &&
		isGroup(parsed.entry.node) &&
		parsed.entry.arguments.length === 0 &&
		parsed.positionals.length > 0
	) {
		parsed.issues.push(`Unknown command "${parsed.positionals[0]}" for ${parsed.entry.title}`);
	}
	return parsed;
}

/**
 * Re-reads the flag tokens written before a member's name against that member, so
 * `prog make --dry-run job` reaches `job`'s `--dry-run` and a group's flag the member lacks is
 * reported as unknown to it. The caller drops what the group's own reading recorded.
 */
function replay(tree: Tree, parsed: Parsed, tokens: string[]): void {
	let replayed = tokens.splice(0);
	parsed.occurrences = new Map();
	let index = 0;
	while (index < replayed.length) {
		let token = replayed[index] as string;
		index = readFlag(tree, parsed, replayed, index + 1, token);
	}
}

/** Reads one flag token of a command, answering the index after any value it consumed. */
function readFlag(
	tree: Tree,
	parsed: Parsed,
	argv: readonly string[],
	index: number,
	token: string,
): number {
	let long = token.startsWith("--");
	let body = token.slice(long ? 2 : 1);
	let separator = body.indexOf("=");
	let name = separator === -1 ? body : body.slice(0, separator);
	let inline = separator === -1 ? undefined : body.slice(separator + 1);
	let spelled = `${long ? "--" : "-"}${name}`;
	let entry = parsed.entry;
	let negated = false;
	let flag: FlagEntry | undefined = long ? entry.longs.get(name) : entry.shorts.get(name);
	if (flag === undefined && long && name.startsWith("no-")) {
		let positive = entry.longs.get(name.slice(3));
		if (positive?.spec.kind === "boolean") {
			flag = positive;
			negated = true;
		}
	}
	if (flag === undefined) {
		parsed.issues.push(unknownFlag(tree, entry, token));
		return inline === undefined && ownersTakeValue(tree, long ? name : "")
			? skipValue(argv, index)
			: index;
	}
	let list = parsed.occurrences.get(flag.key) ?? [];
	parsed.occurrences.set(flag.key, list);
	if (flag.spec.kind === "boolean") {
		if (inline !== undefined) parsed.issues.push(`${spelled} takes no value`);
		else list.push({ value: true, negated, spelled });
		return index;
	}
	if (inline === "") {
		parsed.issues.push(`${spelled} needs a value`);
		return index;
	}
	if (inline !== undefined) {
		list.push({ value: inline, negated: false, spelled });
		return index;
	}
	if (flag.spec.optionalValue) {
		list.push({ value: true, negated: false, spelled });
		return index;
	}
	let next = argv[index];
	if (next === undefined || isFlagToken(next) || next === "--") {
		parsed.issues.push(`${spelled} needs a value`);
		return index;
	}
	list.push({ value: next, negated: false, spelled });
	return index + 1;
}

/**
 * Whether every command declaring `--<name>` reads a value after it, so the word following a
 * misplaced `--cron "0 8 * * *"` is its value rather than a second, unexpected argument.
 */
function ownersTakeValue(tree: Tree, name: string): boolean {
	let owners = tree.owners.get(name) ?? [];
	return (
		owners.length > 0 &&
		owners.every((owner) => {
			let spec = owner.longs.get(name)?.spec;
			return spec !== undefined && spec.kind !== "boolean" && !spec.optionalValue;
		})
	);
}

/** The index after the value at `index`, or `index` when the next token is no value. */
function skipValue(argv: readonly string[], index: number): number {
	let next = argv[index];
	return next === undefined || isFlagToken(next) || next === "--" ? index : index + 1;
}

/**
 * The message for a flag `entry` does not declare: the commands that do declare it, or the
 * closest name it does declare.
 */
function unknownFlag(tree: Tree, entry: Entry, token: string): string {
	let long = token.startsWith("--");
	let body = token.slice(long ? 2 : 1);
	let name = body.split("=")[0] as string;
	let spelled = `${long ? "--" : "-"}${name}`;
	let positive = name.startsWith("no-") ? name.slice(3) : name;
	let owners = long ? (tree.owners.get(name) ?? tree.owners.get(positive) ?? []) : [];
	if (owners.length > 0) {
		let titles = owners.map((owner) => owner.title);
		let listed =
			titles.length === 1
				? (titles[0] as string)
				: `${titles.slice(0, -1).join(", ")} and ${titles.at(-1) as string}`;
		return `${spelled} is not a flag of ${entry.title}; ${listed} ${titles.length === 1 ? "takes" : "take"} it`;
	}
	let candidates: string[] = [];
	if (long) {
		for (let flag of entry.flags) {
			candidates.push(flag.spec.name, ...flag.spec.aliases);
			if (flag.spec.kind === "boolean") candidates.push(`no-${flag.spec.name}`);
		}
		candidates.push("help");
	}
	let suggestion = long ? closest(name, candidates) : undefined;
	let hint = suggestion === undefined ? "" : `; did you mean --${suggestion}?`;
	return `Unknown flag ${spelled}${hint}`;
}
