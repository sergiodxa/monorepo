/**
 * Builds the initial world for a new game from authored content.
 *
 * The presentation composes a starting world without hardcoding any franchise
 * ids: it derives the starter and the wild-encounter pool from the loaded
 * content registries (first species for the starter, the next few for wilds) and
 * each creature's moves from its own learnset. Wild creatures are pre-seeded as
 * entities owned by a dedicated "wild" player so the overworld can start real
 * battles with the shipped `start-battle` command; a future `spawn-encounter`
 * command (planned in ADR-001 2.6) will replace the pool with rolled encounters.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { GameDataSource } from "~/game/data/game-data";
import type { Species } from "~/game/data/species";
import type { StatSet } from "~/game/data/stat";
import type { World } from "~/game/world/world";

import { Stat } from "~/game/data/stat";
import { createCreatureId, createPlayerId } from "~/game/world/ids";
import { migrateWorld } from "~/game/world/migrate";

/** The player id every new game starts with. */
export const HERO_ID = createPlayerId("hero");

/** The owner of the pre-seeded wild-encounter creatures. */
export const WILD_ID = createPlayerId("wild");

/** Species chosen for the player's starter and the wild pool. */
export interface StarterChoice {
	starterSpeciesId: string;
	wildSpeciesIds: string[];
}

/** A creature blob in the legacy shape `migrateWorld` splits into components. */
interface CreatureBlob {
	species: string;
	nature: string;
	experience: number;
	moveset: [string, string | null, string | null, string | null];
	status: { state: null; damage: number; pp: [number, number, number, number] };
	iv: StatSet;
	ev: StatSet;
}

/** Maximum individual values, applied uniformly to seeded creatures. */
const PERFECT_IV = 31;

/** Builds a migrated new-game world from content, or throws if content is empty. */
export function createNewGameWorld(content: GameDataSource): World {
	let choice = pickStarters(content);
	let natureId = firstKey(content.natures) ?? "HARDY";

	let starterId = createCreatureId("starter");
	let wildIds = choice.wildSpeciesIds.map((_, index) => createCreatureId(`wild-${index + 1}`));

	let creature: Record<string, CreatureBlob> = {
		[starterId]: makeCreature(content, choice.starterSpeciesId, natureId),
	};
	for (let index = 0; index < wildIds.length; index++) {
		creature[wildIds[index]!] = makeCreature(content, choice.wildSpeciesIds[index]!, natureId);
	}

	return migrateWorld({
		entities: [HERO_ID, WILD_ID, starterId, ...wildIds],
		playerId: HERO_ID,
		playerProfile: {
			[HERO_ID]: { name: "Hero" },
			[WILD_ID]: { name: "Wild" },
		},
		party: {
			[HERO_ID]: { creatureIds: [starterId] },
			[WILD_ID]: { creatureIds: wildIds },
		},
		inventory: {
			[HERO_ID]: { items: {} },
			[WILD_ID]: { items: {} },
		},
		bestiary: {
			[HERO_ID]: { seen: [], caught: [] },
			[WILD_ID]: { seen: [], caught: [] },
		},
		storageBoxes: {
			[HERO_ID]: { boxes: [{ id: "box-1", name: "Box 1", creatureIds: [] }] },
			[WILD_ID]: { boxes: [] },
		},
		creature,
	}) as World;
}

/** The wild creature ids seeded into the world, in encounter-pool order. */
export function wildCreatureIds(wildCount: number): string[] {
	return Array.from({ length: wildCount }, (_, index) => createCreatureId(`wild-${index + 1}`));
}

/** Picks a starter species and up to three wild species from content order. */
function pickStarters(content: GameDataSource): StarterChoice {
	let ids = Object.keys(content.species);
	if (ids.length === 0) throw new RangeError("Content has no species to start a game.");
	let starterSpeciesId = ids[0]!;
	let wildSpeciesIds = ids.slice(1, 4);
	if (wildSpeciesIds.length === 0) wildSpeciesIds = [starterSpeciesId];
	return { starterSpeciesId, wildSpeciesIds };
}

/** Builds one creature blob for a species, deriving its moveset from the learnset. */
function makeCreature(content: GameDataSource, speciesId: string, natureId: string): CreatureBlob {
	let species = content.species[speciesId];
	let moveIds = species ? deriveMoveset(content, species) : [];
	let primary = moveIds[0] ?? firstKey(content.moves);
	if (primary === null) throw new RangeError("Content has no moves to build a moveset.");
	let moveset: CreatureBlob["moveset"] = [
		primary,
		moveIds[1] ?? null,
		moveIds[2] ?? null,
		moveIds[3] ?? null,
	];
	let pp = moveset.map((id) => (id ? (content.moves[id]?.pp ?? 0) : 0)) as [
		number,
		number,
		number,
		number,
	];

	return {
		species: speciesId,
		nature: natureId,
		experience: 0,
		moveset,
		status: { state: null, damage: 0, pp },
		iv: makeStatSet(PERFECT_IV),
		ev: makeStatSet(0),
	};
}

/** Builds a full stat set with one value on every stat. */
function makeStatSet(value: number): StatSet {
	return {
		[Stat.HP]: value,
		[Stat.Attack]: value,
		[Stat.Defense]: value,
		[Stat.SpecialAttack]: value,
		[Stat.SpecialDefense]: value,
		[Stat.Speed]: value,
	};
}

/** Returns the earliest four learnset moves (by level) that name a move. */
function deriveMoveset(content: GameDataSource, species: Species): string[] {
	let leveled = species.learnset
		.filter((entry): entry is Extract<typeof entry, { moveId: string }> => "moveId" in entry)
		.map((entry) => ({ moveId: entry.moveId, level: "level" in entry ? entry.level : 0 }))
		.filter((entry) => content.moves[entry.moveId] !== undefined)
		.sort((a, b) => a.level - b.level);

	let seen = new Set<string>();
	let moves: string[] = [];
	for (let entry of leveled) {
		if (seen.has(entry.moveId)) continue;
		seen.add(entry.moveId);
		moves.push(entry.moveId);
		if (moves.length === 4) break;
	}
	return moves;
}

/** Returns the first key of a record, or null when it is empty. */
function firstKey(record: Record<string, unknown>): string | null {
	for (let key in record) return key;
	return null;
}
