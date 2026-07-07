/**
 * Pure, DOM-free editing logic for an event's page/command model, factored out of
 * the map editor so the recursive command-tree operations are unit-testable on
 * their own. Two families of helpers live here:
 *
 * - Factories ({@link defaultPage}, {@link defaultCommand}) that mint a schema-valid
 *   {@link EventPage} or {@link EventCommand} with sensible blank fields, so a new
 *   event always starts on one default page and the command list can append any of
 *   the core commands without the caller assembling the shape by hand.
 * - A recursive command-tree editor keyed on a {@link CommandPath}: an ordered list
 *   of {@link CommandStep}s that names one command by walking into the nested lists
 *   `show-choices` (a chosen choice's commands) and `conditional-branch` (its `then`
 *   / `else`) expose. {@link insertCommand}, {@link updateCommand},
 *   {@link removeCommand}, and {@link readCommand} operate at a path immutably —
 *   they clone the affected spine and return a new command list — so the editor can
 *   swap the whole list in without ever mutating the caller's.
 *
 * Every operation is pure and copy-in/copy-out: nothing here reads or writes the DOM
 * or shared state, and the produced pages/commands validate against the
 * `map-schema` contract the game loader trusts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {
	AutonomousMovement,
	Direction,
	EventCommand,
	EventPage,
	PageConditions,
	PageOptions,
	SpriteRef,
} from "~/presentation/render/map-schema";

/** The `kind` discriminant of every authorable {@link EventCommand}. */
export type CommandKind = EventCommand["kind"];

/**
 * One hop into a nested command list. A `show-choices` command branches per chosen
 * choice (`branch: "choice"`, `choice` = the choice index); a `conditional-branch`
 * branches into its `then` (`branch: "then"`) or `else` (`branch: "else"`). The
 * `index` names which command in that nested list to descend into.
 */
export interface CommandStep {
	/** The command index (within its list) this step descends into. */
	index: number;
	/** Which nested list of that command to enter. */
	branch: "choice" | "then" | "else";
	/** For a `choice` branch, which choice's command list to enter. */
	choice?: number;
}

/**
 * A path locating one command in a (possibly nested) command list. The final
 * element's `index` is unused when the path names a nested list to insert into; for
 * targeting an existing command, the last element's `index` names it directly. Kept
 * as a plain array so callers can build, slice, and compare paths freely.
 */
export type CommandPath = CommandStep[];

/** The four cardinal directions a `move`/route step may take, in a stable order. */
export const DIRECTIONS: readonly Direction[] = ["up", "down", "left", "right"] as const;

/** The event triggers, in RPG-Maker order, each paired with a human label. */
export const TRIGGERS: ReadonlyArray<{ id: EventPage["trigger"]; label: string }> = [
	{ id: "action", label: "Action Button" },
	{ id: "player-touch", label: "Player Touch" },
	{ id: "event-touch", label: "Event Touch" },
	{ id: "autorun", label: "Autorun" },
	{ id: "parallel", label: "Parallel Process" },
] as const;

/** The autonomous-movement types, each paired with a human label. */
export const MOVEMENT_TYPES: ReadonlyArray<{
	id: EventPage["autonomousMovement"]["type"];
	label: string;
}> = [
	{ id: "fixed", label: "Fixed" },
	{ id: "random", label: "Random" },
	{ id: "route", label: "Route" },
] as const;

/** The command kinds an author can insert, in menu order, each with a label. */
export const COMMAND_KINDS: ReadonlyArray<{ id: CommandKind; label: string }> = [
	{ id: "text", label: "Text" },
	{ id: "show-choices", label: "Show Choices" },
	{ id: "conditional-branch", label: "Conditional Branch" },
	{ id: "control-switch", label: "Control Switch" },
	{ id: "control-self-switch", label: "Control Self Switch" },
	{ id: "start-trainer-battle", label: "Start Trainer Battle" },
	{ id: "wild-encounter", label: "Wild Encounter" },
	{ id: "heal-party", label: "Heal Party" },
	{ id: "give-item", label: "Give Item" },
	{ id: "warp", label: "Warp" },
	{ id: "face-player", label: "Face Player" },
	{ id: "move", label: "Move" },
	{ id: "wait", label: "Wait" },
] as const;

