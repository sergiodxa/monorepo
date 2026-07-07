/**
 * Central world-state module for the game's ECS domain layer.
 *
 * This module defines the serializable world shape, the player-facing and
 * creature-facing component contracts stored in that world, and the accessors
 * that read those stores through a consistent API.
 *
 * It acts as the canonical boundary for world data composition, keeping entity
 * ids, component stores, and higher-level world queries aligned so other parts
 * of the engine can depend on a stable representation of runtime state.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ItemId } from "~/game/data/item";
import type { SpeciesId } from "~/game/data/species";

import type {
	BattleFieldStore,
	BattleLogStore,
	BattleMemberStore,
	BattleParticipantsStore,
	BattlePendingReplacementStore,
	BattlePendingTurnStore,
	BattlePhaseStore,
	BattleSideStore,
} from "./battle";
import type {
	CreatureComponentSet,
	CreatureHealthComponent,
	CreatureIdentityComponent,
	CreatureInstanceComponent,
	CreatureLocationComponent,
	CreatureMovesComponent,
	CreatureProgressComponent,
	CreatureStatusComponent,
	OwnershipComponent,
} from "./components";
import type { EntityId } from "./entity";
import type { BattleId, CreatureId, PlayerId } from "./ids";

import { createCreatureInstance, mergeCreatureComponents } from "./components";
import { Creature } from "./creature";
import { requireComponent, type ComponentStore } from "./helpers";

/** Mutable profile fields owned by the single player root. */
export interface PlayerProfileComponent {
	/** Display name shown by UI surfaces. */
	name: string;
}

/** Active party membership stored as stable creature identifiers. */
export interface PartyComponent {
	/** Ordered creature ids currently carried by the player. */
	creatureIds: CreatureId[];
}

/** Bag contents grouped by static item identifier. */
export interface InventoryComponent {
	/** Grouped stack counts keyed by item identifier. */
	items: Partial<Record<ItemId, number>>;
}

/** Spendable currency balance owned by the player root. */
export interface MoneyComponent {
	/** Current balance; never negative. */
	amount: number;
}

/** Bestiary progress tracked by species rather than creature instance. */
export interface BestiaryComponent {
	/** Species the player has encountered. */
	seen: SpeciesId[];
	/** Species the player has captured. */
	caught: SpeciesId[];
}

/** Box storage that holds creatures not currently in the party. */
export interface StorageBoxesComponent {
	/** Named boxes with ordered creature membership. */
	boxes: Array<{ id: string; name: string; creatureIds: CreatureId[] }>;
}

/** Current battle reference attached to the player root when a battle is active. */
export interface ActiveBattleComponent {
	/** Transient battle entity currently associated with this player. */
	battleId: BattleId;
}

/**
 * Named boolean story flags persisted with the world.
 *
 * A flag is a small, engine-generic switch (`false`/absent means unset) that
 * survives across turns and save/load, so authored content can gate a one-time
 * event or record that something happened. The engine stays vocabulary-free: it
 * neither reads nor assigns any meaning to a flag's name, it only stores and
 * reports the boolean the caller sets.
 */
export interface FlagsComponent {
	/** Flag values keyed by name; a missing or false entry means the flag is unset. */
	values: Record<string, boolean>;
}

/** Serializable ECS-style world state backed by component stores. */
export interface World {
	/** Every entity currently registered in the world. */
	entities: EntityId[];
	/** The single player root entity for the current save. */
	playerId: PlayerId;
	/** Player profile components keyed by entity id. */
	playerProfile: ComponentStore<PlayerProfileComponent>;
	/** Party components keyed by entity id. */
	party: ComponentStore<PartyComponent>;
	/** Inventory components keyed by entity id. */
	inventory: ComponentStore<InventoryComponent>;
	/** Money components keyed by entity id. */
	money: ComponentStore<MoneyComponent>;
	/** Bestiary components keyed by entity id. */
	bestiary: ComponentStore<BestiaryComponent>;
	/** Storage components keyed by entity id. */
	storageBoxes: ComponentStore<StorageBoxesComponent>;
	/** Split creature identity components keyed by creature id. */
	creatureIdentity: ComponentStore<CreatureIdentityComponent>;
	/** Split creature progress components keyed by creature id. */
	creatureProgress: ComponentStore<CreatureProgressComponent>;
	/** Split creature move components keyed by creature id. */
	creatureMoves: ComponentStore<CreatureMovesComponent>;
	/** Split creature health components keyed by creature id. */
	creatureHealth: ComponentStore<CreatureHealthComponent>;
	/** Split creature status components keyed by creature id. */
	creatureStatus: ComponentStore<CreatureStatusComponent>;
	/** Per-instance creature state (gender, held item, friendship) keyed by creature id. */
	creatureInstance: ComponentStore<CreatureInstanceComponent>;
	/** Ownership components keyed by creature id. */
	ownership: ComponentStore<OwnershipComponent>;
	/** Location components keyed by creature id. */
	creatureLocation: ComponentStore<CreatureLocationComponent>;
	/** Named story-flag values keyed by the player root entity id. */
	flags: ComponentStore<FlagsComponent>;
	/** Active battle references keyed by entity id. */
	activeBattle: ComponentStore<ActiveBattleComponent>;
	/** Battle participants keyed by battle entity id. */
	battleParticipants: BattleParticipantsStore;
	/** Battle phase mirrors keyed by battle entity id. */
	battlePhase: BattlePhaseStore;
	/** Shared field state keyed by battle entity id. */
	battleField: BattleFieldStore;
	/** Side-specific battle state keyed by side entity id. */
	battleSide: BattleSideStore;
	/** Pending turn input keyed by battle entity id. */
	battlePendingTurn: BattlePendingTurnStore;
	/** Pending replacement input keyed by battle entity id. */
	battlePendingReplacement: BattlePendingReplacementStore;
	/** Ordered battle event log keyed by battle entity id. */
	battleLog: BattleLogStore;
	/** Transient battle member mirrors keyed by battle-member entity id. */
	battleMember: BattleMemberStore;
}

