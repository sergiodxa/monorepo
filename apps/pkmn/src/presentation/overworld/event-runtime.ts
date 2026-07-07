/**
 * Spawns and represents the live overworld entities authored map events become.
 *
 * A map's `events` array is authored, JSON-clean data (see `map-schema`); this
 * module turns it into the mutable `EventEntity` instances the overworld scene
 * walks, draws, moves, and runs interactions against. Spawning is pure — it takes
 * the authored events plus a "is this flag set?" predicate and returns the
 * entities that should exist right now, skipping any `once`/flagged event whose
 * completion flag is already set — so the whole enter-a-map step can be
 * unit-tested without a canvas or the engine. The entity keeps a mutable tile
 * position and facing (movement mutates them), its sprite/movement/interaction
 * config, and the RPG-Maker interaction axis (`action`/`touch`/`autorun`) the
 * scene dispatches on.
 *
 * The `once`/`flag` gate is deliberately simple and content-driven: an event that
 * is `once` (or carries a `flag`) is considered spent once its flag is set. A
 * `once` event with no explicit `flag` falls back to a stable per-event flag name
 * derived from its id, so authors get one-time behavior without naming a flag.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Direction } from "../core/direction";
import type { MapEvent } from "../render/map-schema";

/** Reads whether a named story flag is currently set. */
export type FlagReader = (flag: string) => boolean;

/**
 * One live overworld entity spawned from an authored map event.
 *
 * Position and facing are mutable because movement updates them each tick; the
 * rest mirrors the authored config the scene needs to render and interact. The
 * entity is intentionally a plain record so it stays trivially testable.
 */
export interface EventEntity {
	/** Stable id, unique within the map (from the authored event). */
	id: string;
	/** Current tile column (mutated by movement). */
	x: number;
	/** Current tile row (mutated by movement). */
	y: number;
	/** Current facing (mutated by movement and `face-player`). */
	facing: Direction;
	/** What the entity is: a visible NPC, a fixed wild creature, or an invisible trigger. */
	kind: MapEvent["kind"];
	/** When the interaction fires: on confirm, on step-onto, or on map enter. */
	interactionMode: MapEvent["interactionMode"];
	/** The optional sprite to draw (atlas region or image rect), or null for triggers. */
	sprite: MapEvent["sprite"];
	/** How the entity moves while idle. */
	movement: MapEvent["movement"];
	/** The declarative script plus optional trainer/wild battle data. */
	interaction: MapEvent["interaction"];
	/** The completion flag gating this event (derived from `flag`/`once`/id), or null. */
	flag: string | null;
	/** Whether the event fires at most once. */
	once: boolean;
	/** True once this event's interaction has run and should not refire. */
	done: boolean;
}

/**
 * The completion flag an event is gated by, or null when it can always refire.
 *
 * An explicit authored `flag` always wins. A `once` event with no flag gets a
 * stable synthesized name so it stays one-time across sessions without the author
 * naming a flag. An event that is neither `once` nor flagged returns null and may
 * refire every time its conditions hold.
 */
export function completionFlag(event: Pick<MapEvent, "id" | "flag" | "once">): string | null {
	if (event.flag) return event.flag;
	if (event.once) return `event:${event.id}:done`;
	return null;
}

/**
 * Spawns the live entities for a map's authored events under the current flags.
 *
 * Pure over its inputs: an event whose completion flag is already set is skipped
 * (its one-time interaction is spent), everything else becomes an `EventEntity`
 * at its authored tile and facing. The `done` flag starts true for a skipped
 * would-be entity only conceptually — skipped events produce no entity at all —
 * so the scene never has to re-check the gate to know an entity may still fire.
 *
 * @param events - The authored events from the loaded map.
 * @param isFlagSet - Predicate reading whether a story flag is currently set.
 */
export function spawnEvents(events: readonly MapEvent[], isFlagSet: FlagReader): EventEntity[] {
	let entities: EventEntity[] = [];
	for (let event of events) {
		let flag = completionFlag(event);
		if (flag !== null && isFlagSet(flag)) continue;
		entities.push({
			id: event.id,
			x: event.x,
			y: event.y,
			facing: event.facing,
			kind: event.kind,
			interactionMode: event.interactionMode,
			sprite: event.sprite,
			movement: event.movement,
			interaction: event.interaction,
			flag,
			once: event.once,
			done: false,
		});
	}
	return entities;
}

/** Returns the event entity occupying a tile, or null when the tile is free. */
export function eventAt(
	entities: readonly EventEntity[],
	x: number,
	y: number,
): EventEntity | null {
	for (let entity of entities) if (entity.x === x && entity.y === y) return entity;
	return null;
}
