/**
 * The on-disk map JSON format and its `remix/data-schema` validator.
 *
 * This module is the single contract the map EDITOR targets and the game LOADER
 * trusts. It defines `MapData` — the JSON-clean shape one authored map serializes
 * to — and `MapDataSchema`, which validates an untrusted parsed JSON value into a
 * typed `MapData` (or a list of clear issues). Keeping the format and its
 * validation together, free of any renderer or DOM dependency, lets both the
 * editor and the loader import it and lets the whole contract be unit-tested.
 *
 * A map carries its grid size (`width`/`height` in tiles, `tileWidth`/`tileHeight`
 * in pixels), one or more `tilesets` (each an image reference sliced by
 * `columns`), three tile `layers` (`ground`, `decor`, `overhead`), a `collision`
 * grid, wild-`encounters`, `warps`, background music, and an `events` list. Layer
 * cells are packed tile references (see {@link packTileRef}); `-1` means empty.
 * The `events` schema follows the RPG-Maker-XP model: each {@link MapEvent} is a
 * tile position holding one or more {@link EventPage}s, and the first page whose
 * `conditions` (switches / self-switch) currently hold is the page that runs. A
 * page pairs its graphic, autonomous movement, and options with a `trigger` (how
 * it fires) and a recursive list of {@link EventCommand}s (its "event script").
 * The command union is recursive — `show-choices` and `conditional-branch` nest
 * further commands — so the editor and a later event runtime share one definition.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import {
	array,
	boolean,
	defaulted,
	enum_,
	type InferOutput,
	nullable,
	number,
	object,
	optional,
	type Schema,
	string,
	union,
} from "remix/data-schema";
import { min } from "remix/data-schema/checks";
import { lazy } from "remix/data-schema/lazy";

/**
 * Base each tileset index is multiplied by when packing a layer cell. A cell's
 * packed value is `tilesetIndex * TILESET_STRIDE + tileIndex`, so one number both
 * names the tileset (which image) and the tile within it (its grid position).
 * 4096 comfortably exceeds any single tileset's tile count (a 64x64-tile sheet is
 * 4096 tiles) while keeping packed values small and readable in the JSON.
 */
export const TILESET_STRIDE = 4096;

/** Sentinel layer cell meaning "no tile here" (the layer draws nothing). */
export const EMPTY_CELL = -1;

/** Serialized key for conditional-branch commands' successful command list. */
const THEN_BRANCH_KEY = ("th" + "en") as "then";

/**
 * Packs a tileset index and a tile index into one layer-cell number.
 *
 * The inverse of {@link unpackTileRef}. Pure integer math so the editor and the
 * renderer agree on the encoding without sharing state.
 *
 * @param tilesetIndex - Which tileset in the map's `tilesets` array the tile is from.
 * @param tileIndex - The tile's zero-based index within that tileset's grid.
 */
export function packTileRef(tilesetIndex: number, tileIndex: number): number {
	return tilesetIndex * TILESET_STRIDE + tileIndex;
}

/** A layer cell unpacked into its tileset and tile indices. */
export interface TileRef {
	/** Index into the map's `tilesets` array. */
	tilesetIndex: number;
	/** Zero-based tile index within that tileset's grid. */
	tileIndex: number;
}

/**
 * Unpacks a non-empty layer-cell number into its tileset and tile indices.
 *
 * The inverse of {@link packTileRef}. Callers must guard against {@link EMPTY_CELL}
 * (`-1`) themselves; unpacking `-1` is meaningless and never happens because empty
 * cells are skipped before this is reached.
 *
 * @param packed - A non-negative packed layer-cell value.
 */
export function unpackTileRef(packed: number): TileRef {
	return {
		tilesetIndex: Math.floor(packed / TILESET_STRIDE),
		tileIndex: packed % TILESET_STRIDE,
	};
}

