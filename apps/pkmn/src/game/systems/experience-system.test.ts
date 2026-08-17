import { unwrap } from "@pkg/result";
/**
 * Verifies the experience system's single-creature grants and battle experience distribution.
 *
 * The tests build a tiny medium-fast content source (experience === level cubed) so level thresholds are
 * exact, then confirm `grantCreatureExperience` accumulates experience, clamps negative amounts, and
 * reports the level delta and new total. They also confirm `awardBattleExperience` splits
 * `floor(baseExperience * enemyLevel / 7)` among non-fainted survivors, skips fainted members and
 * sub-one awards, and emits one grant per surviving creature per defeated enemy. Finally they confirm
 * each survivor gains the fainted species' `evYield` and that the per-stat (255) and total (510) EV
 * caps hold.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "vitest";

import type { LegacyCreatureComponent } from "../world/components";

import { GameData, type GameDataSource } from "../data/game-data";
import { GrowthRate } from "../data/growth-rate";
import { DamageClass, type Move } from "../data/move";
import { type Species } from "../data/species";
import { Stat } from "../data/stat";
import { createCreatureId, createPlayerId } from "../world/ids";
import { migrateWorld } from "../world/migrate";
import { type World } from "../world/world";

import {
	awardBattleExperience,
	grantCreatureEvYield,
	grantCreatureExperience,
} from "./experience-system";

let SPECIES_ID = "SPECIES_A";
let WEAK_SPECIES_ID = "SPECIES_WEAK";
let MOVE_ID = "MOVE_A";
let NATURE_ID = "HARDY";

/** Base experience of the fixture species, chosen so awards land on clean integers. */
let BASE_EXPERIENCE = 64;

/** Effort value yield of the fixture species: two stats summing to three. */
let EV_YIELD = { [Stat.Attack]: 2, [Stat.Defense]: 1 };

/** Builds a flat stat block so HP math stays predictable. */
function statSet(value: number) {
	return {
		hp: value,
		attack: value,
		defense: value,
		"special-attack": value,
		"special-defense": value,
		speed: value,
	};
}

/** Builds a medium-fast content source where experience for a level equals level cubed. */
function createGameData(): GameData {
	let species: Species = {
		number: 1,
		size: { weight: 10, height: 1 },
		types: ["normal"],
		baseExperience: BASE_EXPERIENCE,
		catchRate: 45,
		growthRate: GrowthRate.MediumFast,
		stats: statSet(50),
		evYield: EV_YIELD,
		evolutions: [],
		learnset: [{ level: 1, moveId: MOVE_ID }],
		gender: { male: 50, female: 50 },
		eggGroup: ["monster"],
	} as unknown as Species;
	let move: Move = {
		type: "normal",
		damageClass: DamageClass.Physical,
		power: 40,
		accuracy: 100,
		pp: 35,
		effect: { kind: "none" },
	};
	let source: GameDataSource = {
		species: { [SPECIES_ID]: species },
		moves: { [MOVE_ID]: move },
		items: {},
		natures: { [NATURE_ID]: { increases: null, decreases: null } },
		typeChart: {},
	};
	return unwrap(GameData.create(source));
}

/** Builds a content source that also carries a low-base-experience species for the zero-award path. */
function createWeakGameData(): GameData {
	let baseSpecies: Species = {
		number: 1,
		size: { weight: 10, height: 1 },
		types: ["normal"],
		baseExperience: BASE_EXPERIENCE,
		catchRate: 45,
		growthRate: GrowthRate.MediumFast,
		stats: statSet(50),
		evYield: EV_YIELD,
		evolutions: [],
		learnset: [{ level: 1, moveId: MOVE_ID }],
		gender: { male: 50, female: 50 },
		eggGroup: ["monster"],
	} as unknown as Species;
	let weakSpecies: Species = { ...baseSpecies, baseExperience: 3 };
	let move: Move = {
		type: "normal",
		damageClass: DamageClass.Physical,
		power: 40,
		accuracy: 100,
		pp: 35,
		effect: { kind: "none" },
	};
	let source: GameDataSource = {
		species: { [SPECIES_ID]: baseSpecies, [WEAK_SPECIES_ID]: weakSpecies },
		moves: { [MOVE_ID]: move },
		items: {},
		natures: { [NATURE_ID]: { increases: null, decreases: null } },
		typeChart: {},
	};
	return unwrap(GameData.create(source));
}

