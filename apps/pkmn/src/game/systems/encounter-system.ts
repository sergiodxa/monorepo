/**
 * Spawns wild creatures for overworld encounters.
 *
 * Given a species and level, this creates a fresh creature entity at an encounter
 * location, rolling anything the caller omits: a random nature, individual values
 * (0..31 per stat), and the moveset (the most recent level-up moves the species
 * would know at that level). Experience is set to the exact total for the level
 * from the species growth curve. The creature is unowned until a capture converts
 * it, so it lives only at the encounter until then. All randomness flows through
 * the injected RNG so encounters are reproducible under a seed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { GameData } from "~/game/data/game-data";
import type { MoveId } from "~/game/data/move";
import type { NatureId } from "~/game/data/nature";
import type { Species, SpeciesId } from "~/game/data/species";
import type { StatSet } from "~/game/data/stat";
import type { MoveSet } from "~/game/world/creature";
import type { CreatureId } from "~/game/world/ids";
import type { World } from "~/game/world/world";

import { getExperienceForLevel } from "~/game/battle/mechanics";
import { Stat } from "~/game/data/stat";
import { setComponent } from "~/game/world/helpers";
import { createCreatureId } from "~/game/world/ids";

/** Inputs for spawning one wild encounter creature. */
export interface SpawnEncounterArgs {
	encounterId: string;
	speciesId: SpeciesId;
	level: number;
	natureId?: NatureId;
	iv?: Partial<StatSet>;
	moveIds?: MoveId[];
}

/** Creates a wild creature entity at an encounter location and returns its id. */
export function spawnEncounter(
	gameData: GameData,
	world: World,
	args: SpawnEncounterArgs,
	random: () => number,
): { creatureId: CreatureId } {
	let species = gameData.species.get(args.speciesId);
	if (!species) throw new ReferenceError(`Unknown species ${args.speciesId}.`);

	let creatureId = createCreatureId(`encounter:${args.encounterId}`);
	let natureId = args.natureId ?? pickNature(gameData, random);
	let moveset = buildMoveset(gameData, species, args.level, args.moveIds);

	setComponent(world, world.creatureIdentity, creatureId, { speciesId: args.speciesId });
	setComponent(world, world.creatureProgress, creatureId, {
		natureId,
		experience: getExperienceForLevel(species.growthRate, args.level),
		iv: statSet((stat) => args.iv?.[stat] ?? Math.floor(random() * 32)),
		ev: statSet(() => 0),
	});
	setComponent(world, world.creatureMoves, creatureId, {
		moveset,
		pp: moveset.map((moveId) => (moveId ? (gameData.moves.get(moveId)?.pp ?? 0) : 0)) as [
			number,
			number,
			number,
			number,
		],
	});
	setComponent(world, world.creatureHealth, creatureId, { damage: 0 });
	setComponent(world, world.creatureStatus, creatureId, { state: null });
	setComponent(world, world.creatureLocation, creatureId, {
		kind: "encounter",
		encounterId: args.encounterId,
	});

	return { creatureId };
}

/** Picks a random nature id from the loaded content. */
function pickNature(gameData: GameData, random: () => number): NatureId {
	let ids = [...gameData.natures.keys()];
	if (ids.length === 0) throw new RangeError("Content has no natures to roll.");
	return ids[Math.floor(random() * ids.length)]! as NatureId;
}

/** Resolves the moveset: explicit ids if given, else derived level-up moves. */
function buildMoveset(
	gameData: GameData,
	species: Species,
	level: number,
	moveIds?: MoveId[],
): MoveSet {
	let ids =
		moveIds && moveIds.length > 0
			? moveIds.filter((moveId) => gameData.moves.has(moveId))
			: deriveLevelMoves(gameData, species, level);
	if (ids.length === 0) {
		let fallback = [...gameData.moves.keys()][0];
		if (!fallback) throw new RangeError("Content has no moves to assign.");
		ids = [fallback as MoveId];
	}
	return [ids[0]!, ids[1] ?? null, ids[2] ?? null, ids[3] ?? null];
}

/** Returns the most recent level-up moves a species knows by a given level, capped at four. */
function deriveLevelMoves(gameData: GameData, species: Species, level: number): MoveId[] {
	let learnable = species.learnset
		.filter(
			(entry): entry is Extract<typeof entry, { level: number; moveId: string }> =>
				"level" in entry && "moveId" in entry,
		)
		.filter((entry) => entry.level <= level && gameData.moves.has(entry.moveId))
		.sort((a, b) => a.level - b.level);

	let seen = new Set<string>();
	let moves: MoveId[] = [];
	for (let entry of learnable) {
		if (seen.has(entry.moveId)) continue;
		seen.add(entry.moveId);
		moves.push(entry.moveId as MoveId);
	}
	return moves.slice(-4);
}

/** Builds a full stat set by evaluating `fn` for each stat. */
function statSet(fn: (stat: Stat) => number): StatSet {
	return {
		[Stat.HP]: fn(Stat.HP),
		[Stat.Attack]: fn(Stat.Attack),
		[Stat.Defense]: fn(Stat.Defense),
		[Stat.SpecialAttack]: fn(Stat.SpecialAttack),
		[Stat.SpecialDefense]: fn(Stat.SpecialDefense),
		[Stat.Speed]: fn(Stat.Speed),
	};
}
