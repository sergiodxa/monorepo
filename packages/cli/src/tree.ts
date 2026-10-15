/**
 * The indexed contract a CLI parses against: every command and group with its path, flag
 * lookup by long name, alias and short alias, and which commands own each flag name. Built once
 * by `createCLI`, so a contract mistake fails at startup instead of on the run that reaches it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ArgumentSpec } from "./argument.js";
import type { Group, Node } from "./command.js";
import type { FlagSpec } from "./flag.js";

import { argumentSpec } from "./argument.js";
import { groupSpec, isGroup } from "./command.js";
import { flagSpec } from "./flag.js";

/** Long names every command answers to, so no flag may take them. */
const RESERVED_NAMES: ReadonlySet<string> = new Set(["help", "version", "progress"]);

/** Short names every command answers to. */
const RESERVED_SHORTS: ReadonlySet<string> = new Set(["h"]);

/** One declared flag with the property its handler reads it as. */
export interface FlagEntry {
	key: string;
	spec: FlagSpec;
}

/** One declared argument with the property its handler reads it as. */
export interface ArgumentEntry {
	key: string;
	spec: ArgumentSpec;
}

/** One command or group in the indexed contract. */
export interface Entry {
	node: Node;
	/** The names typed after the program to reach it; empty for the root. */
	path: readonly string[];
	/** The program name and the path, as the help and every error print it. */
	title: string;
	parent: Entry | undefined;
	/** Members by name; empty for a command. */
	children: ReadonlyMap<string, Entry>;
	arguments: readonly ArgumentEntry[];
	flags: readonly FlagEntry[];
	/** Flags by long name and by alias. */
	longs: ReadonlyMap<string, FlagEntry>;
	shorts: ReadonlyMap<string, FlagEntry>;
	/** Its handler runs tasks, so the help lists `--no-progress`. */
	tasks: boolean;
}

/** The whole indexed contract. */
export interface Tree {
	root: Entry;
	entries: ReadonlyMap<Node, Entry>;
	/** The commands declaring each long name or alias, for naming them in a usage error. */
	owners: ReadonlyMap<string, readonly Entry[]>;
}

/**
 * Indexes `root` under the program `name`.
 *
 * @throws Error When a command or group appears twice in the tree, a flag takes a reserved name
 * (`help`, `version`, `progress`, `-h`) or a name starting with `no-`, two flags of one command
 * share a name, or a variadic argument is not the last one. Each is a contract mistake that
 * would make a command unreachable or ambiguous.
 */
export function buildTree(name: string, root: Group): Tree {
	let entries = new Map<Node, Entry>();
	let owners = new Map<string, Entry[]>();

	/** Indexes one node and everything under it. */
	function visit(node: Node, path: string[], parent: Entry | undefined): Entry {
		if (entries.has(node)) {
			throw new Error(`${[name, ...path].join(" ")} reuses a command already in the tree`);
		}
		let title = [name, ...path].join(" ");
		let children = new Map<string, Entry>();
		let flags: FlagEntry[] = [];
		let longs = new Map<string, FlagEntry>();
		let shorts = new Map<string, FlagEntry>();
		let args: ArgumentEntry[] = [];
		let declaration = isGroup(node) ? groupSpec(node) : node;
		for (let [key, declared] of Object.entries(declaration.flags)) {
			let flag = { key, spec: flagSpec(declared) };
			for (let long of [flag.spec.name, ...flag.spec.aliases]) {
				if (RESERVED_NAMES.has(long) || long.startsWith("no-")) {
					throw new Error(`${title}: --${long} is reserved for every command`);
				}
				if (longs.has(long)) throw new Error(`${title}: two flags are named --${long}`);
				longs.set(long, flag);
			}
			let short = flag.spec.short;
			if (short !== undefined) {
				if (short.length !== 1 || RESERVED_SHORTS.has(short)) {
					throw new Error(`${title}: -${short} must be one character other than h`);
				}
				if (shorts.has(short)) throw new Error(`${title}: two flags are named -${short}`);
				shorts.set(short, flag);
			}
			flags.push(flag);
		}
		let entriesOfArguments = Object.entries(declaration.arguments);
		entriesOfArguments.forEach(([key, declared], index) => {
			let spec = argumentSpec(declared);
			if (spec.variadic && index < entriesOfArguments.length - 1) {
				throw new Error(`${title}: the variadic argument <${key}> must be the last one`);
			}
			args.push({ key, spec });
		});
		let entry: Entry = {
			node,
			path,
			title,
			parent,
			children,
			arguments: args,
			flags,
			longs,
			shorts,
			tasks: declaration.tasks,
		};
		entries.set(node, entry);
		for (let long of longs.keys()) owners.set(long, [...(owners.get(long) ?? []), entry]);
		if (isGroup(node)) {
			for (let [member, child] of Object.entries(groupSpec(node).members)) {
				children.set(member, visit(child, [...path, member], entry));
			}
		}
		return entry;
	}

	return { root: visit(root, [], undefined), entries, owners };
}
