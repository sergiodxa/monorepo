/**
 * Normalizes persisted world state into the runtime entity-component shape used by the engine. This module
 * defines the accepted legacy payload contract and provides the migration entry points that turn older save
 * data into the current component store layout.
 *
 * It exists to keep world loading tolerant while persistence formats evolve. By concentrating upgrade logic in
 * one place, the rest of the engine can rely on a stable world structure without carrying compatibility rules
 * throughout unrelated systems.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type {
	CreatureBattleLocationComponent,
	CreatureComponentSet,
	CreatureEncounterLocationComponent,
	CreatureLocationComponent,
	LegacyCreatureComponent,
} from "./components";
import type {
	BestiaryComponent,
	InventoryComponent,
	MoneyComponent,
	PartyComponent,
	PlayerProfileComponent,
	StorageBoxesComponent,
	World,
} from "./world";

import { splitCreatureComponents } from "./components";
import { ensureEntityRegistered } from "./entity";

/** Legacy bootstrap shape accepted while world persistence is being migrated. */
export interface LegacyWorld {
	/** Every known entity id in the bootstrap payload. */
	entities: string[];
	/** Player entity currently controlled by the save. */
	playerId: string;
	/** Profile components keyed by entity id. */
	playerProfile: Partial<Record<string, PlayerProfileComponent>>;
	/** Party components keyed by entity id. */
	party: Partial<Record<string, PartyComponent>>;
	/** Inventory components keyed by entity id. */
	inventory: Partial<Record<string, InventoryComponent>>;
	/** Money components keyed by entity id. */
	money?: Partial<Record<string, MoneyComponent>>;
	/** Bestiary components keyed by entity id. */
	bestiary: Partial<Record<string, BestiaryComponent>>;
	/** Storage components keyed by entity id. */
	storageBoxes: Partial<Record<string, StorageBoxesComponent>>;
	/** Legacy aggregate creature blobs keyed by entity id. */
	creature?: Partial<Record<string, LegacyCreatureComponent>>;
	/** Split creature identity components keyed by entity id. */
	creatureIdentity?: World["creatureIdentity"];
	/** Split creature progress components keyed by entity id. */
	creatureProgress?: World["creatureProgress"];
	/** Split creature moves components keyed by entity id. */
	creatureMoves?: World["creatureMoves"];
	/** Split creature health components keyed by entity id. */
	creatureHealth?: World["creatureHealth"];
	/** Split creature status components keyed by entity id. */
	creatureStatus?: World["creatureStatus"];
	/** Creature ownership components keyed by entity id. */
	ownership?: World["ownership"];
	/** Creature placement components keyed by entity id. */
	creatureLocation?: World["creatureLocation"];
}

/**
 * Upgrades bootstrap or save data into the current ECS world shape.
 *
 * Migration keeps engine boot permissive while the runtime data model evolves. Older aggregate creature
 * blobs are split into explicit component stores so the rest of the engine can assume the final shape.
 */
export function migrateWorld(input: LegacyWorld | World): World {
	let world: World = {
		entities: [...input.entities],
		playerId: input.playerId,
		playerProfile: structuredClone(input.playerProfile),
		party: structuredClone(input.party),
		inventory: structuredClone(input.inventory),
		money: structuredClone(input.money ?? {}),
		bestiary: structuredClone(input.bestiary),
		storageBoxes: structuredClone(input.storageBoxes),
		creatureIdentity: structuredClone(input.creatureIdentity ?? {}),
		creatureProgress: structuredClone(input.creatureProgress ?? {}),
		creatureMoves: structuredClone(input.creatureMoves ?? {}),
		creatureHealth: structuredClone(input.creatureHealth ?? {}),
		creatureStatus: structuredClone(input.creatureStatus ?? {}),
		ownership: structuredClone(input.ownership ?? {}),
		creatureLocation: structuredClone(input.creatureLocation ?? {}),
		activeBattle: {},
		battleParticipants: {},
		battlePhase: {},
		battleField: {},
		battleSide: {},
		battlePendingTurn: {},
		battlePendingReplacement: {},
		battleLog: {},
		battleMember: {},
	};

	if ("creature" in input && input.creature) {
		for (let [creatureId, creature] of Object.entries(input.creature)) {
			if (!creature) continue;

			let components = splitCreatureComponents({
				creatureId,
				creature: creature as LegacyCreatureComponent,
				ownerId: getCreatureOwnerId(input, creatureId),
				location: inferCreatureLocation(input, creatureId),
			});
			applyCreatureComponentSet(world, creatureId, components);
		}
	}

	for (let entityId of Object.keys(world.creatureIdentity)) {
		ensureEntityRegistered(world.entities, entityId);
	}

	return world;
}

