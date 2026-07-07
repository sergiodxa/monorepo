/**
 * Spawns and represents the live overworld entities authored map events become.
 *
 * A map's `events` array is authored, JSON-clean data (see `map-schema`) following
 * the RPG-Maker-XP model: each event is a tile position holding one or more ordered
 * pages, and at runtime the *last* page whose `conditions` currently hold is the
 * active page — the graphic, movement, trigger, and commands in effect. This module
 * turns those events into the mutable `EventEntity` instances the overworld scene
 * walks, draws, moves, and runs, and it owns the two pure decisions the scene leans
 * on: which page is active right now ({@link selectActivePage}) and where a
 * self-switch is stored ({@link selfSwitchFlag}, re-exported from the engine).
 *
 * A page's conditions gate on global switches (story flags that must all be on) and
 * on one of the event's own self-switches. A self-switch is namespaced per map and
 * event so many events can carry a switch of the same short name without clashing;
 * it lives in the same engine flags store as a global switch. Because both are just
 * flags, re-evaluating the active page after any flag changes is a pure re-read
 * against the current "is this flag on?" predicate — no runtime bookkeeping beyond
 * the entity's mutable position and facing, which movement updates each tick.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { selfSwitchFlag } from "~/game/world/world";

import type { Direction } from "../core/direction";
import type { EventPage, MapEvent, PageConditions } from "../render/map-schema";

export { selfSwitchFlag };

/** Reads whether a named story flag (a global switch or a self-switch) is currently on. */
export type FlagReader = (flag: string) => boolean;

/**
 * One live overworld entity spawned from an authored map event.
 *
 * Position and facing are mutable because movement updates them each tick; `page`
 * is the currently active page (or null when no page's conditions hold, leaving the
 * entity inert and invisible) and is re-selected whenever flags change. The authored
 * `event` and the entity's `mapId` stay around so the scene can re-select the page,
 * resolve self-switch flag names, and read the active page's config.
 */
export interface EventEntity {
	/** The map this entity belongs to (used to namespace its self-switches). */
	mapId: string;
	/** Stable id, unique within the map (from the authored event). */
	id: string;
	/** Current tile column (mutated by movement). */
	x: number;
	/** Current tile row (mutated by movement). */
	y: number;
	/** Current facing (mutated by movement and `face-player`). */
	facing: Direction;
	/** The authored event this entity was spawned from (its pages and tile). */
	event: MapEvent;
	/** The active page whose conditions currently hold, or null when the entity is inert. */
	page: EventPage | null;
}

/**
 * Picks the active page for an event: the last one whose conditions hold, or null.
 *
 * Pages are tried from last to first (RPG-Maker-XP semantics, where a later page
 * overrides an earlier one) and the first match wins. A page qualifies when every
 * one of its `switches` is on and, if it names a `selfSwitch`, that self-switch is
 * on for this event. A page with no conditions always qualifies. When no page
 * qualifies the event is inert and invisible, so this returns null.
 *
 * Pure over the injected flag predicate so page selection can be unit-tested and
 * re-run cheaply whenever a flag changes.
 *
 * @param mapId - The map the event belongs to (used to resolve self-switch flags).
 * @param event - The authored event whose pages are being evaluated.
 * @param isFlagOn - Predicate reading whether a global/self-switch flag is on.
 */
export function selectActivePage(
	mapId: string,
	event: MapEvent,
	isFlagOn: FlagReader,
): EventPage | null {
	for (let index = event.pages.length - 1; index >= 0; index -= 1) {
		let page = event.pages[index]!;
		if (pageConditionsHold(mapId, event.id, page, isFlagOn)) return page;
	}
	return null;
}

/** Whether every switch and self-switch a page requires is currently on. */
function pageConditionsHold(
	mapId: string,
	eventId: string,
	page: EventPage,
	isFlagOn: FlagReader,
): boolean {
	let { switches, selfSwitch } = page.conditions as PageConditions;
	if (switches) {
		for (let flag of switches) if (!isFlagOn(flag)) return false;
	}
	if (selfSwitch && !isFlagOn(selfSwitchFlag(mapId, eventId, selfSwitch))) return false;
	return true;
}

/**
 * Spawns one live entity per authored event under the current flags.
 *
 * Pure over its inputs: every event becomes an `EventEntity` at its authored tile,
 * with its active page pre-selected from the current flags. An event for which no
 * page qualifies still spawns (its `page` is null) so the scene can re-select a page
 * for it the moment a flag turns on, rather than having to respawn the whole map.
 *
 * @param mapId - The id of the map these events belong to.
 * @param events - The authored events from the loaded map.
 * @param isFlagOn - Predicate reading whether a global/self-switch flag is on.
 */
export function spawnEvents(
	mapId: string,
	events: readonly MapEvent[],
	isFlagOn: FlagReader,
): EventEntity[] {
	let entities: EventEntity[] = [];
	for (let event of events) {
		entities.push({
			mapId,
			id: event.id,
			x: event.x,
			y: event.y,
			facing: "down",
			event,
			page: selectActivePage(mapId, event, isFlagOn),
		});
	}
	return entities;
}

/**
 * Re-selects every entity's active page against the current flags, in place.
 *
 * Called whenever a flag might have changed (a switch or self-switch was set) so an
 * event flips to a later page — or goes inert — without the map being reloaded.
 * Mutates each entity's `page`.
 *
 * @param entities - The live entities to re-evaluate.
 * @param isFlagOn - Predicate reading whether a global/self-switch flag is on.
 */
export function refreshActivePages(entities: readonly EventEntity[], isFlagOn: FlagReader) {
	for (let entity of entities) {
		entity.page = selectActivePage(entity.mapId, entity.event, isFlagOn);
	}
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
