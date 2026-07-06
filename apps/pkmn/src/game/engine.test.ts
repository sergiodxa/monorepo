/**
 * Verifies the `Engine` integration points exercised by this test module, focusing on command dispatch, migrated world bootstrap data, and selector results exposed to higher-level consumers.
 *
 * Keeps the test coverage centered on file-local fixtures and assertions so this module documents the expected behavior contract for battle startup, inventory updates, and bestiary reads without depending on presentation details.
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

import { Engine } from "./engine";
import { createBattleId, createCreatureId, createPlayerId } from "./world/ids";
import { migrateWorld } from "./world/migrate";

let PRIMARY_SPECIES_ID = Object.keys(SPECIES)[0]!;
let SECONDARY_SPECIES_ID = Object.keys(SPECIES)[1]!;
let DEFAULT_NATURE_ID = Object.keys(NATURES)[0]!;
let DEFAULT_ITEM_ID = Object.keys(ITEMS)[0]!;
let DEFAULT_MOVE_ID = Object.keys(MOVES)[0]!;

test("Engine dispatches battle startup through the ECS mirrors", () => {
	let playerId = createPlayerId("hero");
	let enemyId = createPlayerId("rival");
	let allyId = createCreatureId("ally-1");
	let enemyCreatureId = createCreatureId("enemy-1");
	let engine = createEngine(playerId, enemyId, allyId, enemyCreatureId);

	let events = engine.dispatch({
		type: "start-battle",
		battleId: createBattleId("battle-1"),
		playerId,
		enemyId,
		playerParty: [allyId],
		enemyParty: [enemyCreatureId],
		slots: 1,
	});
	let battle = engine.selectActiveBattle(playerId);

	expect(events.some((event) => event.type === "battle-input-requested")).toBe(true);
	expect(battle?.phase).toBe("awaiting-turn-input");
	expect(battle?.events.some((event) => event.type === "battle-started")).toBe(true);
	expect(battle?.allies[0]?.name).toBe(PRIMARY_SPECIES_ID);
	expect(battle?.enemies[0]?.name).toBe(SECONDARY_SPECIES_ID);
});

test("Engine selectors stay UI-oriented after inventory and bestiary commands", () => {
	let playerId = createPlayerId("hero");
	let enemyId = createPlayerId("rival");
	let allyId = createCreatureId("ally-1");
	let enemyCreatureId = createCreatureId("enemy-1");
	let engine = createEngine(playerId, enemyId, allyId, enemyCreatureId);

	engine.dispatch({ type: "add-inventory-item", playerId, itemId: DEFAULT_ITEM_ID, count: 2 });
	engine.dispatch({ type: "mark-species-seen", playerId, speciesId: PRIMARY_SPECIES_ID });

	let player = engine.selectPlayer(playerId);
	expect(player.inventory.entries.find((entry) => entry.id === DEFAULT_ITEM_ID)?.count).toBe(3);
	expect(player.bestiary.entries).toEqual([
		{ speciesId: PRIMARY_SPECIES_ID, name: PRIMARY_SPECIES_ID, seen: true, caught: false },
	]);
	expect(player.party.creatures[0]?.location).toBe("party:1");
});

/** Creates one engine instance with a small migrated bootstrap world. */
function createEngine(playerId: string, enemyId: string, allyId: string, enemyCreatureId: string) {
	return Engine.create({
		content: {
			species: SPECIES,
			moves: MOVES,
			items: ITEMS,
			natures: NATURES,
			typeChart: TYPE_MATCHUPS,
		},
		world: migrateWorld({
			entities: [playerId, enemyId, allyId, enemyCreatureId],
			playerId,
			playerProfile: {
				[playerId]: { name: "Hero" },
				[enemyId]: { name: "Rival" },
			},
			party: {
				[playerId]: { creatureIds: [allyId] },
				[enemyId]: { creatureIds: [enemyCreatureId] },
			},
			inventory: {
				[playerId]: { items: { [DEFAULT_ITEM_ID]: 1 } },
				[enemyId]: { items: {} },
			},
			bestiary: {
				[playerId]: { seen: [], caught: [] },
				[enemyId]: { seen: [], caught: [] },
			},
			storageBoxes: {
				[playerId]: { boxes: [] },
				[enemyId]: { boxes: [] },
			},
			creature: {
				[allyId]: createBootstrapCreature(PRIMARY_SPECIES_ID),
				[enemyCreatureId]: createBootstrapCreature(SECONDARY_SPECIES_ID),
			},
		}),
	});
}

