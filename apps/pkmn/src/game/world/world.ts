/**
 * Central world-state module for the game's ECS domain layer.
 *
 * Defines the serializable world shape, the player- and creature-facing
 * component contracts stored in it, and the accessors that read those
 * stores through a consistent API.
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
	/** Current balance; stays at zero or above. */
	amount: number;
}

/**
 * Bestiary progress recorded once per species, covering every instance
 * encountered or caught.
 */
export interface BestiaryComponent {
	seen: SpeciesId[];
	caught: SpeciesId[];
}

/** Box storage that holds creatures outside the active party. */
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
 * Named boolean story flags persisted with the world: an opaque switch
 * (absent means unset) that survives save/load, so authored content can
 * gate a one-time event using a name the engine only stores and reports.
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
 * Older saves may lack a flags entry; reads then treat it as empty and write
 * that empty component back so later reads and writes share one record.
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

/**
 * Builds the flag name a per-entity self-switch is stored under.
 *
 * Namespacing by map and entity id keeps two entities' same-named switch
 * from colliding in the shared flag store.
 *
 * @param mapId - The map the entity belongs to.
 * @param entityId - The entity's id, unique within that map.
 * @param name - The self-switch's short authored name (e.g. "A").
 */
export function selfSwitchFlag(mapId: string, entityId: string, name: string): string {
	return `event:${mapId}:${entityId}:${name}`;
}

/**
 * Returns the split components required to rebuild one creature aggregate.
 *
 * Falls back to a default instance component for creatures saved before the
 * per-instance store existed, so old worlds still assemble a full aggregate.
 */
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
		instance: world.creatureInstance[creatureId] ?? createCreatureInstance(),
		ownership: world.ownership[creatureId],
		location: world.creatureLocation[creatureId],
	};
}

/**
 * Rebuilds one creature aggregate from split ECS component stores.
 *
 * A few runtime mechanics still expect the merged aggregate view; this is the
 * narrow adapter keeping them working while the world stays component-first.
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
