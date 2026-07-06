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

/** The nominal opponent used to label wild battles (its party stays empty). */
export const WILD_ID = createPlayerId("wild");

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

/** The level every seeded creature starts at (experience 0). */
const STARTER_LEVEL = 1;

/** Builds a migrated new-game world from content, or throws if content is empty. */
export function createNewGameWorld(content: GameDataSource): World {
	let ids = Object.keys(content.species);
	if (ids.length === 0) throw new RangeError("Content has no species to start a game.");
	let natureId = firstKey(content.natures) ?? "HARDY";
	let starterId = createCreatureId("starter");
	let starterSpeciesId = ids[0]!;

	return migrateWorld({
		entities: [HERO_ID, WILD_ID, starterId],
		playerId: HERO_ID,
		playerProfile: {
			[HERO_ID]: { name: "Hero" },
			[WILD_ID]: { name: "Wild" },
		},
		party: {
			[HERO_ID]: { creatureIds: [starterId] },
			[WILD_ID]: { creatureIds: [] },
		},
		inventory: {
			[HERO_ID]: { items: startingItems(content) },
			[WILD_ID]: { items: {} },
		},
		bestiary: {
			// The player owns the starter from the start, so it is already seen and caught.
			[HERO_ID]: { seen: [starterSpeciesId], caught: [starterSpeciesId] },
			[WILD_ID]: { seen: [], caught: [] },
		},
		storageBoxes: {
			[HERO_ID]: { boxes: [{ id: "box-1", name: "Box 1", creatureIds: [] }] },
			[WILD_ID]: { boxes: [] },
		},
		creature: { [starterId]: makeCreature(content, starterSpeciesId, natureId) },
	}) as World;
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

/**
 * Returns the moves a fresh creature knows: the most recent level-up moves it
 * would have learned by `STARTER_LEVEL`, newest last, capped at four.
 *
 * Only level-up entries count — tutor, machine, and egg moves are excluded, since
 * a starting creature has not been taught them. This mirrors the planned
 * `spawn-encounter` rule ("last four learnset moves at that level").
 */
function deriveMoveset(content: GameDataSource, species: Species): string[] {
	let learnable = species.learnset
		.filter(
			(entry): entry is Extract<typeof entry, { level: number; moveId: string }> =>
				"level" in entry && "moveId" in entry,
		)
		.filter((entry) => entry.level <= STARTER_LEVEL && content.moves[entry.moveId] !== undefined)
		.sort((a, b) => a.level - b.level);

	let seen = new Set<string>();
	let moves: string[] = [];
	for (let entry of learnable) {
		if (seen.has(entry.moveId)) continue;
		seen.add(entry.moveId);
		moves.push(entry.moveId);
	}
	return moves.slice(-4);
}

/** Builds a small starting bag by finding a capture item and a healing item in content. */
function startingItems(content: GameDataSource): Record<string, number> {
	let items: Record<string, number> = {};
	let ballId = findItem(content, (effect) => "multiplier" in effect);
	let potionId = findItem(content, (effect) => "kind" in effect && effect.kind === "heal-hp");
	if (ballId) items[ballId] = 5;
	if (potionId) items[potionId] = 3;
	return items;
}

/** Returns the id of the first item whose effect matches, or null when none do. */
function findItem(
	content: GameDataSource,
	matches: (effect: Record<string, unknown>) => boolean,
): string | null {
	for (let [id, item] of Object.entries(content.items)) {
		if ("effect" in item && item.effect && typeof item.effect === "object") {
			if (matches(item.effect as unknown as Record<string, unknown>)) return id;
		}
	}
	return null;
}

/** Returns the first key of a record, or null when it is empty. */
function firstKey(record: Record<string, unknown>): string | null {
	for (let key in record) return key;
	return null;
}
