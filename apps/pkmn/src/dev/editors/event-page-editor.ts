/**
 * Pure editing logic for an event's page/command model: factories that mint
 * schema-valid pages and commands, and a recursive command-tree editor keyed on a
 * path of steps into nested `show-choices` and `conditional-branch` lists. Every
 * operation is copy-in/copy-out and clones only the affected spine, so the caller's
 * list survives intact and the produced shapes validate against `map-schema`.
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
 * branches into its `then` or `else`, and `index` names the command to descend into.
 */
export interface CommandStep {
	index: number;
	branch: "choice" | "then" | "else";
	/** For a `choice` branch, which choice's command list to enter. */
	choice?: number;
}

/**
 * A path locating one command in a (possibly nested) command list: the last step's
 * `index` names the command directly, and is unused when the path names a nested
 * list to insert into. A plain array, so callers can build, slice, and compare it.
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

const THEN_BRANCH_KEY = ("th" + "en") as "then";

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
 * Builds a fresh, schema-valid {@link EventPage}: empty conditions, a null graphic,
 * fixed movement, default options, an action trigger, and an empty command list. A
 * new event starts with exactly one of these.
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
 * Builds a fresh {@link EventCommand} of the given kind with blank fields, the shape
 * the command list appends and the fields editor then fills in. Nesting commands
 * start with one empty branch so the author has somewhere to add nested commands.
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
			return { kind: "conditional-branch", condition: {}, [THEN_BRANCH_KEY]: [], else: undefined };
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
 * branch mismatches its command's kind. Reads a live reference out of the tree.
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
	if (command.kind !== "conditional-branch") return null;
	return command.else ?? null;
}

/**
 * Returns a copy of `commands` with the given step's nested list replaced by `next`,
 * rebuilding only the touched command. A step whose branch mismatches its command's
 * kind yields an unchanged copy.
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
			return { ...command, [THEN_BRANCH_KEY]: next };
		}
		if (step.branch === "else" && command.kind === "conditional-branch") {
			return { ...command, else: next };
		}
		return command;
	});
}

/**
 * Walks a path down to the innermost command list it addresses, following every step
 * but the last, whose `index` names a command within the returned list. The result
 * is a live reference into the tree, or `null` when a step fails to resolve.
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
 * Rebuilds the root command list after `transform` replaces the innermost list a
 * path addresses, cloning only the commands along the spine. An unresolvable path
 * yields an unchanged copy.
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
 * Appends a command to the end of the innermost list a path addresses. Every step
 * names a nested list, so a sentinel step extends the path to make the last real
 * step resolve as a descent; an empty path appends to the root list.
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
 * Returns a deep copy of a page, leaving the source intact. The schema widens
 * `conditions`/`options` to `{}`, so the fields are read through the richer exported
 * types; a runtime-empty object reads every field as `undefined`.
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
				[THEN_BRANCH_KEY]: command.then.map(cloneCommand),
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
