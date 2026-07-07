/**
 * Proves the replay harness enforces engine determinism as a regression guard. It builds a fixed initial engine from authored content the same way the engine's own tests do, then replays a fixed, RNG-sensitive command sequence to assert two invariants.
 *
 * The assertions stay outcome-agnostic on purpose: the same seed must reproduce identical events and snapshots, and a different seed must change the observable result. Concrete battle numbers are never asserted because the mechanics they depend on are owned by another module and may change.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "bun:test";

import { ITEMS } from "~/content/items";
import { TYPE_MATCHUPS } from "~/content/matchups";
import { MOVES } from "~/content/moves";
import { NATURES } from "~/content/natures";
import { SPECIES } from "~/content/species";

import type { Command } from "./commands";
import type { Recording } from "./replay";

import { Engine } from "./engine";
import { assertDeterministicReplay, replaySession, replaysAreEqual } from "./replay";
import { createBattleId, createCreatureId, createPlayerId } from "./world/ids";
import { migrateWorld } from "./world/migrate";

/** Fixed content identifiers, resolved the same way the engine tests resolve them. */
let PRIMARY_SPECIES_ID = Object.keys(SPECIES)[0]!;
let SECONDARY_SPECIES_ID = Object.keys(SPECIES)[1]!;
let DEFAULT_NATURE_ID = Object.keys(NATURES)[0]!;
/** A damaging move so battle turns exercise RNG-sensitive damage rolls. */
let DAMAGING_MOVE_ID = Object.entries(MOVES).find(
	([, move]) => move.power > 0 && String(move.damageClass) !== "status",
)![0];

/** Fixed entity identifiers used across every recording in this module. */
let PLAYER_ID = createPlayerId("hero");
let ENEMY_ID = createPlayerId("rival");
let ALLY_ID = createCreatureId("ally-1");
let ENEMY_CREATURE_ID = createCreatureId("enemy-1");
let BATTLE_ID = createBattleId("battle-1");

/**
 * Turns a numeric seed into a deterministic RNG source (mulberry32).
 *
 * The engine only accepts a `() => number` RNG, so the harness's numeric seed is expanded here into a
 * reproducible stream. This lives in the caller — the harness stays agnostic of how a seed becomes randomness.
 */
function seededRandom(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let value = state;
		value = Math.imul(value ^ (value >>> 15), value | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	};
}

/** Builds one bootstrap creature payload with a damaging move, matching the engine test fixtures. */
function createBootstrapCreature(species: string) {
	return {
		species,
		nature: DEFAULT_NATURE_ID,
		experience: 0,
		moveset: [DAMAGING_MOVE_ID, null, null, null] as [string, null, null, null],
		status: {
			state: null,
			damage: 0,
			pp: [35, 0, 0, 0] as [number, number, number, number],
		},
		iv: {
			hp: 31,
			attack: 31,
			defense: 31,
			"special-attack": 31,
			"special-defense": 31,
			speed: 31,
		},
		ev: {
			hp: 0,
			attack: 0,
			defense: 0,
			"special-attack": 0,
			"special-defense": 0,
			speed: 0,
		},
	};
}

/**
 * Boots a fresh engine seeded with the given seed, from a fixed reproducible starting scenario.
 *
 * The world is assembled exactly like the existing engine tests (authored content plus `migrateWorld` over a
 * hand-written bootstrap world), so the only thing that varies between engines is the seeded RNG. This is the
 * `buildEngine(seed)` factory the harness expects.
 */
