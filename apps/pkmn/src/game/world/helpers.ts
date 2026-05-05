/**
 * Shared world helper primitives for the ECS-style storage layer.
 *
 * This module centralizes the low-level utilities that read, write, enumerate, and trim world-backed
 * component stores. It defines the common store shapes and persistence groupings used to keep world state
 * handling consistent across the engine.
 *
 * It also provides the boundary between long-lived save data and runtime-only state by exposing helpers that
 * select persistent world slices and ignore transient stores. Keeping that behavior here makes world storage
 * rules explicit in one place instead of scattering them across individual systems.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { EntityId } from "./entity";
import type { World } from "./world";

import { ensureEntityRegistered } from "./entity";

/** ECS-style store keyed by stable entity identifier. */
export type ComponentStore<T> = Partial<Record<EntityId, T>>;

/** Identifies which world stores survive save/load boundaries. */
export type WorldStorePersistence = "persistent" | "transient";

/** Lists the save-backed world stores that should be serialized. */
export let PERSISTENT_WORLD_STORE_KEYS = [
	"playerProfile",
	"party",
	"inventory",
	"bestiary",
	"storageBoxes",
	"creatureIdentity",
	"creatureProgress",
	"creatureMoves",
	"creatureHealth",
	"creatureStatus",
	"ownership",
	"creatureLocation",
] as const satisfies Array<keyof World>;

/** Lists runtime-only world stores that are rebuilt when the engine boots. */
export let TRANSIENT_WORLD_STORE_KEYS = [
	"activeBattle",
	"battleParticipants",
	"battlePhase",
	"battleField",
	"battleSide",
	"battlePendingTurn",
	"battlePendingReplacement",
	"battleLog",
	"battleMember",
] as const satisfies Array<keyof World>;

/** Returns one component or throws when the entity is missing that store entry. */
export function requireComponent<T>(
	store: ComponentStore<T>,
	entityId: EntityId,
	label: string,
): T {
	let component = store[entityId];
	if (component) return component;
	throw new ReferenceError(`Missing ${label} for ${entityId}.`);
}

/** Returns one optional component without throwing. */
export function getComponent<T>(store: ComponentStore<T>, entityId: EntityId): T | null {
	return store[entityId] ?? null;
}

/** Writes one component and ensures the owning entity is registered in the world. */
export function setComponent<T>(
	world: Pick<World, "entities">,
	store: ComponentStore<T>,
	entityId: EntityId,
	component: T,
) {
	ensureEntityRegistered(world.entities, entityId);
	store[entityId] = component;
	return component;
}

/** Removes one component from the target store. */
export function removeComponent<T>(store: ComponentStore<T>, entityId: EntityId) {
	delete store[entityId];
}

/** Lists entity ids that currently have a component in the target store. */
export function listComponentEntities<T>(store: ComponentStore<T>): EntityId[] {
	return Object.keys(store);
}

/**
 * Returns a save-only snapshot with transient runtime stores removed.
 *
 * Persistence should contain only long-lived player and creature state. Stripping runtime mirrors here keeps
 * save output stable even when the engine adds new battle-only helper stores.
 */
export function pickPersistentWorld(world: World) {
	return {
		entities: structuredClone(world.entities),
		playerId: world.playerId,
		playerProfile: structuredClone(world.playerProfile),
		party: structuredClone(world.party),
		inventory: structuredClone(world.inventory),
		bestiary: structuredClone(world.bestiary),
		storageBoxes: structuredClone(world.storageBoxes),
		creatureIdentity: structuredClone(world.creatureIdentity),
		creatureProgress: structuredClone(world.creatureProgress),
		creatureMoves: structuredClone(world.creatureMoves),
		creatureHealth: structuredClone(world.creatureHealth),
		creatureStatus: structuredClone(world.creatureStatus),
		ownership: structuredClone(world.ownership),
		creatureLocation: structuredClone(world.creatureLocation),
	};
}
