/**
 * Turns a map's authored `events` into the live `EventEntity` instances the
 * overworld scene walks, draws, moves, and runs. The last page whose
 * conditions (global switches, a per-event self-switch) hold is active,
 * re-selected as a pure re-read whenever a flag changes.
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
 * `event` and `mapId` stay attached so the scene can re-select the active
 * page and resolve self-switch flag names as flags change.
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
 * Picks the active page for an event: the last whose conditions hold, or
 * null when none qualify, matching RPG-Maker-XP's later-page-overrides
 * semantics. Pure over the injected predicate so selection re-runs cheaply.
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
 * An event with no qualifying page still spawns with `page` null, ready
 * for the scene to re-select its page the moment a flag turns on.
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
 * Runs after any switch or self-switch change so an event flips to a later
 * page, or goes inert, while the map stays loaded.
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