/** Creates one bootstrap creature payload for tests. */
function createBootstrapCreature(species: string) {
	return {
		species,
		nature: DEFAULT_NATURE_ID,
		experience: 0,
		moveset: [DEFAULT_MOVE_ID, null, null, null] as [string, null, null, null],
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

/** A damaging move used to force battles to a deterministic conclusion. */
let DAMAGING_MOVE_ID = Object.entries(MOVES).find(
	([, move]) => move.power > 0 && String(move.damageClass) !== "status",
)![0];

test("Engine writes battle results back and keeps the battle out of snapshots", () => {
	let playerId = createPlayerId("hero");
	let enemyId = createPlayerId("rival");
	let allyId = createCreatureId("ally-1");
	let enemyCreatureId = createCreatureId("enemy-1");
	let engine = createBattleEngine(playerId, enemyId, allyId, enemyCreatureId, () => 0.5);

	engine.dispatch({
		type: "start-battle",
		battleId: createBattleId("b1"),
		playerId,
		enemyId,
		playerParty: [allyId],
		enemyParty: [enemyCreatureId],
		slots: 1,
	});

	let finished = false;
	for (let turn = 0; turn < 200 && !finished; turn += 1) {
		let battle = engine.selectActiveBattle(playerId);
		if (!battle) break;
		let last = battle.events.at(-1);
		if (last?.type === "request-turn-commands") {
			let events = engine.dispatch({
				type: "submit-battle-turn",
				battleId: battle.id,
				commands: last.requests.map((request) => ({
					type: "fight" as const,
					move: 0 as const,
					target: { side: request.side === 0 ? 1 : 0, slot: 0 },
				})),
			});
			finished = events.some((event) => event.type === "battle-finished");
		} else break; // single-creature teams never request replacements
	}

	expect(finished).toBe(true);
	expect(engine.selectActiveBattle(playerId)).toBeNull();
	expect(engine.snapshot().entities.some((id) => id.startsWith("battle"))).toBe(false);
});

test("winning a battle awards experience to the party", () => {
	let playerId = createPlayerId("hero");
	let enemyId = createPlayerId("rival");
	let allyId = createCreatureId("ally-1");
	let enemyCreatureId = createCreatureId("enemy-1");
	// Start the enemy already fainted so the player wins immediately and deterministically.
	let engine = createBattleEngine(playerId, enemyId, allyId, enemyCreatureId, () => 0.5, 0, 9999);

	let events = engine.dispatch({
		type: "start-battle",
		battleId: createBattleId("b1"),
		playerId,
		enemyId,
		playerParty: [allyId],
		enemyParty: [enemyCreatureId],
		slots: 1,
	});

	expect(events.some((event) => event.type === "battle-finished")).toBe(true);
	let granted = events.find((event) => event.type === "creature-experience-granted");
	expect(granted?.type).toBe("creature-experience-granted");
	if (granted?.type === "creature-experience-granted") {
		expect(granted.creatureId).toBe(allyId);
		expect(granted.totalExperience).toBeGreaterThan(0);
	}
});

test("heal-party fully restores a damaged party", () => {
	let playerId = createPlayerId("hero");
	let enemyId = createPlayerId("rival");
	let allyId = createCreatureId("ally-1");
	let enemyCreatureId = createCreatureId("enemy-1");
	let engine = createBattleEngine(playerId, enemyId, allyId, enemyCreatureId, () => 0.5, 5);

	let before = engine.selectCreatureSummary(allyId);
	expect(before.currentHP).toBe(before.maxHP - 5);

	let events = engine.dispatch({ type: "heal-party", playerId });
	expect(events).toEqual([{ type: "party-healed", playerId, count: 1 }]);

	let after = engine.selectCreatureSummary(allyId);
	expect(after.currentHP).toBe(after.maxHP);
});

/** Creates an engine wired for deterministic battles with a chosen RNG and optional starting damage. */
function createBattleEngine(
	playerId: string,
	enemyId: string,
	allyId: string,
	enemyCreatureId: string,
	random: () => number,
	allyDamage = 0,
	enemyDamage = 0,
) {
	let creature = (species: string, damage: number) => ({
		species,
		nature: DEFAULT_NATURE_ID,
		experience: 0,
		moveset: [DAMAGING_MOVE_ID, null, null, null] as [string, null, null, null],
		status: {
			state: null,
			damage,
			pp: [35, 0, 0, 0] as [number, number, number, number],
		},
		iv: { hp: 31, attack: 31, defense: 31, "special-attack": 31, "special-defense": 31, speed: 31 },
		ev: { hp: 0, attack: 0, defense: 0, "special-attack": 0, "special-defense": 0, speed: 0 },
	});

	return Engine.create({
		content: {
			species: SPECIES,
			moves: MOVES,
			items: ITEMS,
			natures: NATURES,
			typeChart: TYPE_MATCHUPS,
		},
		random,
		world: migrateWorld({
			entities: [playerId, enemyId, allyId, enemyCreatureId],
			playerId,
			playerProfile: { [playerId]: { name: "Hero" }, [enemyId]: { name: "Rival" } },
			party: {
				[playerId]: { creatureIds: [allyId] },
				[enemyId]: { creatureIds: [enemyCreatureId] },
			},
			inventory: { [playerId]: { items: {} }, [enemyId]: { items: {} } },
			bestiary: { [playerId]: { seen: [], caught: [] }, [enemyId]: { seen: [], caught: [] } },
			storageBoxes: { [playerId]: { boxes: [] }, [enemyId]: { boxes: [] } },
			creature: {
				[allyId]: creature(PRIMARY_SPECIES_ID, allyDamage),
				[enemyCreatureId]: creature(SECONDARY_SPECIES_ID, enemyDamage),
			},
		}),
	});
}