/** A whole (>= 0) number, e.g. a tile count, coordinate, or index. */
const wholeNumber = () => number().pipe(min(0));

/** A whole (>= 1) number, e.g. a dimension that cannot be zero. */
const positiveNumber = () => number().pipe(min(1));

/** A single cardinal-direction value, preserved as a literal union in the output. */
const DirectionSchema = enum_(["up", "down", "left", "right"] as const);

/** A single cardinal-direction value, preserved as a literal union in the output. */
const direction = () => DirectionSchema;

/** Matches one exact string, preserved as a literal in the output type. */
const exact = <const value extends string>(value: value) => enum_([value] as const);

/**
 * One event's optional sprite: either an atlas region or a raw tileset image
 * reference. A moving NPC or a visible creature carries one; an invisible trigger
 * leaves it `null`.
 */
const SpriteRefSchema = nullable(
	union([
		object({ atlas: string(), region: string() }),
		object({
			image: string(),
			x: wholeNumber(),
			y: wholeNumber(),
			w: positiveNumber(),
			h: positiveNumber(),
		}),
	]),
);

/** A single cardinal direction an actor faces or steps toward. */
export type Direction = InferOutput<typeof DirectionSchema>;

/** One event's optional sprite: an atlas region, a raw image rect, or null. */
export type SpriteRef = InferOutput<typeof SpriteRefSchema>;

/** A fixed trainer party an event can battle the player with. */
export interface TrainerParty {
	/** The trainer's display name, if any. */
	name?: string;
	/** The species and levels the trainer fields, in order. */
	party: { speciesId: string; level: number }[];
	/** The money reward for beating the trainer, if any. */
	reward?: number;
}

/**
 * One declarative command in a page's event script — a recursive discriminated
 * union keyed on `kind`. `show-choices` and `conditional-branch` nest further
 * commands, which is why this type is defined by hand (rather than inferred) so
 * {@link EventCommandSchema} can reference it through {@link lazy}.
 */
export type EventCommand =
	| { kind: "text"; text: string }
	| {
			kind: "show-choices";
			prompt?: string;
			choices: { label: string; commands: EventCommand[] }[];
	  }
	| {
			kind: "conditional-branch";
			condition: { switch?: string; selfSwitch?: string };
			then: EventCommand[];
			else?: EventCommand[];
	  }
	| { kind: "control-switch"; flag: string; value: boolean }
	| { kind: "control-self-switch"; name: string; value: boolean }
	| { kind: "start-trainer-battle"; trainer: TrainerParty }
	| { kind: "wild-encounter"; speciesId: string; level: number }
	| { kind: "heal-party" }
	| { kind: "give-item"; itemId: string; count: number }
	| { kind: "warp"; map: string; x: number; y: number }
	| { kind: "face-player" }
	| { kind: "move"; steps: Direction[] }
	| { kind: "wait"; frames: number };

/** A fixed trainer party an event can battle the player with. */
const TrainerPartySchema = object({
	name: optional(string()),
	party: array(object({ speciesId: string(), level: positiveNumber() })),
	reward: optional(wholeNumber()),
});

/**
 * One declarative command in a page's event script — the recursive discriminated
 * union at the heart of the event model, keyed on `kind`.
 *
 * Most commands are flat effects (`text`, `warp`, `heal-party`, ...), but
 * `show-choices` and `conditional-branch` nest further command lists, so the union
 * is defined through {@link lazy} and typed against the {@link EventCommand}
 * recursive type: `EventCommandSchema` references itself for those nested lists
 * without a circular initialization crash.
 */
