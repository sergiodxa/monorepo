/**
 * Normalizes persisted world state into the runtime entity-component shape
 * used by the engine, and defines the accepted legacy payload contract.
 *
 * Keeps world loading tolerant while persistence formats evolve by
 * concentrating upgrade logic in one place.
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
	FlagsComponent,
	InventoryComponent,
	MoneyComponent,
	PartyComponent,
	PlayerProfileComponent,
	StorageBoxesComponent,
	World,
} from "./world";

import { createCreatureInstance, splitCreatureComponents } from "./components";
import { ensureEntityRegistered } from "./entity";

/** Legacy bootstrap shape accepted while world persistence is being migrated. */
export interface LegacyWorld {
	entities: string[];
	playerId: string;
	playerProfile: Partial<Record<string, PlayerProfileComponent>>;
	party: Partial<Record<string, PartyComponent>>;
	inventory: Partial<Record<string, InventoryComponent>>;
	money?: Partial<Record<string, MoneyComponent>>;
	bestiary: Partial<Record<string, BestiaryComponent>>;
	storageBoxes: Partial<Record<string, StorageBoxesComponent>>;
	/** Story-flag components keyed by entity id, present only on saves written after flags shipped. */
	flags?: Partial<Record<string, FlagsComponent>>;
	creature?: Partial<Record<string, LegacyCreatureComponent>>;
	creatureIdentity?: World["creatureIdentity"];
	creatureProgress?: World["creatureProgress"];
	creatureMoves?: World["creatureMoves"];
	creatureHealth?: World["creatureHealth"];
	creatureStatus?: World["creatureStatus"];
	creatureInstance?: World["creatureInstance"];
	ownership?: World["ownership"];
	creatureLocation?: World["creatureLocation"];
}

/**
 * Upgrades bootstrap or save data into the current ECS world shape.
 *
 * Backfills flags and creature-instance stores for saves predating them, and
 * splits legacy aggregate creature blobs into their explicit component stores.
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
		flags: structuredClone(input.flags ?? {}),
		creatureIdentity: structuredClone(input.creatureIdentity ?? {}),
		creatureProgress: structuredClone(input.creatureProgress ?? {}),
		creatureMoves: structuredClone(input.creatureMoves ?? {}),
		creatureHealth: structuredClone(input.creatureHealth ?? {}),
		creatureStatus: structuredClone(input.creatureStatus ?? {}),
		creatureInstance: structuredClone(input.creatureInstance ?? {}),
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
		if (!world.creatureInstance[entityId]) {
			world.creatureInstance[entityId] = createCreatureInstance();
		}
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
	world.creatureInstance[creatureId] = components.instance;
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
