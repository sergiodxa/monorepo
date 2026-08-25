/**
 * Exercises the `Engine`'s command dispatch, migrated bootstrap world, and
 * selectors through file-local fixtures, documenting the behavior contract
 * for battle startup, inventory updates, and bestiary reads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "vitest";

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

test("set-flag persists a flag the selector then reads", () => {
	let playerId = createPlayerId("hero");
	let enemyId = createPlayerId("rival");
	let allyId = createCreatureId("ally-1");
	let enemyCreatureId = createCreatureId("enemy-1");
	let engine = createEngine(playerId, enemyId, allyId, enemyCreatureId);

	expect(engine.selectFlag("met-professor")).toBe(false);

	let events = engine.dispatch({ type: "set-flag", flag: "met-professor" });
	expect(events).toEqual([{ type: "flag-set", flag: "met-professor", value: true }]);
	expect(engine.selectFlag("met-professor")).toBe(true);

	engine.dispatch({ type: "set-flag", flag: "met-professor", value: false });
	expect(engine.selectFlag("met-professor")).toBe(false);
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
		} else break;
	}

	expect(finished).toBe(true);
	expect(engine.selectActiveBattle(playerId)).toBeNull();
	expect(engine.snapshot().entities.some((id) => id.startsWith("battle"))).toBe(false);
});

/**
 * Battle start records the enemy species as seen immediately, before any
 * capture attempt or the first turn, covering wild encounters, trainer
 * parties, and battles the player flees.
 */
test("starting a battle marks every enemy species as seen (wild or trainer)", () => {
	let playerId = createPlayerId("hero");
	let enemyId = createPlayerId("rival");
	let allyId = createCreatureId("ally-1");
	let enemyCreatureId = createCreatureId("enemy-1");
	let engine = createBattleEngine(playerId, enemyId, allyId, enemyCreatureId, () => 0.5);

	expect(engine.selectPlayer(playerId).bestiary.entries).toEqual([]);

	let events = engine.dispatch({
		type: "start-battle",
		battleId: createBattleId("b1"),
		playerId,
		enemyId,
		playerParty: [allyId],
		enemyParty: [enemyCreatureId],
		slots: 1,
	});

	expect(events).toContainEqual({
		type: "bestiary-updated",
		speciesId: SECONDARY_SPECIES_ID,
		status: "seen",
	});
	expect(engine.selectPlayer(playerId).bestiary.entries).toEqual([
		{ speciesId: SECONDARY_SPECIES_ID, name: SECONDARY_SPECIES_ID, seen: true, caught: false },
	]);
});

/**
 * The enemy starts fainted so the player wins on the first dispatch,
 * keeping the awarded experience deterministic.
 */