/** Builds one creature blob at the given total experience, damage, and starting EVs. */
function createCreature(
	experience: number,
	damage = 0,
	ev: LegacyCreatureComponent["ev"] = statSet(0),
): LegacyCreatureComponent {
	return {
		species: SPECIES_ID,
		nature: NATURE_ID,
		experience,
		moveset: [MOVE_ID, null, null, null],
		status: { state: null, damage, pp: [35, 0, 0, 0] },
		iv: statSet(0),
		ev,
	};
}

/** Builds a one-player world holding the given creatures by id. */
function createWorld(creatures: Record<string, LegacyCreatureComponent>): {
	world: World;
	playerId: string;
} {
	let playerId = createPlayerId("hero");
	let creatureIds = Object.keys(creatures);
	let world = migrateWorld({
		entities: [playerId, ...creatureIds],
		playerId,
		playerProfile: { [playerId]: { name: "Hero" } },
		party: { [playerId]: { creatureIds } },
		inventory: { [playerId]: { items: {} } },
		money: { [playerId]: { amount: 0 } },
		bestiary: { [playerId]: { seen: [], caught: [] } },
		storageBoxes: { [playerId]: { boxes: [] } },
		creature: creatures,
	});
	return { world, playerId };
}

test("grantCreatureExperience adds experience and reports the new total without a level change", () => {
	let id = createCreatureId("one");
	// 125 -> level 5; +50 stays under 216 (level 6), so the level is unchanged.
	let { world } = createWorld({ [id]: createCreature(125) });

	let grant = grantCreatureExperience(createGameData(), world, id, 50);

	expect(grant).toEqual({ levelBefore: 5, levelAfter: 5, totalExperience: 175 });
	expect(world.creatureProgress[id]?.experience).toBe(175);
});

test("grantCreatureExperience reports a level increase when the threshold is crossed", () => {
	let id = createCreatureId("one");
	// 125 (level 5) + 875 = 1000, exactly level 10.
	let { world } = createWorld({ [id]: createCreature(125) });

	let grant = grantCreatureExperience(createGameData(), world, id, 875);

	expect(grant).toEqual({ levelBefore: 5, levelAfter: 10, totalExperience: 1000 });
});

test("grantCreatureExperience clamps a negative amount to zero", () => {
	let id = createCreatureId("one");
	let { world } = createWorld({ [id]: createCreature(125) });

	let grant = grantCreatureExperience(createGameData(), world, id, -500);

	expect(grant).toEqual({ levelBefore: 5, levelAfter: 5, totalExperience: 125 });
	expect(world.creatureProgress[id]?.experience).toBe(125);
});

test("awardBattleExperience gives the full split to a single survivor", () => {
	let ally = createCreatureId("ally");
	let enemy = createCreatureId("enemy");
	// Enemy at level 10: floor(64 * 10 / 7) = 91, split among 1 survivor.
	let { world } = createWorld({ [ally]: createCreature(125), [enemy]: createCreature(1000) });

	let grants = awardBattleExperience(createGameData(), world, [enemy], [ally]);

	expect(grants).toHaveLength(1);
	expect(grants[0]?.creatureId).toBe(ally);
	expect(grants[0]?.totalExperience).toBe(125 + 91);
	expect(world.creatureProgress[ally]?.experience).toBe(216);
});