/**
 * Builds a fresh, schema-valid {@link EventPage} with default fields: no conditions,
 * no graphic, fixed movement, all options off, an action trigger, and an empty
 * command list. A new event starts with exactly one of these.
 */
export function defaultPage(): EventPage {
	return {
		conditions: {},
		graphic: null,
		autonomousMovement: { type: "fixed", speed: undefined, freq: undefined, route: undefined },
		options: {},
		trigger: "action",
		commands: [],
	};
}

/**
 * Builds a fresh {@link EventCommand} of the given kind with blank/default fields —
 * the shape the command list appends and the fields editor then fills in. Nesting
 * commands (`show-choices`, `conditional-branch`) start with one empty branch so the
 * author has somewhere to add nested commands.
 *
 * @param kind The command kind to mint.
 * @param defaults Optional real content ids to seed pickers with (species/item).
 */
export function defaultCommand(
	kind: CommandKind,
	defaults: { speciesId?: string; itemId?: string } = {},
): EventCommand {
	let speciesId = defaults.speciesId ?? "";
	let itemId = defaults.itemId ?? "";
	switch (kind) {
		case "text":
			return { kind: "text", text: "" };
		case "show-choices":
			return { kind: "show-choices", prompt: undefined, choices: [{ label: "", commands: [] }] };
		case "conditional-branch":
			return { kind: "conditional-branch", condition: {}, then: [], else: undefined };
		case "control-switch":
			return { kind: "control-switch", flag: "", value: true };
		case "control-self-switch":
			return { kind: "control-self-switch", name: "A", value: true };
		case "start-trainer-battle":
			return {
				kind: "start-trainer-battle",
				trainer: { name: undefined, party: [], reward: undefined },
			};
		case "wild-encounter":
			return { kind: "wild-encounter", speciesId, level: 5 };
		case "heal-party":
			return { kind: "heal-party" };
		case "give-item":
			return { kind: "give-item", itemId, count: 1 };
		case "warp":
			return { kind: "warp", map: "", x: 0, y: 0 };
		case "face-player":
			return { kind: "face-player" };
		case "move":
			return { kind: "move", steps: [] };
		case "wait":
			return { kind: "wait", frames: 30 };
	}
}

/**
 * Returns the nested command list a step descends into, or `null` when the step's
 * command does not have that nested list (a mismatched branch). Pure: it reads the
 * list without cloning.
 *
 * @param commands The command list the step's `index` addresses.
 * @param step The step naming the command and which nested list to enter.
 */
function childList(commands: EventCommand[], step: CommandStep): EventCommand[] | null {
	let command = commands[step.index];
	if (!command) return null;
	if (step.branch === "choice") {
		if (command.kind !== "show-choices") return null;
		let choice = command.choices[step.choice ?? -1];
		return choice ? choice.commands : null;
	}
	if (step.branch === "then") {
		return command.kind === "conditional-branch" ? command.then : null;
	}
	// "else"
	if (command.kind !== "conditional-branch") return null;
	return command.else ?? null;
}

/**
 * Returns a copy of `commands` with the given step's nested list replaced by
 * `next`, rebuilding only the touched command. A no-op copy when the step does not
 * name a valid nested list.
 *
 * @param commands The command list to copy.
 * @param step The step naming the command and nested list to replace.
 * @param next The replacement nested command list.
 */
function withChildList(
	commands: EventCommand[],
	step: CommandStep,
	next: EventCommand[],
): EventCommand[] {
	return commands.map((command, index) => {
		if (index !== step.index) return command;
		if (step.branch === "choice" && command.kind === "show-choices") {
			return {
				...command,
				choices: command.choices.map((choice, choiceIndex) =>
					choiceIndex === step.choice ? { ...choice, commands: next } : choice,
				),
			};
		}
		if (step.branch === "then" && command.kind === "conditional-branch") {
			return { ...command, then: next };
		}
		if (step.branch === "else" && command.kind === "conditional-branch") {
			return { ...command, else: next };
		}
		return command;
	});
}

