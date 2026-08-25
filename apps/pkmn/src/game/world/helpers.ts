/**
 * Shared world helper primitives for the ECS-style storage layer.
 *
 * Centralizes read/write/enumerate/trim utilities for world component
 * stores, and separates persistent save data from transient runtime state.
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
	"money",
	"bestiary",
	"storageBoxes",
	"flags",
	"creatureIdentity",
	"creatureProgress",
	"creatureMoves",
	"creatureHealth",
	"creatureStatus",
	"creatureInstance",
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
 * Excludes wild encounter and opposing trainer creatures because they are
 * transient; only long-lived player and creature state remains.
 */
export function pickPersistentWorld(world: World) {
	let excluded = new Set<EntityId>();
	for (let entityId of Object.keys(world.creatureLocation)) {
		let kind = world.creatureLocation[entityId]?.kind;
		if (kind === "encounter" || kind === "trainer") excluded.add(entityId);
	}

	let persistentIds = new Set<EntityId>([world.playerId]);
	for (let key of PERSISTENT_WORLD_STORE_KEYS) {
		for (let entityId of Object.keys(world[key])) {
			if (!excluded.has(entityId)) persistentIds.add(entityId);
		}
	}

	let cloneWithout = <T>(store: ComponentStore<T>): ComponentStore<T> => {
		let out: ComponentStore<T> = {};
		for (let entityId of Object.keys(store)) {
			if (!excluded.has(entityId)) out[entityId] = structuredClone(store[entityId]);
		}
		return out;
	};

	return {
		entities: world.entities.filter((entityId) => persistentIds.has(entityId)),
		playerId: world.playerId,
		playerProfile: structuredClone(world.playerProfile),
		party: structuredClone(world.party),
		inventory: structuredClone(world.inventory),
		money: structuredClone(world.money),
		bestiary: structuredClone(world.bestiary),
		storageBoxes: structuredClone(world.storageBoxes),
		flags: structuredClone(world.flags),
		creatureIdentity: cloneWithout(world.creatureIdentity),
		creatureProgress: cloneWithout(world.creatureProgress),
		creatureMoves: cloneWithout(world.creatureMoves),
		creatureHealth: cloneWithout(world.creatureHealth),
		creatureStatus: cloneWithout(world.creatureStatus),
		creatureInstance: cloneWithout(world.creatureInstance),
		ownership: cloneWithout(world.ownership),
		creatureLocation: cloneWithout(world.creatureLocation),
	};
}