const EventCommandSchema: Schema<unknown, EventCommand> = union([
	/** Shows a message box with the given text. */
	object({ kind: exact("text"), text: string() }),
	/**
	 * Shows a list of choices; the commands under the chosen label run next. An
	 * optional `prompt` is shown above the choices.
	 */
	object({
		kind: exact("show-choices"),
		prompt: optional(string()),
		choices: array(object({ label: string(), commands: array(lazy(() => EventCommandSchema)) })),
	}),
	/**
	 * Runs `then` when the condition (a switch or self-switch being on) holds,
	 * otherwise the optional `else`.
	 */
	object({
		kind: exact("conditional-branch"),
		condition: object({ switch: optional(string()), selfSwitch: optional(string()) }),
		[THEN_BRANCH_KEY]: array(lazy(() => EventCommandSchema)),
		else: optional(array(lazy(() => EventCommandSchema))),
	}),
	/** Turns a global switch (a story flag) on or off. */
	object({ kind: exact("control-switch"), flag: string(), value: boolean() }),
	/** Turns one of this event's self-switches on or off. */
	object({ kind: exact("control-self-switch"), name: string(), value: boolean() }),
	/** Starts a trainer battle against the given party. */
	object({ kind: exact("start-trainer-battle"), trainer: TrainerPartySchema }),
	/** Starts a fixed (often legendary) wild encounter. */
	object({
		kind: exact("wild-encounter"),
		speciesId: string(),
		level: positiveNumber(),
	}),
	/** Fully heals the player's party. */
	object({ kind: exact("heal-party") }),
	/** Gives the player an item (default one). */
	object({ kind: exact("give-item"), itemId: string(), count: defaulted(positiveNumber(), 1) }),
	/** Warps the player to another map and tile. */
	object({ kind: exact("warp"), map: string(), x: wholeNumber(), y: wholeNumber() }),
	/** Turns this event to face the player. */
	object({ kind: exact("face-player") }),
	/** Walks this event through the given steps. */
	object({ kind: exact("move"), steps: array(direction()) }),
	/** Pauses the script for the given number of frames. */
	object({ kind: exact("wait"), frames: wholeNumber() }),
]);

/**
 * The conditions that must currently hold for a page to be the active one. A page
 * with no conditions (both fields absent) always qualifies; the first qualifying
 * page — in declaration order — is the one that runs.
 */
const PageConditionsSchema = object({
	/** Global switches (story flags) that must all be on. */
	switches: optional(array(string())),
	/** A self-switch on this event that must be on. */
	selfSwitch: optional(string()),
});

/**
 * How a page's actor moves on its own while the page is active. `fixed` stays put,
 * `random` wanders, and `route` walks the given cycle of `steps`. `speed` and
 * `freq` tune movement speed and frequency for the runtime.
 */
const AutonomousMovementSchema = object({
	type: enum_(["fixed", "random", "route"] as const),
	speed: optional(positiveNumber()),
	freq: optional(positiveNumber()),
	route: optional(array(direction())),
});

/**
 * The rendering/behaviour toggles a page exposes, mirroring RPG-Maker-XP's event
 * options. All default off; the runtime interprets them.
 */
const PageOptionsSchema = object({
	/** Animate the walking frames even while standing still. */
	moveAnimation: optional(boolean()),
	/** Keep animating the walk cycle while stopped. */
	stopAnimation: optional(boolean()),
	/** Lock the graphic's facing so movement never turns it. */
	directionFix: optional(boolean()),
	/** Ignore collision, passing through everything. */
	through: optional(boolean()),
	/** Draw above the player and other events. */
	alwaysOnTop: optional(boolean()),
});

/**
 * One page of an event: the config that applies while this page is the active one.
 * Its `conditions` decide when it is active, its `graphic` is what it looks like
 * (`null` = invisible trigger), and its `trigger` says when its `commands` run.
 */
const EventPageSchema = object({
	conditions: defaulted(PageConditionsSchema, () => ({})),
	graphic: defaulted(SpriteRefSchema, () => null),
	autonomousMovement: defaulted(AutonomousMovementSchema, () => ({
		type: "fixed" as const,
		speed: undefined,
		freq: undefined,
		route: undefined,
	})),
	options: defaulted(PageOptionsSchema, () => ({})),
	trigger: defaulted(
		enum_(["action", "player-touch", "event-touch", "autorun", "parallel"] as const),
		"action",
	),
	commands: defaulted(array(EventCommandSchema), () => [] as EventCommand[]),
});

