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

import type { BattleSideState } from "./battle/battle";

import { Engine, getFlatCreatureIndex } from "./engine";
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

test("change-money adjusts the balance and reports the new total", () => {
	let playerId = createPlayerId("hero");
	let enemyId = createPlayerId("rival");
	let allyId = createCreatureId("ally-1");
	let enemyCreatureId = createCreatureId("enemy-1");
	let engine = createEngine(playerId, enemyId, allyId, enemyCreatureId);

	let reward = engine.dispatch({ type: "change-money", playerId, amount: 500 });
	expect(reward).toEqual([{ type: "money-changed", playerId, amount: 500 }]);
	expect(engine.selectPlayer(playerId).money).toBe(500);

	// A penalty larger than the balance clamps at zero rather than going negative.
	let penalty = engine.dispatch({ type: "change-money", playerId, amount: -900 });
	expect(penalty).toEqual([{ type: "money-changed", playerId, amount: 0 }]);
	expect(engine.selectPlayer(playerId).money).toBe(0);
});

test("buy-item spends money and adds stock, reporting both events", () => {
	let pricedItemId = Object.entries(ITEMS).find(([, item]) => "price" in item && item.price)?.[0];
	expect(pricedItemId).toBeDefined();
	let buyPrice = (ITEMS as Record<string, { price?: { buy: number } }>)[pricedItemId!]!.price!.buy;

	let playerId = createPlayerId("hero");
	let enemyId = createPlayerId("rival");
	let allyId = createCreatureId("ally-1");
	let enemyCreatureId = createCreatureId("enemy-1");
	let engine = createEngine(playerId, enemyId, allyId, enemyCreatureId);

	let before =
		engine.selectPlayer(playerId).inventory.entries.find((entry) => entry.id === pricedItemId!)
			?.count ?? 0;

	engine.dispatch({ type: "change-money", playerId, amount: buyPrice * 2 });
	let events = engine.dispatch({ type: "buy-item", playerId, itemId: pricedItemId!, count: 2 });

	expect(events).toEqual([
		{ type: "inventory-updated", itemId: pricedItemId!, count: before + 2 },
		{ type: "money-changed", playerId, amount: 0 },
	]);
	let player = engine.selectPlayer(playerId);
	expect(player.money).toBe(0);
	expect(player.inventory.entries.find((entry) => entry.id === pricedItemId!)?.count).toBe(
		before + 2,
	);

	// Cannot afford another copy, so nothing changes and no events are emitted.
	expect(engine.dispatch({ type: "buy-item", playerId, itemId: pricedItemId!, count: 1 })).toEqual(
		[],
	);
});

