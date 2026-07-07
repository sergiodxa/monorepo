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
 * The `events` schema is modeled richly now — a moving NPC, a wild/legendary
 * creature, or an invisible trigger — even though the game only partially acts on
 * events today, so the editor and a later event runtime share one definition.
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
	string,
	union,
} from "remix/data-schema";
import { min } from "remix/data-schema/checks";

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
const direction = () => enum_(["up", "down", "left", "right"] as const);

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

/** How an event actor moves on the map while idle. */
const MovementSchema = union([
	exact("none"),
	exact("random"),
	object({ type: exact("route"), steps: array(direction()) }),
]);

/**
 * One declarative step an event's interaction runs. Mirrors the existing
 * `ScriptCommand` language so an event's `interaction.script` and a legacy
 * trigger's `script` speak the same commands, keeping map content data-only.
 */
const ScriptCommandSchema = union([
	object({ do: exact("message"), text: string() }),
	object({ do: exact("give-item"), itemId: string(), count: wholeNumber() }),
	object({ do: exact("heal-party") }),
	object({ do: exact("start-trainer-battle"), trainerId: string() }),
	object({ do: exact("set-flag"), flag: string() }),
	object({ do: exact("warp"), toMap: string(), toX: wholeNumber(), toY: wholeNumber() }),
	object({ do: exact("face-player") }),
	object({ do: exact("move"), route: array(direction()) }),
]);

/**
 * What talking to (or stepping on) an event does. Groups the declarative script
 * with the trainer/wild data a later event runtime needs: a `trainer` party turns
 * the event into a trainer battle, a `wild` block into a fixed (often legendary)
 * encounter.
 */
const InteractionSchema = object({
	/** The declarative steps run when the event fires. */
	script: defaulted(array(ScriptCommandSchema), () => [] as ScriptCommand[]),
	/** A fixed trainer party this event fights with, if it is a trainer. */
	trainer: optional(
		object({
			name: optional(string()),
			party: array(object({ speciesId: string(), level: positiveNumber() })),
			reward: optional(wholeNumber()),
		}),
	),
	/** A fixed (often legendary) wild creature this event battles, if it is a `wild` event. */
	wild: optional(object({ speciesId: string(), level: positiveNumber() })),
});

/**
 * One authored map event. `kind` distinguishes a visible, possibly moving NPC
 * (`npc`), a fixed wild/legendary creature (`wild`), and an invisible tile trigger
 * (`trigger`). `interactionMode` says when the interaction fires: on the player's
 * A press (`action`), on stepping onto the tile (`touch`), or automatically when
 * conditions hold (`autorun`) — the RPG-Maker trigger axis. `facing`, `movement`,
 * `sprite`, `flag`, and `once` round out the config an editor exposes.
 */
const MapEventSchema = object({
	id: string(),
	x: wholeNumber(),
	y: wholeNumber(),
	kind: enum_(["npc", "wild", "trigger"] as const),
	facing: defaulted(direction(), "down"),
	sprite: defaulted(SpriteRefSchema, () => null),
	movement: defaulted(MovementSchema, "none"),
	interaction: defaulted(InteractionSchema, () => ({
		script: [] as ScriptCommand[],
		trainer: undefined,
		wild: undefined,
	})),
	interactionMode: defaulted(enum_(["action", "touch", "autorun"] as const), "action"),
	/** A story flag gating or set by this event; absent when unconditioned. */
	flag: optional(string()),
	/** Whether the event fires at most once (default false). */
	once: defaulted(boolean(), false),
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

/** One declarative step an event interaction or trigger runs. */
export type ScriptCommand = InferOutput<typeof ScriptCommandSchema>;

/** An authored map event (NPC, wild creature, or invisible trigger). */
export type MapEvent = InferOutput<typeof MapEventSchema>;

/** One tileset declaration on a map. */
export type Tileset = InferOutput<typeof TilesetSchema>;

/** One weighted wild-encounter table entry. */
export type EncounterEntry = InferOutput<typeof EncounterEntrySchema>;

/** The validated, typed shape of one authored map's JSON. */
export type MapData = InferOutput<typeof MapDataSchema>;