test("awardBattleExperience splits the award evenly across two survivors", () => {
	let allyA = createCreatureId("ally-a");
	let allyB = createCreatureId("ally-b");
	let enemy = createCreatureId("enemy");
	// floor(64 * 10 / 7) = 91, floor(91 / 2) = 45 to each survivor.
	let { world } = createWorld({
		[allyA]: createCreature(125),
		[allyB]: createCreature(125),
		[enemy]: createCreature(1000),
	});

	let grants = awardBattleExperience(createGameData(), world, [enemy], [allyA, allyB]);

	expect(grants).toHaveLength(2);
	expect(world.creatureProgress[allyA]?.experience).toBe(125 + 45);
	expect(world.creatureProgress[allyB]?.experience).toBe(125 + 45);
});

test("awardBattleExperience gives fainted party members nothing", () => {
	let survivor = createCreatureId("survivor");
	let fainted = createCreatureId("fainted");
	let enemy = createCreatureId("enemy");
	// Fixture HP at level 5 is 20, so damage 20 marks a fainted member (damage >= maxHP).
	let { world } = createWorld({
		[survivor]: createCreature(125),
		[fainted]: createCreature(125, 20),
		[enemy]: createCreature(1000),
	});

	let grants = awardBattleExperience(createGameData(), world, [enemy], [survivor, fainted]);

	// Only the survivor is a participant, so it gets the full 91 and the fainted one is untouched.
	expect(grants.map((grant) => grant.creatureId)).toEqual([survivor]);
	expect(world.creatureProgress[survivor]?.experience).toBe(125 + 91);
	expect(world.creatureProgress[fainted]?.experience).toBe(125);
});

test("awardBattleExperience returns nothing when every party member has fainted", () => {
	let fainted = createCreatureId("fainted");
	let enemy = createCreatureId("enemy");
	let { world } = createWorld({
		[fainted]: createCreature(125, 20),
		[enemy]: createCreature(1000),
	});

	let grants = awardBattleExperience(createGameData(), world, [enemy], [fainted]);

	expect(grants).toEqual([]);
});

test("awardBattleExperience skips an enemy whose award rounds down to zero", () => {
	let ally = createCreatureId("ally");
	let weakEnemy = createCreatureId("weak");
	// A base-experience-3 enemy at level 1: floor(3 * 1 / 7) === 0, so no experience is awarded.
	let { world } = createWorld({
		[ally]: createCreature(125),
		[weakEnemy]: createCreature(0),
	});
	// Point the enemy at the low-base-experience species loaded into the weak game data.
	world.creatureIdentity[weakEnemy] = { speciesId: WEAK_SPECIES_ID };

	let grants = awardBattleExperience(createWeakGameData(), world, [weakEnemy], [ally]);

	expect(grants).toEqual([]);
	expect(world.creatureProgress[ally]?.experience).toBe(125);
});

test("awardBattleExperience skips an enemy id with no identity component", () => {
	let ally = createCreatureId("ally");
	let missingEnemy = createCreatureId("missing");
	let { world } = createWorld({ [ally]: createCreature(125) });

	let grants = awardBattleExperience(createGameData(), world, [missingEnemy], [ally]);

	expect(grants).toEqual([]);
	expect(world.creatureProgress[ally]?.experience).toBe(125);
});

test("awardBattleExperience emits one grant per enemy for a survivor", () => {
	let ally = createCreatureId("ally");
	let enemyA = createCreatureId("enemy-a");
	let enemyB = createCreatureId("enemy-b");
	let { world } = createWorld({
		[ally]: createCreature(125),
		[enemyA]: createCreature(1000),
		[enemyB]: createCreature(1000),
	});

	let grants = awardBattleExperience(createGameData(), world, [enemyA, enemyB], [ally]);

	// One grant per defeated enemy, each adding 91.
	expect(grants).toHaveLength(2);
	expect(world.creatureProgress[ally]?.experience).toBe(125 + 91 + 91);
});