test("sell-item removes stock and credits money, reporting both events", () => {
	let sellableId = Object.entries(ITEMS).find(
		([, item]) => "price" in item && item.price && item.price.sell > 0,
	)?.[0];
	expect(sellableId).toBeDefined();
	let sellPrice = (ITEMS as Record<string, { price?: { sell: number } }>)[sellableId!]!.price!.sell;

	let playerId = createPlayerId("hero");
	let enemyId = createPlayerId("rival");
	let allyId = createCreatureId("ally-1");
	let enemyCreatureId = createCreatureId("enemy-1");
	let engine = createEngine(playerId, enemyId, allyId, enemyCreatureId);

	let before =
		engine.selectPlayer(playerId).inventory.entries.find((entry) => entry.id === sellableId!)
			?.count ?? 0;

	engine.dispatch({ type: "add-inventory-item", playerId, itemId: sellableId!, count: 2 });
	let events = engine.dispatch({ type: "sell-item", playerId, itemId: sellableId!, count: 1 });

	expect(events).toEqual([
		{ type: "inventory-updated", itemId: sellableId!, count: before + 1 },
		{ type: "money-changed", playerId, amount: sellPrice },
	]);
	let player = engine.selectPlayer(playerId);
	expect(player.money).toBe(sellPrice);
	expect(player.inventory.entries.find((entry) => entry.id === sellableId!)?.count).toBe(
		before + 1,
	);
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

test("attempt-capture catches a wild creature and ends the battle", () => {
	let ballId = Object.entries(ITEMS).find(
		([, item]) => "effect" in item && "multiplier" in item.effect,
	)?.[0];
	expect(ballId).toBeDefined();

	let playerId = createPlayerId("hero");
	let enemyId = createPlayerId("rival");
	let allyId = createCreatureId("ally-1");
	let enemyCreatureId = createCreatureId("enemy-1");
	// random() === 0 makes every shake check pass, so the catch is deterministic.
	let engine = createBattleEngine(playerId, enemyId, allyId, enemyCreatureId, () => 0);
	let battleId = createBattleId("b1");

	engine.dispatch({ type: "add-inventory-item", playerId, itemId: ballId!, count: 1 });
	let spawn = engine.dispatch({
		type: "spawn-encounter",
		encounterId: "e1",
		speciesId: SECONDARY_SPECIES_ID,
		level: 5,
	});
	let wild = spawn.find((event) => event.type === "encounter-spawned");
	if (wild?.type !== "encounter-spawned") throw new Error("expected an encounter");

	engine.dispatch({
		type: "start-battle",
		battleId,
		playerId,
		enemyId,
		playerParty: [allyId],
		enemyParty: [wild.creatureId],
		slots: 1,
	});

	let events = engine.dispatch({ type: "attempt-capture", battleId, playerId, itemId: ballId! });

	expect(events.some((event) => event.type === "capture-attempted" && event.success)).toBe(true);
	expect(events.some((event) => event.type === "creature-captured")).toBe(true);
	expect(events.some((event) => event.type === "battle-finished")).toBe(true);
	expect(engine.selectActiveBattle(playerId)).toBeNull();
	let owned = engine
		.selectParty(playerId)
		.creatures.some((creature) => creature.id === wild.creatureId);
	let stored = engine
		.selectStorage(playerId)
		.boxes.some((box) => box.creatures.some((creature) => creature.id === wild.creatureId));
	expect(owned || stored).toBe(true);
});

test("regression: attempt-capture resolves the active enemy by flat party index", () => {
	// The active enemy's world id must be read from `enemyParty` by its FLAT index
	// across teams (creatures of earlier teams + the team-local index), the same
	// mismatch already fixed in syncBattleState. A team-1 slot with team-local index 0
	// must map to the flat index that follows team 0, not to flat index 0.
	let side: BattleSideState = {
		canLeaveBattle: false,
		pendingHealingWishCount: 0,
		followMeUserSlot: null,
		slotTeams: [0, 1],
		teams: [
			{ creatures: [combatantStub(), combatantStub()], eliminated: false },
			{ creatures: [combatantStub()], eliminated: false },
		],
		active: [],
		effects: {} as BattleSideState["effects"],
	};

	// Team 0 holds two creatures (flat 0 and 1); team 1's first creature is flat 2.
	expect(getFlatCreatureIndex(side, 0, 0)).toBe(0);
	expect(getFlatCreatureIndex(side, 0, 1)).toBe(1);
	expect(getFlatCreatureIndex(side, 1, 0)).toBe(2);
	// A single-team side keeps flat index equal to the team-local index.
	expect(getFlatCreatureIndex(side, 0, 0)).toBe(0);
});

test("regression: attempt-capture catches the active single-team enemy at flat index 0", () => {
	// Single-team enemy sides must be unchanged: the sole active enemy sits at flat
	// index 0 and remains catchable exactly as before the flat-index fix.
	let ballId = Object.entries(ITEMS).find(
		([, item]) => "effect" in item && "multiplier" in item.effect,
	)?.[0];
	expect(ballId).toBeDefined();

	let playerId = createPlayerId("hero");
	let enemyId = createPlayerId("rival");
	let allyId = createCreatureId("ally-1");
	let enemyCreatureId = createCreatureId("enemy-1");
	let engine = createBattleEngine(playerId, enemyId, allyId, enemyCreatureId, () => 0);
	let battleId = createBattleId("flat-1");

	engine.dispatch({ type: "add-inventory-item", playerId, itemId: ballId!, count: 1 });
	let spawn = engine.dispatch({
		type: "spawn-encounter",
		encounterId: "e-flat",
		speciesId: SECONDARY_SPECIES_ID,
		level: 5,
	});
	let wild = spawn.find((event) => event.type === "encounter-spawned");
	if (wild?.type !== "encounter-spawned") throw new Error("expected an encounter");

	engine.dispatch({
		type: "start-battle",
		battleId,
		playerId,
		enemyId,
		playerParty: [allyId],
		enemyParty: [wild.creatureId],
		slots: 1,
	});

	let events = engine.dispatch({ type: "attempt-capture", battleId, playerId, itemId: ballId! });
	let captured = events.find((event) => event.type === "creature-captured");
	expect(captured?.type === "creature-captured" ? captured.creatureId : null).toBe(wild.creatureId);
});

test("regression: reading the battle view after a wild battle ends does not crash", () => {
	// Bug: finishing a battle despawned the encounter creature immediately, so the
	// presentation's next selectBattle threw "Missing creature identity". The wild
	// must survive until the next battle's cleanup.
	let playerId = createPlayerId("hero");
	let enemyId = createPlayerId("rival");
	let allyId = createCreatureId("ally-1");
	let seedEnemy = createCreatureId("enemy-1");
	let engine = createBattleEngine(playerId, enemyId, allyId, seedEnemy, () => 0.5);
	let battleId = createBattleId("wild-1");

	let spawn = engine.dispatch({
		type: "spawn-encounter",
		encounterId: "enc-0",
		speciesId: SECONDARY_SPECIES_ID,
		level: 5,
	});
	let wild = spawn.find((event) => event.type === "encounter-spawned");
	if (wild?.type !== "encounter-spawned") throw new Error("expected an encounter");

	engine.dispatch({
		type: "start-battle",
		battleId,
		playerId,
		enemyId,
		playerParty: [allyId],
		enemyParty: [wild.creatureId],
		slots: 1,
	});

	// Forfeit to end the battle deterministically (the enemy still acts).
	let finished = false;
	for (let turn = 0; turn < 200 && !finished; turn += 1) {
		let battle = engine.selectActiveBattle(playerId);
		if (battle?.events.at(-1)?.type !== "request-turn-commands") break;
		let requests = battle.events.at(-1);
		if (requests?.type !== "request-turn-commands") break;
		let events = engine.dispatch({
			type: "submit-battle-turn",
			battleId,
			commands: requests.requests.map((request) =>
				request.side === 0
					? { type: "leave-battle" as const }
					: { type: "fight" as const, move: 0 as const, target: { side: 0, slot: 0 } },
			),
		});
		finished = events.some((event) => event.type === "battle-finished");
	}
	expect(finished).toBe(true);

	// The crash reproduction: this threw before the fix.
	expect(() => engine.selectBattle(battleId)).not.toThrow();
	// The wild is transient: never saved.
	expect(engine.snapshot().entities.includes(wild.creatureId)).toBe(false);
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

/** The first heal-HP medicine id, used to exercise in-battle item use. */
let HEAL_ITEM_ID = Object.entries(ITEMS).find(
	([, item]) => "effect" in item && "kind" in item.effect && item.effect.kind === "heal-hp",
)![0];

test("using a medicine in battle decrements the bag, spends the turn, and heals", () => {
	let playerId = createPlayerId("hero");
	let enemyId = createPlayerId("rival");
	let allyId = createCreatureId("ally-1");
	let enemyCreatureId = createCreatureId("enemy-1");
	// The ally starts hurt so the heal has room to work; the enemy is alive and still
	// acts this turn, proving the item does not skip the opponent's action.
	let engine = createBattleEngine(playerId, enemyId, allyId, enemyCreatureId, () => 0.5, 10);
	let battleId = createBattleId("b1");

	engine.dispatch({ type: "add-inventory-item", playerId, itemId: HEAL_ITEM_ID, count: 2 });
	engine.dispatch({
		type: "start-battle",
		battleId,
		playerId,
		enemyId,
		playerParty: [allyId],
		enemyParty: [enemyCreatureId],
		slots: 1,
	});

	let battle = engine.selectActiveBattle(playerId);
	let request = battle?.events.at(-1);
	if (request?.type !== "request-turn-commands") throw new TypeError("Expected a turn request.");

	let events = engine.dispatch({
		type: "submit-battle-turn",
		battleId,
		commands: request.requests.map((position) =>
			position.side === 0
				? {
						type: "use-item" as const,
						itemId: HEAL_ITEM_ID,
						effect: { kind: "heal-hp", amount: 1 },
						creature: 0,
					}
				: { type: "fight" as const, move: 0 as const, target: { side: 0, slot: 0 } },
		),
	});

	// The bag drops by one and reports the new count.
	let inventoryEvent = events.find((event) => event.type === "inventory-updated");
	expect(inventoryEvent?.type === "inventory-updated" ? inventoryEvent.count : null).toBe(1);
	expect(
		engine.selectInventory(playerId).entries.find((entry) => entry.id === HEAL_ITEM_ID)?.count,
	).toBe(1);

	// The item resolved through the battle log and actually restored HP.
	let appended = events.find((event) => event.type === "battle-events-appended");
	let logged = appended?.type === "battle-events-appended" ? appended.events : [];
	let used = logged.find((event) => event.type === "item-used");
	expect(used?.type === "item-used" ? used.healed : 0).toBeGreaterThan(0);

	// The enemy slot still resolved its own action this turn.
	expect(logged.some((event) => event.type === "move-used" && event.user.side === 1)).toBe(true);
});

test("using a medicine that is not in the bag consumes nothing and heals nothing", () => {
	let playerId = createPlayerId("hero");
	let enemyId = createPlayerId("rival");
	let allyId = createCreatureId("ally-1");
	let enemyCreatureId = createCreatureId("enemy-1");
	let engine = createBattleEngine(playerId, enemyId, allyId, enemyCreatureId, () => 0.5, 10);
	let battleId = createBattleId("b1");

	// Note: no add-inventory-item, so the bag has no heal item at all.
	engine.dispatch({
		type: "start-battle",
		battleId,
		playerId,
		enemyId,
		playerParty: [allyId],
		enemyParty: [enemyCreatureId],
		slots: 1,
	});

	let battle = engine.selectActiveBattle(playerId);
	let request = battle?.events.at(-1);
	if (request?.type !== "request-turn-commands") throw new TypeError("Expected a turn request.");

	let events = engine.dispatch({
		type: "submit-battle-turn",
		battleId,
		commands: request.requests.map((position) =>
			position.side === 0
				? {
						type: "use-item" as const,
						itemId: HEAL_ITEM_ID,
						effect: { kind: "heal-hp", amount: 1 },
						creature: 0,
					}
				: { type: "fight" as const, move: 0 as const, target: { side: 0, slot: 0 } },
		),
	});

	// No inventory change and no item-used event: the absent item cannot be used.
	expect(events.some((event) => event.type === "inventory-updated")).toBe(false);
	expect(
		engine.selectInventory(playerId).entries.find((entry) => entry.id === HEAL_ITEM_ID)?.count,
	).toBeUndefined();
	let appended = events.find((event) => event.type === "battle-events-appended");
	let logged = appended?.type === "battle-events-appended" ? appended.events : [];
	expect(logged.some((event) => event.type === "item-used")).toBe(false);
});

/** A throwaway combatant placeholder; getFlatCreatureIndex only counts array length. */
function combatantStub(): BattleSideState["teams"][number]["creatures"][number] {
	return {} as BattleSideState["teams"][number]["creatures"][number];
}

/** Bulbasaur's medium-fast level-12 experience threshold and the move it then learns. */
let BULBASAUR_LEVEL_12_EXP = 12 ** 3;
let RAZOR_LEAF = "RAZOR_LEAF";

/**
 * Creates an engine whose Bulbasaur ally is one experience short of level 12 and
 * whose enemy starts fainted, so a single `start-battle` wins immediately and the
 * awarded experience crosses the level-12 boundary (learning RAZOR_LEAF). The
 * ally's moveset is supplied so tests can exercise both the auto-learn (free slot)
 * and full-moveset (prompt) paths.
 */
function createLevelUpEngine(
	playerId: string,
	enemyId: string,
	allyId: string,
	enemyCreatureId: string,
	allyMoveset: [string, string | null, string | null, string | null],
) {
	return Engine.create({
		content: {
			species: SPECIES,
			moves: MOVES,
			items: ITEMS,
			natures: NATURES,
			typeChart: TYPE_MATCHUPS,
		},
		random: () => 0.5,
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
				[allyId]: {
					species: PRIMARY_SPECIES_ID, // Bulbasaur
					nature: DEFAULT_NATURE_ID,
					experience: BULBASAUR_LEVEL_12_EXP - 1, // level 11, one point below level 12
					moveset: allyMoveset,
					status: {
						state: null,
						damage: 0,
						pp: [35, 20, 20, 20] as [number, number, number, number],
					},
					iv: {
						hp: 31,
						attack: 31,
						defense: 31,
						"special-attack": 31,
						"special-defense": 31,
						speed: 31,
					},
					ev: { hp: 0, attack: 0, defense: 0, "special-attack": 0, "special-defense": 0, speed: 0 },
				},
				[enemyCreatureId]: {
					species: SECONDARY_SPECIES_ID,
					nature: DEFAULT_NATURE_ID,
					experience: 0,
					moveset: [DAMAGING_MOVE_ID, null, null, null] as [string, null, null, null],
					// Pre-fainted so the player wins the moment the battle starts.
					status: {
						state: null,
						damage: 9999,
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
					ev: { hp: 0, attack: 0, defense: 0, "special-attack": 0, "special-defense": 0, speed: 0 },
				},
			},
		}),
	});
}

test("a level-up auto-learns a move when the moveset has a free slot", () => {
	let playerId = createPlayerId("hero");
	let enemyId = createPlayerId("rival");
	let allyId = createCreatureId("ally-1");
	let enemyCreatureId = createCreatureId("enemy-1");
	let engine = createLevelUpEngine(playerId, enemyId, allyId, enemyCreatureId, [
		"TACKLE",
		"GROWL",
		null,
		null,
	]);

	let events = engine.dispatch({
		type: "start-battle",
		battleId: createBattleId("b1"),
		playerId,
		enemyId,
		playerParty: [allyId],
		enemyParty: [enemyCreatureId],
		slots: 1,
	});

	let learned = events.find((event) => event.type === "learned-move");
	expect(learned?.type === "learned-move" ? learned.moveId : null).toBe(RAZOR_LEAF);
	// The move landed in the first free slot and the moveset now holds it.
	expect(learned?.type === "learned-move" ? learned.slotIndex : null).toBe(2);
	let summary = engine.selectCreatureSummary(allyId);
	expect(summary.moves.map((slot) => slot.id)).toEqual(["TACKLE", "GROWL", RAZOR_LEAF, null]);
	// No prompt event is emitted when the move auto-learns.
	expect(events.some((event) => event.type === "can-learn-move")).toBe(false);
});

test("a level-up on a full moveset emits can-learn-move without changing the moveset", () => {
	let playerId = createPlayerId("hero");
	let enemyId = createPlayerId("rival");
	let allyId = createCreatureId("ally-1");
	let enemyCreatureId = createCreatureId("enemy-1");
	let fullMoveset: [string, string, string, string] = ["TACKLE", "GROWL", "VINE_WHIP", "GROWTH"];
	let engine = createLevelUpEngine(playerId, enemyId, allyId, enemyCreatureId, fullMoveset);

	let events = engine.dispatch({
		type: "start-battle",
		battleId: createBattleId("b1"),
		playerId,
		enemyId,
		playerParty: [allyId],
		enemyParty: [enemyCreatureId],
		slots: 1,
	});

	let offer = events.find((event) => event.type === "can-learn-move");
	expect(offer?.type).toBe("can-learn-move");
	if (offer?.type === "can-learn-move") {
		expect(offer.moveId).toBe(RAZOR_LEAF);
		expect(offer.currentMoveset).toEqual(fullMoveset);
	}
	// The moveset is untouched until the player resolves the prompt.
	expect(engine.selectCreatureSummary(allyId).moves.map((slot) => slot.id)).toEqual(fullMoveset);
	expect(events.some((event) => event.type === "learned-move")).toBe(false);
});

test("learn-move replace overwrites the chosen slot and reports the replaced move", () => {
	let playerId = createPlayerId("hero");
	let enemyId = createPlayerId("rival");
	let allyId = createCreatureId("ally-1");
	let enemyCreatureId = createCreatureId("enemy-1");
	let engine = createLevelUpEngine(playerId, enemyId, allyId, enemyCreatureId, [
		"TACKLE",
		"GROWL",
		"VINE_WHIP",
		"GROWTH",
	]);
	engine.dispatch({
		type: "start-battle",
		battleId: createBattleId("b1"),
		playerId,
		enemyId,
		playerParty: [allyId],
		enemyParty: [enemyCreatureId],
		slots: 1,
	});

	let events = engine.dispatch({
		type: "learn-move",
		creatureId: allyId,
		moveId: RAZOR_LEAF,
		replaceSlotIndex: 1,
	});

	let learned = events.find((event) => event.type === "learned-move");
	expect(learned?.type === "learned-move" ? learned.slotIndex : null).toBe(1);
	expect(learned?.type === "learned-move" ? learned.replacedMoveId : null).toBe("GROWL");
	expect(engine.selectCreatureSummary(allyId).moves.map((slot) => slot.id)).toEqual([
		"TACKLE",
		RAZOR_LEAF,
		"VINE_WHIP",
		"GROWTH",
	]);
});

test("learn-move decline keeps the moveset and reports the declined move", () => {
	let playerId = createPlayerId("hero");
	let enemyId = createPlayerId("rival");
	let allyId = createCreatureId("ally-1");
	let enemyCreatureId = createCreatureId("enemy-1");
	let fullMoveset: [string, string, string, string] = ["TACKLE", "GROWL", "VINE_WHIP", "GROWTH"];
	let engine = createLevelUpEngine(playerId, enemyId, allyId, enemyCreatureId, fullMoveset);
	engine.dispatch({
		type: "start-battle",
		battleId: createBattleId("b1"),
		playerId,
		enemyId,
		playerParty: [allyId],
		enemyParty: [enemyCreatureId],
		slots: 1,
	});

	// A negative slot means "declined": nothing changes and a decline event is emitted.
	let events = engine.dispatch({
		type: "learn-move",
		creatureId: allyId,
		moveId: RAZOR_LEAF,
		replaceSlotIndex: -1,
	});

	expect(events).toEqual([{ type: "move-learn-declined", creatureId: allyId, moveId: RAZOR_LEAF }]);
	expect(engine.selectCreatureSummary(allyId).moves.map((slot) => slot.id)).toEqual(fullMoveset);
});

/** A species/target/stone triple pulled from the real Gen-1 stone evolutions. */
let STONE_SPECIES_ID = "PIKACHU";
let STONE_EVOLVED_ID = "RAICHU";
let STONE_ITEM_ID = "THUNDERSTONE";
/** A different stone that must NOT evolve the stone species. */
let WRONG_STONE_ITEM_ID = "WATERSTONE";

/** Creates an engine whose single party creature is the stone-evolution species. */
function createStoneEngine(playerId: string, creatureId: string) {
	return Engine.create({
		content: {
			species: SPECIES,
			moves: MOVES,
			items: ITEMS,
			natures: NATURES,
			typeChart: TYPE_MATCHUPS,
		},
		random: () => 0.5,
		world: migrateWorld({
			entities: [playerId, creatureId],
			playerId,
			playerProfile: { [playerId]: { name: "Hero" } },
			party: { [playerId]: { creatureIds: [creatureId] } },
			inventory: { [playerId]: { items: { [STONE_ITEM_ID]: 1, [WRONG_STONE_ITEM_ID]: 1 } } },
			bestiary: { [playerId]: { seen: [], caught: [] } },
			storageBoxes: { [playerId]: { boxes: [] } },
			creature: { [creatureId]: createBootstrapCreature(STONE_SPECIES_ID) },
		}),
	});
}

test("using the matching evolution stone evolves the creature and consumes the stone", () => {
	let playerId = createPlayerId("hero");
	let creatureId = createCreatureId("buddy-1");
	let engine = createStoneEngine(playerId, creatureId);

	let events = engine.dispatch({
		type: "use-item-on-creature",
		playerId,
		creatureId,
		itemId: STONE_ITEM_ID,
	});

	// The creature evolved and the stone was consumed from the bag.
	expect(events).toEqual([
		{ type: "inventory-updated", itemId: STONE_ITEM_ID, count: 0 },
		{ type: "creature-evolved", creatureId, speciesId: STONE_EVOLVED_ID },
	]);
	expect(engine.selectCreatureSummary(creatureId).speciesId).toBe(STONE_EVOLVED_ID);
	expect(
		engine.selectInventory(playerId).entries.find((entry) => entry.id === STONE_ITEM_ID),
	).toBeUndefined();
});

test("using a non-matching stone does nothing and keeps the stone", () => {
	let playerId = createPlayerId("hero");
	let creatureId = createCreatureId("buddy-1");
	let engine = createStoneEngine(playerId, creatureId);

	let events = engine.dispatch({
		type: "use-item-on-creature",
		playerId,
		creatureId,
		itemId: WRONG_STONE_ITEM_ID,
	});

	// No match: no events, no species change, and the stone stays in the bag.
	expect(events).toEqual([]);
	expect(engine.selectCreatureSummary(creatureId).speciesId).toBe(STONE_SPECIES_ID);
	expect(
		engine.selectInventory(playerId).entries.find((entry) => entry.id === WRONG_STONE_ITEM_ID)
			?.count,
	).toBe(1);
});

test("the matching stone evolution is a no-op when the stone is not in the bag", () => {
	let playerId = createPlayerId("hero");
	let creatureId = createCreatureId("buddy-1");
	let engine = createStoneEngine(playerId, creatureId);
	// Spend the only stone first so the second use finds an empty stack.
	engine.dispatch({ type: "remove-inventory-item", playerId, itemId: STONE_ITEM_ID, count: 1 });

	let events = engine.dispatch({
		type: "use-item-on-creature",
		playerId,
		creatureId,
		itemId: STONE_ITEM_ID,
	});

	expect(events).toEqual([]);
	expect(engine.selectCreatureSummary(creatureId).speciesId).toBe(STONE_SPECIES_ID);
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