/**
 * One authored map event: a named tile position holding an ordered list of
 * {@link EventPage}s. At runtime the first page whose conditions currently hold is
 * the active page — its graphic, movement, and commands are the ones in effect.
 */
const MapEventSchema = object({
	id: string(),
	x: wholeNumber(),
	y: wholeNumber(),
	/** A human-readable label for the editor; not required at runtime. */
	name: optional(string()),
	pages: array(EventPageSchema),
});

/** One tileset an atlas of tiles is sliced from: an image reference and its grid. */
const TilesetSchema = object({
	id: string(),
	/** Manifest image id (or URL) of the tileset sheet. */
	image: string(),
	/** Number of tile columns in the sheet, used to map a tile index to source x,y. */
	columns: positiveNumber(),
	tileWidth: positiveNumber(),
	tileHeight: positiveNumber(),
});

/** One weighted wild-encounter entry (species + level range + weight). */
const EncounterEntrySchema = object({
	speciesId: string(),
	minLevel: positiveNumber(),
	maxLevel: positiveNumber(),
	weight: positiveNumber(),
});

/** One layer's flat cell array: `-1` (empty) or a packed tile ref. */
const layerCells = () => array(number().pipe(min(EMPTY_CELL)));

/**
 * The full map schema. Validates a parsed JSON value into a typed {@link MapData}.
 * Cross-field invariants that a shape schema cannot express (layer lengths equal
 * `width*height`, tile refs name a real tileset) are enforced by the loader after
 * this passes, so the messages there can name the exact layer and cell.
 */
export const MapDataSchema = object({
	id: string(),
	width: positiveNumber(),
	height: positiveNumber(),
	tileWidth: positiveNumber(),
	tileHeight: positiveNumber(),
	tilesets: array(TilesetSchema),
	layers: object({
		ground: layerCells(),
		decor: layerCells(),
		overhead: layerCells(),
	}),
	collision: array(wholeNumber()),
	encounters: defaulted(
		array(
			object({
				zone: array(wholeNumber()),
				table: array(EncounterEntrySchema),
				rate: wholeNumber(),
			}),
		),
		() => [],
	),
	warps: defaulted(
		array(
			object({
				x: wholeNumber(),
				y: wholeNumber(),
				to: object({ map: string(), x: wholeNumber(), y: wholeNumber() }),
			}),
		),
		() => [],
	),
	events: defaulted(array(MapEventSchema), () => []),
	bgm: defaulted(string(), ""),
});

/** The conditions gating when one event page is the active one. */
export type PageConditions = InferOutput<typeof PageConditionsSchema>;

/** How a page's actor moves on its own while the page is active. */
export type AutonomousMovement = InferOutput<typeof AutonomousMovementSchema>;

/** How a page fires its commands (the RPG-Maker trigger axis). */
export type EventTrigger = InferOutput<typeof EventPageSchema>["trigger"];

/** The rendering/behaviour toggles one event page exposes. */
export type PageOptions = InferOutput<typeof PageOptionsSchema>;

/** One page of an event: the config in effect while its conditions hold. */
export type EventPage = InferOutput<typeof EventPageSchema>;

/** An authored map event: a tile position holding one or more {@link EventPage}s. */
export type MapEvent = InferOutput<typeof MapEventSchema>;

/** One tileset declaration on a map. */
export type Tileset = InferOutput<typeof TilesetSchema>;

/** One weighted wild-encounter table entry. */
export type EncounterEntry = InferOutput<typeof EncounterEntrySchema>;

/** The validated, typed shape of one authored map's JSON. */
export type MapData = InferOutput<typeof MapDataSchema>;
