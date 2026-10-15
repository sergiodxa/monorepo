/**
 * The command contract: `command()` declares what one command takes, and `commands()` groups
 * commands under a name, nesting as deep as the command line does, so `sdxc ui add` is
 * `contract.ui.add`. Declaration runs nothing; `createCLI` maps handlers onto it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Argument, ArgumentValue } from "./argument.js";
import type { Carried, Flag, FlagValue } from "./flag.js";

/** Brands a declared command. */
const COMMAND = Symbol.for("@sdxc/cli.command");

/** Brands a declared group. */
const GROUP = Symbol.for("@sdxc/cli.group");

/** Type-only slot carrying the inputs a group declares for its own handler. */
declare const INPUTS: unique symbol;

/** Keys of `commands()`' definition that describe the group instead of naming a member. */
type GroupOwnKey = "description" | "hidden" | "arguments" | "flags" | "tasks";

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
	/** Its handler runs `ctx.task`, so the help lists `--no-progress`. */
	tasks?: boolean;
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
	readonly tasks: boolean;
}

/** What a group holds besides its members. */
export interface GroupSpec {
	description: string | undefined;
	hidden: boolean;
	tasks: boolean;
	/** The members, keyed by the name typed on the command line. */
	members: Readonly<Record<string, Command | Group>>;
	/** What the group's own handler reads when the command line names no member. */
	arguments: ArgumentsShape;
	flags: FlagsShape;
}

/** What a group's own handler reads, carried for `ctx.arguments` and `ctx.flags`. */
export interface GroupInputs<Arguments extends ArgumentsShape, Flags extends FlagsShape> {
	arguments: Arguments;
	flags: Flags;
}

/** A declared group: its members, reachable by name, plus the brand carrying its spec. */
export type Group<
	Members = Readonly<Record<string, unknown>>,
	Arguments extends ArgumentsShape = ArgumentsShape,
	Flags extends FlagsShape = FlagsShape,
> = Members & {
	readonly [GROUP]: GroupSpec;
	readonly [INPUTS]?: Carried<GroupInputs<Arguments, Flags>>;
};

/**
 * What `commands()` takes: members keyed by name, plus the group's own description and the
 * inputs its handler reads when the command line names no member.
 */
export interface GroupDefinition {
	/** One line, shown in the help and in the parent group's command list. */
	readonly description?: string;
	/** Left out of the parent group's command list; it still runs. */
	readonly hidden?: boolean;
	/**
	 * Read by the group's mapped handler. A word that names no member fills them, and one the
	 * first argument rejects is reported as an unknown command.
	 */
	readonly arguments?: ArgumentsShape;
	/** Read by the group's mapped handler; one written before a member's name moves to that member. */
	readonly flags?: FlagsShape;
	/** The group's handler runs `ctx.task`, so its help lists `--no-progress`. */
	readonly tasks?: boolean;
	readonly [name: string]:
		| Command
		| Group
		| ArgumentsShape
		| FlagsShape
		| string
		| boolean
		| undefined;
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
		tasks: definition.tasks === true,
	};
}

/** The arguments a group definition declares for its own handler, or none. */
type DeclaredArguments<Definition> = Definition extends {
	readonly arguments: infer Shape extends ArgumentsShape;
}
	? Shape
	: Record<never, never>;

/** The flags a group definition declares for its own handler, or none. */
type DeclaredFlags<Definition> = Definition extends {
	readonly flags: infer Shape extends FlagsShape;
}
	? Shape
	: Record<never, never>;

/**
 * Groups commands, and other groups, under the names typed on the command line.
 * `description`, `hidden`, `arguments`, `flags` and `tasks` describe the group itself and are
 * never members.
 *
 * @example export let sdxc = commands({ init: command({}), ui: commands({ description: "…", add }) });
 * @example make: commands({ arguments: { kind: argument(s.enum_(KINDS), { prompt }) }, job, model })
 */
export function commands<const Definition extends GroupDefinition>(
	definition: Definition,
): Group<Omit<Definition, GroupOwnKey>, DeclaredArguments<Definition>, DeclaredFlags<Definition>> {
	let members: Record<string, Command | Group> = {};
	for (let [name, member] of Object.entries(definition)) {
		if (OWN_KEYS.has(name)) continue;
		if (isCommand(member) || isGroup(member)) members[name] = member;
	}
	let spec: GroupSpec = {
		description: definition.description,
		hidden: definition.hidden === true,
		tasks: definition.tasks === true,
		members,
		arguments: definition.arguments ?? {},
		flags: definition.flags ?? {},
	};
	return { ...members, [GROUP]: spec } as never;
}

/** The definition keys `commands()` reads as the group's own. */
const OWN_KEYS: ReadonlySet<string> = new Set<GroupOwnKey>([
	"description",
	"hidden",
	"arguments",
	"flags",
	"tasks",
]);

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

/** The inputs a group declared for its own handler. */
type GroupInputsOf<Target> = Target extends {
	readonly [INPUTS]?: Carried<infer Inputs> | undefined;
}
	? Inputs
	: never;

/** What `ctx.arguments` holds for a command or a group: each argument's parsed value by key. */
export type ArgumentsOf<Target> =
	Target extends Command<infer Arguments, FlagsShape>
		? { readonly [Key in keyof Arguments]: ArgumentValue<Arguments[Key]> }
		: GroupInputsOf<Target> extends GroupInputs<infer Arguments, FlagsShape>
			? { readonly [Key in keyof Arguments]: ArgumentValue<Arguments[Key]> }
			: Readonly<Record<never, never>>;

/** What `ctx.flags` holds for a command or a group: each flag's parsed value by key. */
export type FlagsOf<Target> =
	Target extends Command<ArgumentsShape, infer Flags>
		? { readonly [Key in keyof Flags]: FlagValue<Flags[Key]> }
		: GroupInputsOf<Target> extends GroupInputs<ArgumentsShape, infer Flags>
			? { readonly [Key in keyof Flags]: FlagValue<Flags[Key]> }
			: Readonly<Record<never, never>>;
