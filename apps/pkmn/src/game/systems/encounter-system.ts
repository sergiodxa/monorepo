/**
 * Spawns wild creatures for overworld encounters and creatures for opposing trainers.
 *
 * Given a species and level, this creates a fresh creature entity, rolling anything
 * the caller omits: a random nature, individual values (0..31 per stat), and the
 * moveset (the most recent level-up moves the species would know at that level).
 * Experience is set to the exact total for the level from the species growth curve.
 * Encounter creatures live unowned at an encounter location until a capture converts
 * them; trainer creatures share that transient, unowned shape but sit at a distinct
 * trainer location the capture path refuses. All randomness flows through the
 * injected RNG so both spawns are reproducible under a seed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { GameData } from "~/game/data/game-data";
import type { MoveId } from "~/game/data/move";
import type { NatureId } from "~/game/data/nature";
import type { Gender, Species, SpeciesId } from "~/game/data/species";
import type { StatSet } from "~/game/data/stat";
import type { CreatureLocationComponent } from "~/game/world/components";
import type { MoveSet } from "~/game/world/creature";
import type { CreatureId } from "~/game/world/ids";
import type { World } from "~/game/world/world";

import { getExperienceForLevel } from "~/game/battle/mechanics";
import { Stat } from "~/game/data/stat";
import { createCreatureInstance, rollGender } from "~/game/world/components";
import { setComponent } from "~/game/world/helpers";
import { createCreatureId } from "~/game/world/ids";

/** Inputs shared by every transient-creature spawn (wild encounters and trainers). */
interface SpawnCreatureArgs {
	speciesId: SpeciesId;
	level: number;
	natureId?: NatureId;
	iv?: Partial<StatSet>;
	moveIds?: MoveId[];
	/** Explicit gender; omit to roll one from the species ratio via the RNG. */
	gender?: Gender;
}

/** Inputs for spawning one wild encounter creature. */
export interface SpawnEncounterArgs extends SpawnCreatureArgs {
	encounterId: string;
}

/** Inputs for spawning one creature fielded by an opposing trainer. */
export interface SpawnTrainerCreatureArgs extends SpawnCreatureArgs {
	trainerId: string;
}

/** Creates a wild creature entity at an encounter location and returns its id. */
export function spawnEncounter(
	gameData: GameData,
	world: World,
	args: SpawnEncounterArgs,
	random: () => number,
): { creatureId: CreatureId } {
	return spawnTransientCreature(
		gameData,
		world,
		createCreatureId(`encounter:${args.encounterId}`),
		args,
		{ kind: "encounter", encounterId: args.encounterId },
		random,
	);
}

/**
 * Creates a non-capturable creature at a trainer location and returns its id.
 *
 * The creature is transient exactly like an encounter creature — excluded from
 * persistence and despawned when its battle ends — but its `trainer` location
 * keeps the capture path from ever converting it into an owned creature.
 */
export function spawnTrainerCreature(
	gameData: GameData,
	world: World,
	args: SpawnTrainerCreatureArgs,
	random: () => number,
): { creatureId: CreatureId } {
	return spawnTransientCreature(
		gameData,
		world,
		createCreatureId(`trainer:${args.trainerId}`),
		args,
		{ kind: "trainer", trainerId: args.trainerId },
		random,
	);
}

/** Builds one transient creature entity at a given location, rolling omitted fields. */
function spawnTransientCreature(
	gameData: GameData,
	world: World,
	creatureId: CreatureId,
	args: SpawnCreatureArgs,
	location: CreatureLocationComponent,
	random: () => number,
): { creatureId: CreatureId } {
	let species = gameData.species.get(args.speciesId);
	if (!species) throw new ReferenceError(`Unknown species ${args.speciesId}.`);

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
	setComponent(
		world,
		world.creatureInstance,
		creatureId,
		createCreatureInstance({ gender: args.gender ?? rollGender(species.gender, random) }),
	);
	setComponent(world, world.creatureLocation, creatureId, location);

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