/**
 * Writes one split creature component set into the world stores.
 *
 * Centralizing this write keeps migrations and future capture/bootstrap flows aligned on the same store
 * layout and registration behavior.
 */
export function applyCreatureComponentSet(
	world: World,
	creatureId: string,
	components: CreatureComponentSet,
) {
	ensureEntityRegistered(world.entities, creatureId);
	world.creatureIdentity[creatureId] = components.identity;
	world.creatureProgress[creatureId] = components.progress;
	world.creatureMoves[creatureId] = components.moves;
	world.creatureHealth[creatureId] = components.health;
	world.creatureStatus[creatureId] = components.status;
	if (components.ownership) world.ownership[creatureId] = components.ownership;
	if (components.location) world.creatureLocation[creatureId] = components.location;
}

/**
 * Infers the owning player for one creature from the persistent containers that currently reference it.
 *
 * Ownership is derived during migration so older saves that only tracked party or storage membership still
 * produce explicit ownership components in the new world shape.
 */
export function getCreatureOwnerId(
	input: LegacyWorld | World,
	creatureId: string,
): string | undefined {
	for (let [playerId, party] of Object.entries(input.party)) {
		if (party?.creatureIds.includes(creatureId)) return playerId;
	}

	for (let [playerId, storage] of Object.entries(input.storageBoxes)) {
		if (!storage) continue;
		for (let box of storage.boxes) {
			if (box.creatureIds.includes(creatureId)) return playerId;
		}
	}

	return input.ownership?.[creatureId]?.ownerId;
}

/**
 * Infers the initial persistent or transient location for one creature entity.
 *
 * Migration prefers explicit location data when present, then falls back to container membership so the
 * runtime can build selector-friendly placement components without hand-authored duplication.
 */
export function inferCreatureLocation(
	input: LegacyWorld | World,
	creatureId: string,
): CreatureLocationComponent | undefined {
	let existingLocation = input.creatureLocation?.[creatureId];
	if (existingLocation) return structuredClone(existingLocation);

	for (let [playerId, party] of Object.entries(input.party)) {
		let slot = party?.creatureIds.indexOf(creatureId) ?? -1;
		if (slot >= 0) {
			return { kind: "party", playerId, slot };
		}
	}

	for (let [playerId, storage] of Object.entries(input.storageBoxes)) {
		if (!storage) continue;
		for (let box of storage.boxes) {
			let slot = box.creatureIds.indexOf(creatureId);
			if (slot >= 0) {
				return { kind: "storage", playerId, boxId: box.id, slot };
			}
		}
	}

	let battleLocation = inferBattleLocation(input, creatureId);
	if (battleLocation) return battleLocation;

	return inferEncounterLocation(creatureId);
}

/** Infers a transient battle placement when legacy battle components reference a creature. */
function inferBattleLocation(
	input: LegacyWorld | World,
	creatureId: string,
): CreatureBattleLocationComponent | undefined {
	for (let [battleId, participants] of Object.entries((input as World).battleParticipants ?? {})) {
		let allySlot = participants?.playerParty.indexOf(creatureId) ?? -1;
		if (allySlot >= 0) return { kind: "battle", battleId, side: 0, slot: allySlot };

		let enemySlot = participants?.enemyParty.indexOf(creatureId) ?? -1;
		if (enemySlot >= 0) return { kind: "battle", battleId, side: 1, slot: enemySlot };
	}

	return undefined;
}

/** Leaves unowned creatures marked as encounter data until captured. */
function inferEncounterLocation(
	creatureId: string,
): CreatureEncounterLocationComponent | undefined {
	if (creatureId.length === 0) return undefined;
	return { kind: "encounter", encounterId: creatureId };
}