/** Returns the player profile for the current player root. */
export function getPlayerProfile(world: World): PlayerProfileComponent {
	return requireComponent(world.playerProfile, world.playerId, "player profile");
}

/** Returns the player's current party component. */
export function getPlayerParty(world: World): PartyComponent {
	return requireComponent(world.party, world.playerId, "party");
}

/** Returns the player's current inventory component. */
export function getPlayerInventory(world: World): InventoryComponent {
	return requireComponent(world.inventory, world.playerId, "inventory");
}

/** Returns one player's current money balance, defaulting to zero when absent. */
export function getPlayerMoney(world: World, playerId: PlayerId): number {
	return world.money[playerId]?.amount ?? 0;
}

/** Returns the player's current bestiary component. */
export function getPlayerBestiary(world: World): BestiaryComponent {
	return requireComponent(world.bestiary, world.playerId, "bestiary");
}

/** Returns the player's current storage component. */
export function getPlayerStorageBoxes(world: World): StorageBoxesComponent {
	return requireComponent(world.storageBoxes, world.playerId, "storage boxes");
}

/**
 * Returns the player's story-flag component, materializing an empty one when absent.
 *
 * Flags are optional on older saves, so this never throws: a world without a
 * flags entry is treated as having no flags set, and the empty component is
 * written back so later reads and writes share one record.
 */
export function getFlags(world: World): FlagsComponent {
	let flags = world.flags[world.playerId];
	if (flags) return flags;
	let created: FlagsComponent = { values: {} };
	world.flags[world.playerId] = created;
	return created;
}

/** Reads one named flag, defaulting to false when unset. */
export function getFlag(world: World, flag: string): boolean {
	return getFlags(world).values[flag] === true;
}

/** Sets one named flag to a boolean value and returns the value written. */
export function setFlag(world: World, flag: string, value = true): boolean {
	getFlags(world).values[flag] = value;
	return value;
}

/** Returns the split components required to rebuild one creature aggregate. */
export function getCreatureComponentSet(
	world: World,
	creatureId: CreatureId,
): CreatureComponentSet {
	return {
		identity: requireComponent(world.creatureIdentity, creatureId, "creature identity"),
		progress: requireComponent(world.creatureProgress, creatureId, "creature progress"),
		moves: requireComponent(world.creatureMoves, creatureId, "creature moves"),
		health: requireComponent(world.creatureHealth, creatureId, "creature health"),
		status: requireComponent(world.creatureStatus, creatureId, "creature status"),
		// Absent on worlds that predate the instance store: fall back to the default.
		instance: world.creatureInstance[creatureId] ?? createCreatureInstance(),
		ownership: world.ownership[creatureId],
		location: world.creatureLocation[creatureId],
	};
}

/**
 * Rebuilds one creature aggregate from split ECS component stores.
 *
 * The runtime still has a few mechanics that expect the aggregate view, so this function is the narrow
 * adapter that keeps those callers working while the rest of the world stays component-first.
 */
export function createCreatureFromWorld(world: World, creatureId: CreatureId): Creature {
	return new Creature(mergeCreatureComponents(getCreatureComponentSet(world, creatureId)));
}

/** Returns one creature's per-instance state, defaulting when the store has no entry. */
export function getCreatureInstance(
	world: World,
	creatureId: CreatureId,
): CreatureInstanceComponent {
	return world.creatureInstance[creatureId] ?? createCreatureInstance();
}

/** Returns the item one creature currently holds, or null when it holds nothing. */
export function getCreatureHeldItem(world: World, creatureId: CreatureId): ItemId | null {
	return getCreatureInstance(world, creatureId).heldItemId;
}

/**
 * Sets or clears the item one creature holds and returns the resulting held item.
 *
 * Passing null clears the held item. The write preserves the rest of the instance
 * state and materializes a default record for creatures that predate the store.
 */
export function setCreatureHeldItem(
	world: World,
	creatureId: CreatureId,
	heldItemId: ItemId | null,
): ItemId | null {
	let instance = getCreatureInstance(world, creatureId);
	world.creatureInstance[creatureId] = { ...instance, heldItemId };
	return heldItemId;
}