/**
 * Walks a path down to the innermost command list it addresses (following every step
 * but the last, since the last step's `index` names a command within the returned
 * list). Returns `null` when any intermediate step does not resolve to a nested
 * list. The returned list is a live reference into the tree — callers rebuild
 * immutably through the exported operations rather than mutating it.
 *
 * @param commands The root command list.
 * @param path The path to resolve (its last step names a command in the result).
 */
function resolveParentList(commands: EventCommand[], path: CommandPath): EventCommand[] | null {
	let list = commands;
	for (let depth = 0; depth < path.length - 1; depth++) {
		let child = childList(list, path[depth]!);
		if (child === null) return null;
		list = child;
	}
	return list;
}

/**
 * Rebuilds the root command list after transforming the innermost list a path
 * addresses. Recurses down the spine, cloning only the commands on the path, and
 * applies `transform` to the deepest list (the one the last step names a command
 * within). A no-op copy when the path cannot be resolved.
 *
 * @param commands The root command list.
 * @param path The path whose innermost list is transformed.
 * @param transform Produces the replacement for the innermost list.
 */
function rebuild(
	commands: EventCommand[],
	path: CommandPath,
	transform: (list: EventCommand[]) => EventCommand[],
): EventCommand[] {
	if (path.length <= 1) return transform(commands);
	let head = path[0]!;
	let child = childList(commands, head);
	if (child === null) return commands;
	let nextChild = rebuild(child, path.slice(1), transform);
	return withChildList(commands, head, nextChild);
}

/**
 * Reads the command a path addresses (its last step's `index` in the innermost
 * list), or `null` when the path resolves nowhere.
 *
 * @param commands The root command list.
 * @param path The path to the command.
 */
export function readCommand(commands: EventCommand[], path: CommandPath): EventCommand | null {
	if (path.length === 0) return null;
	let parent = resolveParentList(commands, path);
	if (parent === null) return null;
	return parent[path[path.length - 1]!.index] ?? null;
}

/**
 * Inserts a command into the list a path addresses at the last step's `index`
 * (clamped to the list bounds, so an out-of-range index appends). Returns a new root
 * command list; the caller's is untouched.
 *
 * @param commands The root command list.
 * @param path The path whose innermost list receives the command (last step's `index`).
 * @param command The command to insert.
 */
export function insertCommand(
	commands: EventCommand[],
	path: CommandPath,
	command: EventCommand,
): EventCommand[] {
	if (path.length === 0) return commands;
	let at = path[path.length - 1]!.index;
	return rebuild(commands, path, (list) => {
		let index = Math.max(0, Math.min(list.length, at));
		return [...list.slice(0, index), command, ...list.slice(index)];
	});
}

/**
 * Appends a command to the end of the innermost list a path addresses (following the
 * whole path as list steps). Use with a path whose steps all name nested lists to
 * add into a branch; pass an empty path to append to the root list.
 *
 * @param commands The root command list.
 * @param path The path to the list to append into (every step names a nested list).
 * @param command The command to append.
 */
export function appendCommand(
	commands: EventCommand[],
	path: CommandPath,
	command: EventCommand,
): EventCommand[] {
	if (path.length === 0) return [...commands, command];
	// Reuse rebuild by treating the path as list-steps: append to the resolved list.
	let augmented: CommandPath = [...path, { index: 0, branch: "then" }];
	return rebuild(commands, augmented, (list) => [...list, command]);
}

/**
 * Replaces the command a path addresses with `next`. A no-op copy when the path
 * resolves nowhere. Returns a new root command list.
 *
 * @param commands The root command list.
 * @param path The path to the command to replace.
 * @param next The replacement command.
 */
export function updateCommand(
	commands: EventCommand[],
	path: CommandPath,
	next: EventCommand,
): EventCommand[] {
	if (path.length === 0) return commands;
	let at = path[path.length - 1]!.index;
	return rebuild(commands, path, (list) =>
		list.map((command, index) => (index === at ? next : command)),
	);
}

/**
 * Removes the command a path addresses. A no-op copy when the path resolves nowhere.
 * Returns a new root command list.
 *
 * @param commands The root command list.
 * @param path The path to the command to remove.
 */