test("winning a battle awards experience to the party", () => {
	let playerId = createPlayerId("hero");
	let enemyId = createPlayerId("rival");
	let allyId = createCreatureId("ally-1");
	let enemyCreatureId = createCreatureId("enemy-1");
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

/**
 * A zero-returning random source passes every capture shake check, making
 * the catch outcome deterministic.
 */
test("attempt-capture catches a wild creature and ends the battle", () => {
	let ballId = Object.entries(ITEMS).find(
		([, item]) => "effect" in item && "multiplier" in item.effect,
	)?.[0];
	expect(ballId).toBeDefined();

	let playerId = createPlayerId("hero");
	let enemyId = createPlayerId("rival");
	let allyId = createCreatureId("ally-1");
	let enemyCreatureId = createCreatureId("enemy-1");
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

/**
 * getFlatCreatureIndex must resolve a team-local slot to its flat index
 * across every earlier team's creature count, matching the fix already
 * applied in syncBattleState for the active enemy's world id lookup.
 */
test("regression: attempt-capture resolves the active enemy by flat party index", () => {
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

	expect(getFlatCreatureIndex(side, 0, 0)).toBe(0);
	expect(getFlatCreatureIndex(side, 0, 1)).toBe(1);
	expect(getFlatCreatureIndex(side, 1, 0)).toBe(2);
	expect(getFlatCreatureIndex(side, 0, 0)).toBe(0);
});

/**
 * A single-team enemy side keeps its sole active enemy at flat index 0,
 * so the flat-index fix leaves this catch path working as before.
 */
test("regression: attempt-capture catches the active single-team enemy at flat index 0", () => {
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

/**
 * Finishing a battle used to despawn the encounter creature immediately, so
 * the next selectBattle threw "Missing creature identity". The wild
 * creature now survives until the next battle's cleanup.
 */
test("regression: reading the battle view after a wild battle ends does not crash", () => {
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

	expect(() => engine.selectBattle(battleId)).not.toThrow();
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

/**
 * The ally starts hurt so the heal has visible effect, and the enemy stays
 * alive to confirm using an item still lets the opponent act that turn.
 */
test("using a medicine in battle decrements the bag, spends the turn, and heals", () => {
	let playerId = createPlayerId("hero");
	let enemyId = createPlayerId("rival");
	let allyId = createCreatureId("ally-1");
	let enemyCreatureId = createCreatureId("enemy-1");
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

	let inventoryEvent = events.find((event) => event.type === "inventory-updated");
	expect(inventoryEvent?.type === "inventory-updated" ? inventoryEvent.count : null).toBe(1);
	expect(
		engine.selectInventory(playerId).entries.find((entry) => entry.id === OW_HEAL_ITEM_ID)?.count,
	).toBe(1);

	let appended = events.find((event) => event.type === "battle-events-appended");
	let logged = appended?.type === "battle-events-appended" ? appended.events : [];
	let used = logged.find((event) => event.type === "item-used");
	expect(used?.type === "item-used" ? used.healed : 0).toBeGreaterThan(0);

	expect(logged.some((event) => event.type === "move-used" && event.user.side === 1)).toBe(true);
});

test("using a medicine that is not in the bag consumes nothing and heals nothing", () => {
	let playerId = createPlayerId("hero");
	let enemyId = createPlayerId("rival");
	let allyId = createCreatureId("ally-1");
	let enemyCreatureId = createCreatureId("enemy-1");
	let engine = createBattleEngine(playerId, enemyId, allyId, enemyCreatureId, () => 0.5, 10);
	let battleId = createBattleId("b1");

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

	expect(events.some((event) => event.type === "inventory-updated")).toBe(false);
	expect(
		engine.selectInventory(playerId).entries.find((entry) => entry.id === OW_HEAL_ITEM_ID)?.count,
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
 * Creates an engine whose Bulbasaur ally is one experience point short of
 * level 12, with a fainted enemy so a single `start-battle` immediately
 * crosses the boundary and offers RAZOR_LEAF.
 * @param allyMoveset - Exercises the auto-learn or full-moveset prompt path
 * depending on whether it has a free slot.
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
					species: PRIMARY_SPECIES_ID,
					nature: DEFAULT_NATURE_ID,
					experience: BULBASAUR_LEVEL_12_EXP - 1,
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
	expect(learned?.type === "learned-move" ? learned.slotIndex : null).toBe(2);
	let summary = engine.selectCreatureSummary(allyId);
	expect(summary.moves.map((slot) => slot.id)).toEqual(["TACKLE", "GROWL", RAZOR_LEAF, null]);
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

/**
 * A replaceSlotIndex of -1 signals a decline, leaving the moveset
 * untouched while still emitting a decline event.
 */
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
/**
 * A stone belonging to a different evolution, confirming that mismatched
 * stones leave the species unchanged.
 */
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

/** Overworld medicine ids pulled from the real content, one per recovery kind exercised. */
let OW_HEAL_ITEM_ID = "POTION";
let OW_REVIVE_ITEM_ID = "REVIVE";
let OW_CURE_ITEM_ID = "ANTIDOTE";

/**
 * Creates an engine with one party creature carrying the given damage and status.
 *
 * The bag starts with one of each medicine kind so a single fixture drives the heal,
 * revive, and cure paths.
 */
function createMedicineEngine(
	playerId: string,
	creatureId: string,
	damage: number,
	state: string | null,
) {
	let creature = createBootstrapCreature(STONE_SPECIES_ID);
	creature.status = { ...creature.status, damage, state } as typeof creature.status;
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
			inventory: {
				[playerId]: {
					items: { [OW_HEAL_ITEM_ID]: 1, [OW_REVIVE_ITEM_ID]: 1, [OW_CURE_ITEM_ID]: 1 },
				},
			},
			bestiary: { [playerId]: { seen: [], caught: [] } },
			storageBoxes: { [playerId]: { boxes: [] } },
			creature: { [creatureId]: creature },
		}),
	});
}

/**
 * POTION restores 20 HP, more than enough to cover the fixture's 5 missing
 * HP, so healing tops the creature off at its max.
 */
test("use-medicine heals a damaged party creature and decrements the bag", () => {
	let playerId = createPlayerId("hero");
	let creatureId = createCreatureId("buddy-1");
	let engine = createMedicineEngine(playerId, creatureId, 5, null);
	let before = engine.selectCreatureSummary(creatureId).currentHP;

	let events = engine.dispatch({
		type: "use-medicine",
		playerId,
		creatureId,
		itemId: OW_HEAL_ITEM_ID,
	});

	expect(events).toEqual([{ type: "inventory-updated", itemId: OW_HEAL_ITEM_ID, count: 0 }]);
	let after = engine.selectCreatureSummary(creatureId);
	expect(after.currentHP).toBe(after.maxHP);
	expect(after.currentHP).toBeGreaterThan(before);
	expect(
		engine.selectInventory(playerId).entries.find((entry) => entry.id === OW_HEAL_ITEM_ID),
	).toBeUndefined();
});

test("use-medicine on a full-HP creature is a no-op that keeps the item", () => {
	let playerId = createPlayerId("hero");
	let creatureId = createCreatureId("buddy-1");
	let engine = createMedicineEngine(playerId, creatureId, 0, null);

	let events = engine.dispatch({
		type: "use-medicine",
		playerId,
		creatureId,
		itemId: OW_HEAL_ITEM_ID,
	});

	expect(events).toEqual([]);
	let entry = engine.selectInventory(playerId).entries.find((row) => row.id === OW_HEAL_ITEM_ID);
	expect(entry?.count).toBe(1);
});

test("use-medicine revive works on a fainted creature", () => {
	let playerId = createPlayerId("hero");
	let creatureId = createCreatureId("buddy-1");
	let maxHP = createMedicineEngine(playerId, creatureId, 0, null).selectCreatureSummary(
		creatureId,
	).maxHP;
	let engine = createMedicineEngine(playerId, creatureId, maxHP, null);
	expect(engine.selectCreatureSummary(creatureId).currentHP).toBe(0);

	let events = engine.dispatch({
		type: "use-medicine",
		playerId,
		creatureId,
		itemId: OW_REVIVE_ITEM_ID,
	});

	expect(events).toEqual([{ type: "inventory-updated", itemId: OW_REVIVE_ITEM_ID, count: 0 }]);
	expect(engine.selectCreatureSummary(creatureId).currentHP).toBeGreaterThan(0);
});

test("use-medicine revive on a healthy creature is a no-op that keeps the item", () => {
	let playerId = createPlayerId("hero");
	let creatureId = createCreatureId("buddy-1");
	let engine = createMedicineEngine(playerId, creatureId, 0, null);

	let events = engine.dispatch({
		type: "use-medicine",
		playerId,
		creatureId,
		itemId: OW_REVIVE_ITEM_ID,
	});

	expect(events).toEqual([]);
	expect(
		engine.selectInventory(playerId).entries.find((row) => row.id === OW_REVIVE_ITEM_ID)?.count,
	).toBe(1);
});

/**
 * ANTIDOTE's cure effect targets the "poison" status string used by the
 * content data.
 */
test("use-medicine cures a matching status and consumes the cure", () => {
	let playerId = createPlayerId("hero");
	let creatureId = createCreatureId("buddy-1");
	let engine = createMedicineEngine(playerId, creatureId, 0, "poison");
	expect(engine.selectCreatureSummary(creatureId).status).toBe("poison");

	let events = engine.dispatch({
		type: "use-medicine",
		playerId,
		creatureId,
		itemId: OW_CURE_ITEM_ID,
	});

	expect(events).toEqual([{ type: "inventory-updated", itemId: OW_CURE_ITEM_ID, count: 0 }]);
	expect(engine.selectCreatureSummary(creatureId).status).toBeNull();
});

test("spawn-trainer-creature builds a non-persisted trainer creature that cannot be captured", () => {
	let ballId = Object.entries(ITEMS).find(
		([, item]) => "effect" in item && "multiplier" in item.effect,
	)?.[0];
	expect(ballId).toBeDefined();

	let playerId = createPlayerId("hero");
	let enemyId = createPlayerId("rival");
	let allyId = createCreatureId("ally-1");
	let seedEnemy = createCreatureId("enemy-1");
	let engine = createBattleEngine(playerId, enemyId, allyId, seedEnemy, () => 0);
	let battleId = createBattleId("tb-capture");

	engine.dispatch({ type: "add-inventory-item", playerId, itemId: ballId!, count: 1 });
	let spawn = engine.dispatch({
		type: "spawn-trainer-creature",
		trainerId: "rival-0",
		speciesId: SECONDARY_SPECIES_ID,
		level: 5,
	});
	let creature = spawn.find((event) => event.type === "trainer-creature-spawned");
	if (creature?.type !== "trainer-creature-spawned") throw new Error("expected a trainer creature");
	expect(engine.selectCreatureSummary(creature.creatureId).location).toBe("trainer:rival-0");
	expect(engine.snapshot().entities.includes(creature.creatureId)).toBe(false);

	engine.dispatch({
		type: "start-battle",
		battleId,
		playerId,
		enemyId,
		playerParty: [allyId],
		enemyParty: [creature.creatureId],
		slots: 1,
		canLeaveBattle: false,
	});

	let events = engine.dispatch({ type: "attempt-capture", battleId, playerId, itemId: ballId! });
	expect(events).toEqual([]);
	expect(events.some((event) => event.type === "creature-captured")).toBe(false);
	expect(engine.selectActiveBattle(playerId)).not.toBeNull();
});

/**
 * Guards the same read-after-finish path as the wild-battle regression, and
 * confirms a fresh battle fully reclaims the previous trainer creature so no
 * leftover world entity remains.
 */
test("trainer creatures are despawned after their battle and stay out of snapshots", () => {
	let playerId = createPlayerId("hero");
	let enemyId = createPlayerId("rival");
	let allyId = createCreatureId("ally-1");
	let seedEnemy = createCreatureId("enemy-1");
	let engine = createTrainerBattleEngine(playerId, enemyId, allyId, seedEnemy);
	let battleId = createBattleId("tb-despawn");

	let spawn = engine.dispatch({
		type: "spawn-trainer-creature",
		trainerId: "rival-a",
		speciesId: SECONDARY_SPECIES_ID,
		level: 2,
	});
	let creature = spawn.find((event) => event.type === "trainer-creature-spawned");
	if (creature?.type !== "trainer-creature-spawned") throw new Error("expected a trainer creature");

	engine.dispatch({
		type: "start-battle",
		battleId,
		playerId,
		enemyId,
		playerParty: [allyId],
		enemyParty: [creature.creatureId],
		slots: 1,
		canLeaveBattle: false,
	});

	let result = driveTrainerBattle(engine, playerId, battleId);
	expect(result.finished).toBe(true);
	expect(result.winner).toBe(0);

	expect(() => engine.selectBattle(battleId)).not.toThrow();
	expect(engine.snapshot().entities.includes(creature.creatureId)).toBe(false);

	let spawn2 = engine.dispatch({
		type: "spawn-trainer-creature",
		trainerId: "rival-b",
		speciesId: SECONDARY_SPECIES_ID,
		level: 2,
	});
	let creature2 = spawn2.find((event) => event.type === "trainer-creature-spawned");
	if (creature2?.type !== "trainer-creature-spawned")
		throw new Error("expected a trainer creature");
	engine.dispatch({
		type: "start-battle",
		battleId: createBattleId("tb-despawn-2"),
		playerId,
		enemyId,
		playerParty: [allyId],
		enemyParty: [creature2.creatureId],
		slots: 1,
		canLeaveBattle: false,
	});
	expect(() => engine.selectCreatureSummary(creature.creatureId)).toThrow();
});

/**
 * Both trainer creatures share one enemy team, so the first faint forces
 * the bench member out through the standard side-1 replacement flow before
 * the battle can end.
 */
test("defeating a trainer's first creature sends out the next until the whole party is down", () => {
	let playerId = createPlayerId("hero");
	let enemyId = createPlayerId("rival");
	let allyId = createCreatureId("ally-1");
	let seedEnemy = createCreatureId("enemy-1");
	let engine = createTrainerBattleEngine(playerId, enemyId, allyId, seedEnemy);
	let battleId = createBattleId("tb-party");

	let enemyParty: string[] = [];
	for (let index = 0; index < 2; index += 1) {
		let spawn = engine.dispatch({
			type: "spawn-trainer-creature",
			trainerId: `rival-${index}`,
			speciesId: SECONDARY_SPECIES_ID,
			level: 2,
		});
		let creature = spawn.find((event) => event.type === "trainer-creature-spawned");
		if (creature?.type !== "trainer-creature-spawned")
			throw new Error("expected a trainer creature");
		enemyParty.push(creature.creatureId);
	}

	engine.dispatch({
		type: "start-battle",
		battleId,
		playerId,
		enemyId,
		playerParty: [allyId],
		enemyParty,
		slots: 1,
		canLeaveBattle: false,
	});

	let result = driveTrainerBattle(engine, playerId, battleId);
	expect(result.finished).toBe(true);
	expect(result.winner).toBe(0);
	expect(result.sawEnemyReplacement).toBe(true);
});

/**
 * Drives a trainer battle to completion, attacking every turn and filling
 * forced replacements with each slot's first bench creature.
 * @returns Whether the battle finished, which side won, and whether the
 * enemy (side 1) was ever asked to send out a replacement.
 */
function driveTrainerBattle(
	engine: Engine,
	playerId: string,
	battleId: ReturnType<typeof createBattleId>,
) {
	let finished = false;
	let winner: number | null = null;
	let sawEnemyReplacement = false;

	for (let turn = 0; turn < 300 && !finished; turn += 1) {
		let battle = engine.selectActiveBattle(playerId);
		if (!battle) break;
		let last = battle.events.at(-1);

		if (last?.type === "request-turn-commands") {
			let events = engine.dispatch({
				type: "submit-battle-turn",
				battleId,
				commands: last.requests.map((request) => ({
					type: "fight" as const,
					move: 0 as const,
					target: { side: request.side === 0 ? 1 : 0, slot: 0 },
				})),
			});
			let done = events.find((event) => event.type === "battle-finished");
			if (done?.type === "battle-finished") {
				finished = true;
				winner = done.winnerSide;
			}
		} else if (last?.type === "request-replacements") {
			sawEnemyReplacement ||= last.requests.some((request) => request.side === 1);
			let events = engine.dispatch({
				type: "submit-battle-replacements",
				battleId,
				commands: last.requests.map((request) => ({
					type: "replace" as const,
					target: { side: request.side, slot: request.slot },
					creature: request.choices[0]!,
				})),
			});
			let done = events.find((event) => event.type === "battle-finished");
			if (done?.type === "battle-finished") {
				finished = true;
				winner = done.winnerSide;
			}
		} else break;
	}

	return { finished, winner, sawEnemyReplacement };
}

/**
 * Creates an engine whose lone party creature vastly outlevels its
 * opponents, guaranteeing a win in a bounded number of turns regardless of
 * damage rolls. The seed enemy only satisfies the bootstrap enemy party.
 */
function createTrainerBattleEngine(
	playerId: string,
	enemyId: string,
	allyId: string,
	enemyCreatureId: string,
) {
	let creature = (species: string, experience: number) => ({
		species,
		nature: DEFAULT_NATURE_ID,
		experience,
		moveset: [DAMAGING_MOVE_ID, null, null, null] as [string, null, null, null],
		status: { state: null, damage: 0, pp: [35, 0, 0, 0] as [number, number, number, number] },
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
			money: { [playerId]: { amount: 0 } },
			creature: {
				[allyId]: creature(PRIMARY_SPECIES_ID, 50 ** 3),
				[enemyCreatureId]: creature(SECONDARY_SPECIES_ID, 0),
			},
		}),
	});
}

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