test("awardBattleExperience adds the fainted species' EV yield to each survivor", () => {
	let allyA = createCreatureId("ally-a");
	let allyB = createCreatureId("ally-b");
	let enemy = createCreatureId("enemy");
	let { world } = createWorld({
		[allyA]: createCreature(125),
		[allyB]: createCreature(125),
		[enemy]: createCreature(1000),
	});

	awardBattleExperience(createGameData(), world, [enemy], [allyA, allyB]);

	// Both survivors gain the fixture yield of Attack +2, Defense +1.
	for (let ally of [allyA, allyB]) {
		expect(world.creatureProgress[ally]?.ev[Stat.Attack]).toBe(2);
		expect(world.creatureProgress[ally]?.ev[Stat.Defense]).toBe(1);
		expect(world.creatureProgress[ally]?.ev[Stat.HP]).toBe(0);
	}
});

test("awardBattleExperience accumulates EV yield across multiple defeated enemies", () => {
	let ally = createCreatureId("ally");
	let enemyA = createCreatureId("enemy-a");
	let enemyB = createCreatureId("enemy-b");
	let { world } = createWorld({
		[ally]: createCreature(125),
		[enemyA]: createCreature(1000),
		[enemyB]: createCreature(1000),
	});

	awardBattleExperience(createGameData(), world, [enemyA, enemyB], [ally]);

	// Two faints of the fixture species: Attack +2 twice, Defense +1 twice.
	expect(world.creatureProgress[ally]?.ev[Stat.Attack]).toBe(4);
	expect(world.creatureProgress[ally]?.ev[Stat.Defense]).toBe(2);
});

test("awardBattleExperience still awards EV yield when the experience award rounds to zero", () => {
	let ally = createCreatureId("ally");
	let weakEnemy = createCreatureId("weak");
	// A base-experience-3 enemy at level 1 awards no experience, but still yields EVs on faint.
	let { world } = createWorld({
		[ally]: createCreature(125),
		[weakEnemy]: createCreature(0),
	});
	world.creatureIdentity[weakEnemy] = { speciesId: WEAK_SPECIES_ID };

	let grants = awardBattleExperience(createWeakGameData(), world, [weakEnemy], [ally]);

	expect(grants).toEqual([]);
	expect(world.creatureProgress[ally]?.experience).toBe(125);
	expect(world.creatureProgress[ally]?.ev[Stat.Attack]).toBe(2);
	expect(world.creatureProgress[ally]?.ev[Stat.Defense]).toBe(1);
});

test("grantCreatureEvYield clamps a single stat to 255", () => {
	let id = createCreatureId("one");
	let { world } = createWorld({ [id]: createCreature(125, 0, statSet(0)) });

	// Apply Attack +255 twelve times; the stat can never exceed 255.
	for (let index = 0; index < 12; index += 1) {
		grantCreatureEvYield(world, id, { [Stat.Attack]: 255 });
	}

	expect(world.creatureProgress[id]?.ev[Stat.Attack]).toBe(255);
});

test("grantCreatureEvYield stops adding once the 510 total cap is reached", () => {
	let id = createCreatureId("one");
	// Start already carrying 508 EVs (255 Attack + 253 Defense), leaving 2 points of headroom.
	let startingEv = {
		...statSet(0),
		[Stat.Attack]: 255,
		[Stat.Defense]: 253,
	};
	let { world } = createWorld({ [id]: createCreature(125, 0, startingEv) });

	// A yield of Speed +3 can only add 2 before the 510 total cap blocks the rest.
	grantCreatureEvYield(world, id, { [Stat.Speed]: 3 });

	let ev = world.creatureProgress[id]?.ev;
	expect(ev?.[Stat.Speed]).toBe(2);
	let total = Object.values(Stat).reduce((sum, stat) => sum + (ev?.[stat] ?? 0), 0);
	expect(total).toBe(510);
});

test("grantCreatureEvYield is a no-op for a missing or empty yield", () => {
	let id = createCreatureId("one");
	let { world } = createWorld({ [id]: createCreature(125, 0, { ...statSet(0), [Stat.HP]: 4 }) });

	grantCreatureEvYield(world, id, undefined);
	grantCreatureEvYield(world, id, {});

	expect(world.creatureProgress[id]?.ev[Stat.HP]).toBe(4);
});