export function removeCommand(commands: EventCommand[], path: CommandPath): EventCommand[] {
	if (path.length === 0) return commands;
	let at = path[path.length - 1]!.index;
	return rebuild(commands, path, (list) => list.filter((_, index) => index !== at));
}

/**
 * Adds an empty choice branch to a `show-choices` command a path addresses. A no-op
 * copy for any other command. Returns a new root command list.
 *
 * @param commands The root command list.
 * @param path The path to the `show-choices` command.
 * @param label The new choice's label (blank by default).
 */
export function addChoice(commands: EventCommand[], path: CommandPath, label = ""): EventCommand[] {
	let command = readCommand(commands, path);
	if (!command || command.kind !== "show-choices") return commands;
	return updateCommand(commands, path, {
		...command,
		choices: [...command.choices, { label, commands: [] }],
	});
}

/**
 * Removes the choice at `choiceIndex` from a `show-choices` command a path
 * addresses, keeping at least one choice. A no-op copy otherwise.
 *
 * @param commands The root command list.
 * @param path The path to the `show-choices` command.
 * @param choiceIndex The choice to remove.
 */
export function removeChoice(
	commands: EventCommand[],
	path: CommandPath,
	choiceIndex: number,
): EventCommand[] {
	let command = readCommand(commands, path);
	if (!command || command.kind !== "show-choices") return commands;
	if (command.choices.length <= 1) return commands;
	return updateCommand(commands, path, {
		...command,
		choices: command.choices.filter((_, index) => index !== choiceIndex),
	});
}

/**
 * Toggles the presence of the `else` branch on a `conditional-branch` command a path
 * addresses: adds an empty `else` when absent, drops it when present. A no-op copy
 * for any other command.
 *
 * @param commands The root command list.
 * @param path The path to the `conditional-branch` command.
 */
export function toggleElse(commands: EventCommand[], path: CommandPath): EventCommand[] {
	let command = readCommand(commands, path);
	if (!command || command.kind !== "conditional-branch") return commands;
	return updateCommand(commands, path, {
		...command,
		else: command.else === undefined ? [] : undefined,
	});
}

/**
 * Returns a deep copy of a page so callers cannot mutate the source. The schema
 * widens a page's `conditions`/`options` to `{}` (they default to an empty object),
 * so the fields are read through the richer exported types — a runtime-empty object
 * simply reads every field as `undefined`.
 */
export function clonePage(page: EventPage): EventPage {
	let conditions = page.conditions as PageConditions;
	let movement = page.autonomousMovement as AutonomousMovement;
	let options = page.options as PageOptions;
	return {
		conditions: {
			switches: conditions.switches ? [...conditions.switches] : undefined,
			selfSwitch: conditions.selfSwitch,
		} satisfies PageConditions,
		graphic: cloneSprite(page.graphic),
		autonomousMovement: {
			type: movement.type,
			speed: movement.speed,
			freq: movement.freq,
			route: movement.route ? [...movement.route] : undefined,
		} satisfies AutonomousMovement,
		options: { ...options } satisfies PageOptions,
		trigger: page.trigger,
		commands: page.commands.map(cloneCommand),
	};
}

/** Returns a deep copy of an optional sprite ref. */
export function cloneSprite(sprite: SpriteRef): SpriteRef {
	if (sprite === null) return null;
	return { ...sprite };
}

/** Returns a deep copy of a command, recursing into nested command lists. */
export function cloneCommand(command: EventCommand): EventCommand {
	switch (command.kind) {
		case "show-choices":
			return {
				kind: "show-choices",
				prompt: command.prompt,
				choices: command.choices.map((choice) => ({
					label: choice.label,
					commands: choice.commands.map(cloneCommand),
				})),
			};
		case "conditional-branch":
			return {
				kind: "conditional-branch",
				condition: { ...command.condition },
				then: command.then.map(cloneCommand),
				else: command.else ? command.else.map(cloneCommand) : undefined,
			};
		case "start-trainer-battle":
			return {
				kind: "start-trainer-battle",
				trainer: {
					name: command.trainer.name,
					party: command.trainer.party.map((member) => ({ ...member })),
					reward: command.trainer.reward,
				},
			};
		case "move":
			return { kind: "move", steps: [...command.steps] };
		default:
			return { ...command };
	}
}