function buildEngine(seed: number): Engine {
	return Engine.create({
		content: {
			species: SPECIES,
			moves: MOVES,
			items: ITEMS,
			natures: NATURES,
			typeChart: TYPE_MATCHUPS,
		},
		random: seededRandom(seed),
		world: migrateWorld({
			entities: [PLAYER_ID, ENEMY_ID, ALLY_ID, ENEMY_CREATURE_ID],
			playerId: PLAYER_ID,
			playerProfile: { [PLAYER_ID]: { name: "Hero" }, [ENEMY_ID]: { name: "Rival" } },
			party: {
				[PLAYER_ID]: { creatureIds: [ALLY_ID] },
				[ENEMY_ID]: { creatureIds: [ENEMY_CREATURE_ID] },
			},
			inventory: { [PLAYER_ID]: { items: {} }, [ENEMY_ID]: { items: {} } },
			bestiary: {
				[PLAYER_ID]: { seen: [], caught: [] },
				[ENEMY_ID]: { seen: [], caught: [] },
			},
			storageBoxes: { [PLAYER_ID]: { boxes: [] }, [ENEMY_ID]: { boxes: [] } },
			creature: {
				[ALLY_ID]: createBootstrapCreature(PRIMARY_SPECIES_ID),
				[ENEMY_CREATURE_ID]: createBootstrapCreature(SECONDARY_SPECIES_ID),
			},
		}),
	});
}

/**
 * Builds a fixed, RNG-sensitive command sequence.
 *
 * It spawns a wild encounter (rolling nature and IVs through the seeded RNG) and then runs a single battle
 * turn against it (the damage roll, accuracy, and turn order all flow through the same RNG), so a different
 * seed produces an observably different session.
 *
 * Exactly one turn is submitted on purpose. The engine rejects a `submit-battle-turn` whose command count does
 * not match the currently requested slots, and after a battle ends (or a creature faints) the requested slots
 * change. A single turn — dispatched while the freshly started 1v1 battle requests one command per active side
 * — always matches, keeping the recording a fixed, seed-independent list that is safe to replay to completion.
 * Both requested slots (the player's side 0 and the enemy's side 1) each get a fight command targeting the
 * other side, so the turn's damage rolls flow through the seeded RNG for both combatants.
 */
function buildCommands(): Command[] {
	return [
		{ type: "spawn-encounter", encounterId: "enc-0", speciesId: SECONDARY_SPECIES_ID, level: 5 },
		{
			type: "start-battle",
			battleId: BATTLE_ID,
			playerId: PLAYER_ID,
			enemyId: ENEMY_ID,
			playerParty: [ALLY_ID],
			enemyParty: [createCreatureId("encounter:enc-0")],
			slots: 1,
		},
		{
			type: "submit-battle-turn",
			battleId: BATTLE_ID,
			commands: [
				{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
				{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
			],
		},
	];
}

test("replaying the same recording twice yields identical events and snapshot", () => {
	let recording: Recording = { seed: 0x1234, commands: buildCommands() };

	let [first, second] = assertDeterministicReplay(recording, buildEngine);

	// Redundant explicit assertions so the invariant is visible in the test output, not just inside the helper.
	expect(first.events).toEqual(second.events);
	expect(first.snapshot).toEqual(second.snapshot);
	expect(replaysAreEqual(first, second)).toBe(true);
	// The recording actually exercised the engine (guards against an empty/no-op sequence).
	expect(first.events.length).toBeGreaterThan(0);
});

test("different seeds with the same commands produce different results", () => {
	let commands = buildCommands();
	// This 1v1 fixture is only weakly seed-sensitive, so the two seeds are chosen to
	// actually diverge under the current RNG stream rather than left arbitrary.
	let low: Recording = { seed: 1, commands };
	let high: Recording = { seed: 999, commands };

	let lowResult = replaySession(low, buildEngine);
	let highResult = replaySession(high, buildEngine);

	// Each seed is internally deterministic...
	expect(replaysAreEqual(lowResult, replaySession(low, buildEngine))).toBe(true);
	expect(replaysAreEqual(highResult, replaySession(high, buildEngine))).toBe(true);
	// ...but the two seeds must diverge, proving the RNG is threaded through, not ignored.
	expect(replaysAreEqual(lowResult, highResult)).toBe(false);
});
