/**
 * The command contract: `command()` declares what one command takes, and `commands()` groups
 * commands under a name, nesting as deep as the command line does, so `sdxc ui add` is
 * `contract.ui.add`. Declaration runs nothing; `createCLI` maps handlers onto it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Argument, ArgumentValue } from "./argument.js";
import type { Flag, FlagValue } from "./flag.js";

/** Brands a declared command. */
const COMMAND = Symbol.for("@sdxc/cli.command");

/** Brands a declared group. */
const GROUP = Symbol.for("@sdxc/cli.group");

/** A command's positional arguments, filled in key order. */
export type ArgumentsShape = Readonly<Record<string, Argument>>;

/** A command's flags, keyed by the property its handler reads. */
export type FlagsShape = Readonly<Record<string, Flag>>;

/** What one command declares. */
export interface CommandDefinition<
	Arguments extends ArgumentsShape = ArgumentsShape,
	Flags extends FlagsShape = FlagsShape,
> {
	/** One line, shown in the help and in the parent group's command list. */
	description?: string;
	arguments?: Arguments;
	flags?: Flags;
	/** Command lines the help lists under "Examples", written without the program name. */
	examples?: readonly string[];
	/** Left out of the parent group's command list; it still runs. */
	hidden?: boolean;
}

/** A declared command. */
export interface Command<
	Arguments extends ArgumentsShape = ArgumentsShape,
	Flags extends FlagsShape = FlagsShape,
> {
	readonly [COMMAND]: true;
	readonly description: string | undefined;
	readonly arguments: Arguments;
	readonly flags: Flags;
	readonly examples: readonly string[];
	readonly hidden: boolean;
}

/** What a group holds besides its members. */
export interface GroupSpec {
	description: string | undefined;
	hidden: boolean;
	/** The members, keyed by the name typed on the command line. */
	members: Readonly<Record<string, Command | Group>>;
}

/** A declared group: its members, reachable by name, plus the brand carrying its spec. */
export type Group<Members = Readonly<Record<string, unknown>>> = Members & {
	readonly [GROUP]: GroupSpec;
};

/** What `commands()` takes: members keyed by name, plus the group's own description. */
export interface GroupDefinition {
	/** One line, shown in the help and in the parent group's command list. */
	readonly description?: string;
	/** Left out of the parent group's command list; it still runs. */
	readonly hidden?: boolean;
	readonly [name: string]: Command | Group | string | boolean | undefined;
}

/** A declared command or group, as the parser walks them. */
export type Node = Command | Group;

/**
 * Declares one command.
 *
 * @example
 * command({
 * 	description: "Copy components into the project",
 * 	arguments: { components: argument.variadic(s.string(), { min: 1 }) },
 * 	flags: { dryRun: flag.boolean("dry-run") },
 * })
 */
export function command<
	const Arguments extends ArgumentsShape = Record<never, never>,
	const Flags extends FlagsShape = Record<never, never>,
>(definition: CommandDefinition<Arguments, Flags> = {}): Command<Arguments, Flags> {
	return {
		[COMMAND]: true,
		description: definition.description,
		arguments: definition.arguments ?? ({} as Arguments),
		flags: definition.flags ?? ({} as Flags),
		examples: definition.examples ?? [],
		hidden: definition.hidden === true,
	};
}

/**
 * Groups commands, and other groups, under the names typed on the command line. `description`
 * and `hidden` describe the group itself and are never members.
 *
 * @example export let sdxc = commands({ init: command({}), ui: commands({ description: "…", add }) });
 */
export function commands<const Definition extends GroupDefinition>(
	definition: Definition,
): Group<Omit<Definition, "description" | "hidden">> {
	let members: Record<string, Command | Group> = {};
	for (let [name, member] of Object.entries(definition)) {
		if (name === "description" || name === "hidden") continue;
		if (isCommand(member) || isGroup(member)) members[name] = member;
	}
	let spec: GroupSpec = {
		description: definition.description,
		hidden: definition.hidden === true,
		members,
	};
	return { ...members, [GROUP]: spec } as unknown as Group<
		Omit<Definition, "description" | "hidden">
	>;
}

/** Whether `value` is a declared command. */
export function isCommand(value: unknown): value is Command {
	return typeof value === "object" && value !== null && COMMAND in value;
}

/** Whether `value` is a declared group. */
export function isGroup(value: unknown): value is Group {
	return typeof value === "object" && value !== null && GROUP in value;
}

/** The spec behind a group. */
export function groupSpec(group: Group): GroupSpec {
	return group[GROUP];
}

/** What `ctx.arguments` holds for a command: each argument's parsed value by key. */
export type ArgumentsOf<Target> =
	Target extends Command<infer Arguments, FlagsShape>
		? { readonly [Key in keyof Arguments]: ArgumentValue<Arguments[Key]> }
		: Readonly<Record<never, never>>;

/** What `ctx.flags` holds for a command: each flag's parsed value by key. */
export type FlagsOf<Target> =
	Target extends Command<ArgumentsShape, infer Flags>
		? { readonly [Key in keyof Flags]: FlagValue<Flags[Key]> }
		: Readonly<Record<never, never>>;
