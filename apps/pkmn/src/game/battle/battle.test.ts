import { unwrap } from "@pkg/result";
/**
 * Exercises end-to-end turn resolution, action ordering, and combat-state
 * transitions through the public battle API. Assertions protect the
 * contract between setup, command submission, and event streaming so
 * regressions surface without coupling tests to private implementation details.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "vitest";

import type { NatureId } from "~/game/data/nature";
import type { SpeciesId } from "~/game/data/species";

import { ITEMS } from "~/content/items";
import { TYPE_MATCHUPS } from "~/content/matchups";
import { MOVES } from "~/content/moves";
import { NATURES } from "~/content/natures";
import { SPECIES } from "~/content/species";
import { GameData } from "~/game/data/game-data";
import { DamageClass } from "~/game/data/move";
import { Stat } from "~/game/data/stat";
import { Creature, State } from "~/game/world/creature";

import type { BattleEvent, BattlePosition } from "./battle";
import type { CombatantState } from "./combatant-state";

import { Battle } from "./battle";
import { getCreatureCurrentHP, getCreatureStat } from "./mechanics";

let GAME_DATA = unwrap(
	GameData.create({
		species: SPECIES,
		moves: MOVES,
		items: ITEMS,
		natures: NATURES,
		typeChart: TYPE_MATCHUPS,
	}),
);

let PRIMARY_SPECIES_ID = getSpeciesId((species) => species.number === 1);
let SECONDARY_SPECIES_ID = getSpeciesId((species) => species.number === 2);
let ELECTRIC_SPECIES_ID = getSpeciesId((species) => species.types.includes("electric"));
let SPECTRAL_SPECIES_ID = getSpeciesId((species) => species.types.includes("ghost"));
let LIGHT_SPECIES_ID = getSpeciesId((species) => species.size.weight < 10);
let HEAVY_SPECIES_ID = getSpeciesId((species) => species.size.weight > 400);
let FOUR_X_ROCK_WEAK_SPECIES_ID = getSpeciesId(
	(species) => species.types.includes("fire") && species.types.includes("flying"),
);

test("the faster creature acts first when move priority matches", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [{ teams: [[createPrimaryFixture()]] }, { teams: [[createModestSecondaryFixture()]] }],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands")
		throw new TypeError("Expected turn command request.");

	let firstResolutionEvent = readEvent(
		session.next([
			{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
			{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
		]),
	);

	expect(firstResolutionEvent).toEqual({
		type: "move-used",
		user: { side: 1, slot: 0 },
		moveId: "VINE_WHIP",
		target: { side: 0, slot: 0 },
	});
});

test("Quick Attack acts before a faster creature using a normal-priority move", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createBravePrimaryFixtureWithQuickAttack()]] },
			{ teams: [[createModestSecondaryFixture()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands")
		throw new TypeError("Expected turn command request.");

	let firstResolutionEvent = readEvent(
		session.next([
			{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
			{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
		]),
	);

	expect(firstResolutionEvent).toEqual({
		type: "move-used",
		user: { side: 0, slot: 0 },
		moveId: "QUICK_ATTACK",
		target: { side: 1, slot: 0 },
	});
});

test("Extreme Speed acts before another positive-priority move", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createBravePrimaryFixtureWithExtremeSpeed()]] },
			{ teams: [[createModestSecondaryFixtureWithQuickAttack()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands")
		throw new TypeError("Expected turn command request.");

	let firstResolutionEvent = readEvent(
		session.next([
			{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
			{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
		]),
	);

	expect(firstResolutionEvent).toEqual({
		type: "move-used",
		user: { side: 0, slot: 0 },
		moveId: "EXTREME_SPEED",
		target: { side: 1, slot: 0 },
	});
});

test("when both creatures use Quick Attack, the faster creature acts first", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createBravePrimaryFixtureWithQuickAttack()]] },
			{ teams: [[createModestSecondaryFixtureWithQuickAttack()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands")
		throw new TypeError("Expected turn command request.");

	let firstResolutionEvent = readEvent(
		session.next([
			{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
			{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
		]),
	);

	expect(firstResolutionEvent).toEqual({
		type: "move-used",
		user: { side: 1, slot: 0 },
		moveId: "QUICK_ATTACK",
		target: { side: 0, slot: 0 },
	});
});

test("a zero-PP move cannot be used while other moves remain", () => {
	let primary = createPrimaryFixture();
	primary.status.pp[0] = 0;
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [{ teams: [[primary]] }, { teams: [[createModestSecondaryFixture()]] }],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") {
		throw new TypeError("Expected turn command request.");
	}

	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(
		events.some(
			(event) => event.type === "move-used" && event.user.side === 0 && event.user.slot === 0,
		),
	).toBe(false);
	expect(primary.status.pp[0]).toBe(0);
});

test("PP is spent when a move is committed even if the user faints before acting", () => {
	let primary = createLowHpPrimaryFixture();
	primary.status.pp[0] = 1;
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [{ teams: [[primary]] }, { teams: [[createModestSecondaryFixture()]] }],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") {
		throw new TypeError("Expected turn command request.");
	}

	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 1, target: { side: 0, slot: 0 } },
	]);

	expect(primary.status.pp[0]).toBe(0);
});

test("the built-in fallback move is used when no regular move has PP", () => {
	let primary = createPrimaryFixture();
	primary.status.pp = [0, 0, 0, 0];
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [{ teams: [[primary]] }, { teams: [[createModestSecondaryFixture()]] }],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") {
		throw new TypeError("Expected turn command request.");
	}

	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "move-used",
		user: { side: 0, slot: 0 },
		moveId: "fallback",
		target: { side: 1, slot: 0 },
	});
	expect(primary.status.pp).toEqual([0, 0, 0, 0]);
});

test("a fainted slot requests a replacement before the next turn", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createLowHpPrimaryFixture(), createBackupPrimaryFixture()]] },
			{ teams: [[createModestSecondaryFixture()]] },
		],
		/**
		 * 0.94 passes Razor Leaf's 95% accuracy while keeping the damage roll
		 * at its maximum, so the fainting-blow event stream stays deterministic.
		 */
		random: () => 0.94,
	});
	let session = battle.start();
	let events: BattleEvent[] = [];

	events.push(readEvent(session.next()));
	events.push(readEvent(session.next()));
	let turnRequest = readEvent(session.next());
	if (turnRequest.type !== "request-turn-commands") {
		throw new TypeError("Expected turn command request.");
	}
	events.push(turnRequest);

	events.push(
		readEvent(
			session.next([
				{ type: "fight", move: 2, target: { side: 1, slot: 0 } },
				{ type: "fight", move: 1, target: { side: 0, slot: 0 } },
			]),
		),
	);

	while (true) {
		let result = session.next();
		let event = readEvent(result);
		events.push(event);
		if (event.type === "request-replacements") break;
		if (result.done) break;
	}

	expect(events).toEqual([
		{ type: "battle-started" },
		{ type: "turn-started", turn: 1 },
		{
			type: "request-turn-commands",
			requests: [
				{ side: 0, slot: 0 },
				{ side: 1, slot: 0 },
			],
		},
		{
			type: "move-used",
			user: { side: 1, slot: 0 },
			moveId: "RAZOR_LEAF",
			target: { side: 0, slot: 0 },
		},
		{
			type: "effectiveness",
			target: { side: 0, slot: 0 },
			effectiveness: 0.25,
		},
		{ type: "damage-dealt", target: { side: 0, slot: 0 }, damage: 1, remainingHP: 0 },
		{ type: "creature-fainted", target: { side: 0, slot: 0 } },
		{ type: "turn-ended", turn: 1 },
		{
			type: "request-replacements",
			requests: [{ side: 0, slot: 0, team: 0, choices: [1] }],
		},
	]);

	let replacementRequest = events.at(-1);
	if (replacementRequest?.type !== "request-replacements") {
		throw new TypeError("Expected replacement request.");
	}

	let replacementEvent = readEvent(
		session.next([{ type: "replace", target: { side: 0, slot: 0 }, creature: 1 }]),
	);
	let nextTurnEvent = readEvent(session.next());

	expect(replacementEvent).toEqual({
		type: "creature-switched",
		target: { side: 0, slot: 0 },
		creature: 1,
	});
	expect(nextTurnEvent).toEqual({ type: "turn-started", turn: 2 });
	expect(battle.state.sides[0].active[0]?.creatureIndex).toBe(1);
	expect(battle.state.phase).toBe("awaiting-turn-input");
});

test("a side loses when its only team has no replacement left", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createLowHpPrimaryFixture()]] },
			{ teams: [[createModestSecondaryFixture()]] },
		],
		/** 0.94 passes Razor Leaf's 95% accuracy while keeping the damage roll maximal. */
		random: () => 0.94,
	});
	let session = battle.start();
	let lastEvent: BattleEvent | null = null;

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands")
		throw new TypeError("Expected turn command request.");

	readEvent(
		session.next([
			{ type: "fight", move: 2, target: { side: 1, slot: 0 } },
			{ type: "fight", move: 1, target: { side: 0, slot: 0 } },
		]),
	);

	while (true) {
		let result = session.next();
		lastEvent = readEvent(result);
		if (result.done) break;
	}

	expect(lastEvent).toEqual({ type: "battle-finished", winnerSide: 1 });
	expect(battle.state.winnerSide).toBe(1);
});

test("a side can leave the battle instead of sending a replacement", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{
				canLeaveBattle: true,
				teams: [[createLowHpPrimaryFixture(), createBackupPrimaryFixture()]],
			},
			{ teams: [[createModestSecondaryFixture()]] },
		],
		/** 0.94 passes Razor Leaf's 95% accuracy while keeping the damage roll maximal. */
		random: () => 0.94,
	});
	let session = battle.start();
	let lastEvent: BattleEvent | null = null;

	readEvent(session.next());
	readEvent(session.next());
	let turnRequest = readEvent(session.next());
	if (turnRequest.type !== "request-turn-commands") {
		throw new TypeError("Expected turn command request.");
	}

	readEvent(
		session.next([
			{ type: "fight", move: 2, target: { side: 1, slot: 0 } },
			{ type: "fight", move: 1, target: { side: 0, slot: 0 } },
		]),
	);

	while (true) {
		let result = session.next();
		let event = readEvent(result);
		if (event.type === "request-replacements") {
			lastEvent = readEvent(session.next([{ type: "leave-battle", target: { side: 0, slot: 0 } }]));
			break;
		}

		if (result.done) {
			lastEvent = event;
			break;
		}
	}

	expect(lastEvent).toEqual({ type: "battle-finished", winnerSide: 1 });
	expect(battle.state.winnerSide).toBe(1);
});

test("a side can leave the battle during turn input when escape is allowed", () => {
	/**
	 * A faster escapee always gets away, so the leave path resolves as a
	 * forfeit regardless of the random roll.
	 */
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ canLeaveBattle: true, teams: [[createFastPlayerFixtureWithTackle()]] },
			{ teams: [[createSlowSecondaryFixtureWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();
	let lastEvent: BattleEvent | null = null;

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") {
		throw new TypeError("Expected turn command request.");
	}

	readEvent(
		session.next([
			{ type: "leave-battle" },
			{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
		]),
	);

	while (true) {
		let result = session.next();
		lastEvent = readEvent(result);
		if (result.done) break;
	}

	expect(lastEvent).toEqual({ type: "battle-finished", winnerSide: 1 });
	expect(battle.state.winnerSide).toBe(1);
});

test("escaping always succeeds when the escapee is at least as fast as the opponent", () => {
	/**
	 * Fast player (Speed 189) vs slow enemy (Speed 136) makes pSpd >= eSpd, so
	 * escaping succeeds outright without consuming a random roll.
	 */
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ canLeaveBattle: true, teams: [[createFastPlayerFixtureWithTackle()]] },
			{ teams: [[createSlowSecondaryFixtureWithTackle()]] },
		],
		random: () => 0.99,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands")
		throw new TypeError("Expected turn command request.");

	let lastEvent: BattleEvent | null = null;
	readEvent(
		session.next([
			{ type: "leave-battle" },
			{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
		]),
	);
	while (true) {
		let result = session.next();
		lastEvent = readEvent(result);
		if (result.done) break;
	}

	expect(lastEvent).toEqual({ type: "battle-finished", winnerSide: 1 });
	expect(battle.state.escapeAttempts ?? 0).toBe(0);
});

test("a slower escapee always succeeds once accumulated attempts push the threshold to 256", () => {
	/**
	 * Slow player (113) vs fast enemy (214) gives base F = 67; the escapee's
	 * lower speed keeps the base term under 128, so only the seven seeded
	 * failures push F to 277, clearing the 256 threshold regardless of roll.
	 */
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ canLeaveBattle: true, teams: [[createSlowPlayerFixtureWithTackle()]] },
			{ teams: [[createFastSecondaryFixtureWithTackle()]] },
		],
		random: () => 0.99,
	});
	battle.state.escapeAttempts = 7;

	let session = battle.start();
	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands")
		throw new TypeError("Expected turn command request.");

	let lastEvent: BattleEvent | null = null;
	readEvent(
		session.next([
			{ type: "leave-battle" },
			{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
		]),
	);
	while (true) {
		let result = session.next();
		lastEvent = readEvent(result);
		if (result.done) break;
	}

	expect(lastEvent).toEqual({ type: "battle-finished", winnerSide: 1 });
	/** The attempt count keeps its seeded value across a successful escape. */
	expect(battle.state.escapeAttempts).toBe(7);
});

test("a slower escapee escapes when the random roll lands under the threshold", () => {
	/**
	 * Slow player (Speed 113) vs fast enemy (Speed 214): F = floor(113*128/214)
	 * = 67. The escape roll is the third random value drawn (two turn-order
	 * rolls precede it); 0 → floor(0*256)=0 < 67 → success.
	 */
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ canLeaveBattle: true, teams: [[createSlowPlayerFixtureWithTackle()]] },
			{ teams: [[createFastSecondaryFixtureWithTackle()]] },
		],
		random: createRandomSequence(0.5, 0.5, 0),
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands")
		throw new TypeError("Expected turn command request.");

	let lastEvent: BattleEvent | null = null;
	readEvent(
		session.next([
			{ type: "leave-battle" },
			{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
		]),
	);
	while (true) {
		let result = session.next();
		lastEvent = readEvent(result);
		if (result.done) break;
	}

	expect(lastEvent).toEqual({ type: "battle-finished", winnerSide: 1 });
	expect(battle.state.escapeAttempts ?? 0).toBe(0);
});

test("a failed escape emits escape-failed, lets the enemy act, and increments attempts", () => {
	/**
	 * Same slow-vs-fast pairing (F = 67). The escape roll (third random
	 * value) is 0.5 → floor(0.5*256)=128 >= 67 → failure: the escape is
	 * consumed, the enemy's move still resolves, and the attempt count rises to 1.
	 */
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ canLeaveBattle: true, teams: [[createSlowPlayerFixtureWithTackle()]] },
			{ teams: [[createFastSecondaryFixtureWithTackle()]] },
		],
		random: createRandomSequence(0.5, 0.5, 0.5),
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands")
		throw new TypeError("Expected turn command request.");

	let events = collectTurnEvents(session, battle, [
		{ type: "leave-battle" },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	let escapeFailed = events.find((event) => event.type === "escape-failed");
	expect(escapeFailed).toEqual({ type: "escape-failed", user: { side: 0, slot: 0 } });

	/** The enemy's move still resolves against the player this turn. */
	let enemyMove = events.find(
		(event) => event.type === "move-used" && event.user.side === 1 && event.target.side === 0,
	);
	expect(enemyMove).toBeDefined();

	/** The battle continues past a failed escape, leaving `winnerSide` null. */
	expect(battle.state.winnerSide).toBe(null);
	expect(battle.state.escapeAttempts).toBe(1);
});

test("a trapped or disallowed side cannot leave during turn input", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [{ teams: [[createPrimaryFixture()]] }, { teams: [[createModestSecondaryFixture()]] }],
		random: () => 1,
	});
	let trappedCombatant = battle.state.sides[0].active[0]?.combatant;
	if (!trappedCombatant) throw new TypeError("Expected an active combatant.");
	trappedCombatant.volatile.trapped = true;
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") {
		throw new TypeError("Expected turn command request.");
	}

	let firstResolutionEvent = readEvent(
		session.next([
			{ type: "leave-battle" },
			{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
		]),
	);

	expect(firstResolutionEvent).toEqual({
		type: "move-used",
		user: { side: 1, slot: 0 },
		moveId: "VINE_WHIP",
		target: { side: 0, slot: 0 },
	});
	expect(battle.state.winnerSide).toBe(null);
});

test("Mean Look prevents leaving the battle on later turns", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ canLeaveBattle: true, teams: [[createPrimaryFixture()]] },
			{ teams: [[createSecondaryFixtureWithMeanLook()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") {
		throw new TypeError("Expected turn command request.");
	}

	readEvent(
		session.next([
			{ type: "fight", move: 2, target: { side: 1, slot: 0 } },
			{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
		]),
	);

	while (true) {
		let result = session.next();
		let event = readEvent(result);
		if (event.type === "turn-ended") break;
		if (result.done) throw new TypeError("Battle ended before Mean Look test could continue.");
	}

	expect(battle.state.sides[0].active[0]?.combatant.volatile.trapped).toBe(true);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });

	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") {
		throw new TypeError("Expected second turn command request.");
	}

	let firstResolutionEvent = readEvent(
		session.next([
			{ type: "leave-battle" },
			{ type: "fight", move: 1, target: { side: 0, slot: 0 } },
		]),
	);

	expect(firstResolutionEvent).toEqual({
		type: "move-used",
		user: { side: 1, slot: 0 },
		moveId: "RAZOR_LEAF",
		target: { side: 0, slot: 0 },
	});
	expect(battle.state.winnerSide).toBe(null);
});

test("a side can switch to a bench creature during turn input", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithTackle(), createBackupPrimaryFixture()]] },
			{ teams: [[createModestSecondaryFixture()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let firstEvent = readEvent(
		session.next([
			{ type: "switch", target: { side: 0, slot: 0 }, creature: 1 },
			{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
		]),
	);

	expect(firstEvent).toEqual({
		type: "creature-switched",
		target: { side: 0, slot: 0 },
		creature: 1,
	});
	expect(battle.state.sides[0].active[0]?.creatureIndex).toBe(1);
});

test("Growl lowers the target attack stage", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithGrowl()]] },
			{ teams: [[createModestSecondaryFixture()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");

	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "stat-stage-changed",
		target: { side: 1, slot: 0 },
		stat: Stat.Attack,
		stages: -1,
		value: -1,
	});
	expect(battle.state.sides[1].active[0]?.combatant.statStages[Stat.Attack]).toBe(-1);
});

test("Safeguard blocks major status on the protected side", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithSafeguard()]] },
			{ teams: [[createModestSecondaryFixtureWithSleepPowder()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events.some((event) => event.type === "status-applied" && event.target.side === 0)).toBe(
		false,
	);
	expect(battle.state.sides[0].active[0]?.combatant.creature.status.state).toBe(null);
});

test("Electric Terrain blocks sleep for grounded targets", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithElectricTerrain()]] },
			{ teams: [[createModestSecondaryFixtureWithSleepPowder()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events.some((event) => event.type === "status-applied" && event.target.side === 0)).toBe(
		false,
	);
	expect(battle.state.sides[0].active[0]?.combatant.creature.status.state).toBe(null);
});

test("Misty Terrain blocks grounded major status applications", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithMistyTerrain()]] },
			{ teams: [[createModestSecondaryFixtureWithSleepPowder()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events.some((event) => event.type === "status-applied" && event.target.side === 0)).toBe(
		false,
	);
	expect(battle.state.sides[0].active[0]?.combatant.creature.status.state).toBe(null);
});

test("Mist blocks stat drops on the protected side", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithMist()]] },
			{ teams: [[createModestSecondaryFixtureWithGrowl()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(
		events.some((event) => event.type === "stat-stage-changed" && event.target.side === 0),
	).toBe(false);
	expect(battle.state.sides[0].active[0]?.combatant.statStages[Stat.Attack]).toBe(0);
});

test("Growth raises the user's special attack stage", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [{ teams: [[createPrimaryFixture()]] }, { teams: [[createModestSecondaryFixture()]] }],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");

	collectTurnEvents(session, battle, [
		{ type: "fight", move: 2, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	expect(battle.state.sides[0].active[0]?.combatant.statStages[Stat.SpecialAttack]).toBe(1);
});

test("Agility sharply raises the user's speed", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithAgility()]] },
			{ teams: [[createModestSecondaryFixture()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "stat-stage-changed",
		target: { side: 0, slot: 0 },
		stat: Stat.Speed,
		stages: 2,
		value: 2,
	});
	expect(battle.state.sides[0].active[0]?.combatant.statStages[Stat.Speed]).toBe(2);
});

test("Bulk Up raises the user's attack and defense", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithBulkUp()]] },
			{ teams: [[createModestSecondaryFixture()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "stat-stage-changed",
		target: { side: 0, slot: 0 },
		stat: Stat.Attack,
		stages: 1,
		value: 1,
	});
	expect(events).toContainEqual({
		type: "stat-stage-changed",
		target: { side: 0, slot: 0 },
		stat: Stat.Defense,
		stages: 1,
		value: 1,
	});
	expect(battle.state.sides[0].active[0]?.combatant.statStages[Stat.Attack]).toBe(1);
	expect(battle.state.sides[0].active[0]?.combatant.statStages[Stat.Defense]).toBe(1);
});

test("Tailwind doubles side speed and changes turn order", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithTailwind()]] },
			{ teams: [[createModestSecondaryFixture()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");

	let firstResolutionEvent = readEvent(
		session.next([
			{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
			{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
		]),
	);

	expect(firstResolutionEvent).toEqual({
		type: "move-used",
		user: { side: 0, slot: 0 },
		moveId: "EMBER",
		target: { side: 1, slot: 0 },
	});
});

test("Baby-Doll Eyes acts before a faster normal-priority move and lowers attack", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithBabyDollEyes()]] },
			{ teams: [[createModestSecondaryFixtureWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");

	let firstResolutionEvent = readEvent(
		session.next([
			{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
			{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
		]),
	);

	expect(firstResolutionEvent).toEqual({
		type: "move-used",
		user: { side: 0, slot: 0 },
		moveId: "BABY_DOLL_EYES",
		target: { side: 1, slot: 0 },
	});

	let events = [firstResolutionEvent];
	while (true) {
		let result = session.next();
		let event = readEvent(result);
		events.push(event);
		if (event.type === "turn-ended") break;
		if (result.done || battle.state.phase !== "resolving-turn") break;
	}

	expect(events).toContainEqual({
		type: "stat-stage-changed",
		target: { side: 1, slot: 0 },
		stat: Stat.Attack,
		stages: -1,
		value: -1,
	});
	expect(battle.state.sides[1].active[0]?.combatant.statStages[Stat.Attack]).toBe(-1);
});

test("Reflect reduces physical damage on the protected side", () => {
	let withoutReflect = getOpeningDamage([
		{ teams: [[createPrimaryFixtureWithTackle()]] },
		{ teams: [[createModestSecondaryFixture()]] },
	]);
	let withReflectBattle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithReflect()]] },
			{ teams: [[createModestSecondaryFixture()]] },
		],
		random: () => 1,
	});
	let session = withReflectBattle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, withReflectBattle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let secondTurnEvents = collectTurnEvents(session, withReflectBattle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	let reflectedDamage = secondTurnEvents.find((event) => event.type === "damage-dealt");
	if (!reflectedDamage || reflectedDamage.type !== "damage-dealt") {
		throw new TypeError("Expected damage event.");
	}

	expect(reflectedDamage.damage).toBeLessThan(withoutReflect);
	expect(withReflectBattle.state.sides[0].effects.reflectTurns).toBeGreaterThan(0);
});

test("Burn reduces physical opening damage but leaves special opening damage unchanged", () => {
	let neutralPhysicalDamage = getOpeningDamage([
		{ teams: [[createPrimaryFixtureWithTackle()]] },
		{ teams: [[createModestSecondaryFixture()]] },
	]);
	let burnedPhysicalUser = createPrimaryFixtureWithTackle();
	burnedPhysicalUser.status.state = State.Burned;
	let burnedPhysicalDamage = getOpeningDamage([
		{ teams: [[burnedPhysicalUser]] },
		{ teams: [[createModestSecondaryFixture()]] },
	]);

	let neutralSpecialDamage = getOpeningDamage([
		{ teams: [[createPrimaryFixtureWithEmber()]] },
		{ teams: [[createModestSecondaryFixture()]] },
	]);
	let burnedSpecialUser = createPrimaryFixtureWithEmber();
	burnedSpecialUser.status.state = State.Burned;
	let burnedSpecialDamage = getOpeningDamage([
		{ teams: [[burnedSpecialUser]] },
		{ teams: [[createModestSecondaryFixture()]] },
	]);

	expect(burnedPhysicalDamage).toBeLessThan(neutralPhysicalDamage);
	expect(burnedSpecialDamage).toBe(neutralSpecialDamage);
});

test("Brick Break clears Reflect on the target side", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithBrickBreak()]] },
			{ teams: [[createModestSecondaryFixtureWithReflect()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(battle.state.sides[1].effects.reflectTurns).toBeGreaterThan(0);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "side-effect-applied",
		side: 1,
		effect: "reflect",
		turns: 0,
	});
	expect(battle.state.sides[1].effects.reflectTurns).toBe(0);
});

test("Haze resets stat stages for both active combatants", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithHaze()]] },
			{ teams: [[createModestSecondaryFixtureWithGrowl()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(battle.state.sides[1].active[0]?.combatant.statStages[Stat.Attack]).toBe(-1);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "stat-stage-changed",
		target: { side: 1, slot: 0 },
		stat: Stat.Attack,
		stages: 1,
		value: 0,
	});
	expect(battle.state.sides[0].active[0]?.combatant.statStages[Stat.Attack]).toBe(0);
	expect(battle.state.sides[1].active[0]?.combatant.statStages[Stat.Attack]).toBe(0);
});

test("Clear Smog resets the target stat stages after dealing damage", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithClearSmog()]] },
			{ teams: [[createModestSecondaryFixtureWithGrowl()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(battle.state.sides[1].active[0]?.combatant.statStages[Stat.Attack]).toBe(-1);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 1, target: { side: 0, slot: 0 } },
	]);

	expect(events.some((event) => event.type === "damage-dealt" && event.target.side === 1)).toBe(
		true,
	);
	expect(events).toContainEqual({
		type: "stat-stage-changed",
		target: { side: 1, slot: 0 },
		stat: Stat.Attack,
		stages: 1,
		value: 0,
	});
	expect(battle.state.sides[1].active[0]?.combatant.statStages[Stat.Attack]).toBe(0);
});

test("Defog clears hazards from both sides", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithDefog()]] },
			{ teams: [[createModestSecondaryFixtureWithSpikes()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(battle.state.sides[0].effects.spikesLayers).toBe(1);

	battle.state.sides[1].effects.stealthRock = true;

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 1, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "side-effect-applied",
		side: 0,
		effect: "spikes",
		turns: 0,
	});
	expect(events).toContainEqual({
		type: "side-effect-applied",
		side: 1,
		effect: "stealth-rock",
		turns: 0,
	});
	expect(battle.state.sides[0].effects.spikesLayers).toBe(0);
	expect(battle.state.sides[1].effects.stealthRock).toBe(false);
});

test("Stealth Rock applies four-times weakness damage on switch-in", () => {
	let reserve = createBackupSecondaryFixture(FOUR_X_ROCK_WEAK_SPECIES_ID);
	let reserveHP = getCreatureCurrentHP(GAME_DATA, reserve);
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixture()]] },
			{ teams: [[createModestSecondaryFixtureWithTackle(), reserve]] },
		],
		random: () => 1,
	});
	battle.state.sides[1].effects.stealthRock = true;
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");

	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 2, target: { side: 1, slot: 0 } },
		{ type: "switch", target: { side: 1, slot: 0 }, creature: 1 },
	]);

	expect(events).toContainEqual({
		type: "hazard-triggered",
		target: { side: 1, slot: 0 },
		effect: "stealth-rock",
	});
	expect(events).toContainEqual({
		type: "damage-dealt",
		target: { side: 1, slot: 0 },
		damage: Math.floor(reserveHP / 2),
		remainingHP: reserveHP - Math.floor(reserveHP / 2),
	});
});

test("Trick Room reverses speed order on the following turn", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithTrickRoom()]] },
			{ teams: [[createModestSecondaryFixture()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");

	let firstResolutionEvent = readEvent(
		session.next([
			{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
			{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
		]),
	);

	expect(firstResolutionEvent).toEqual({
		type: "move-used",
		user: { side: 0, slot: 0 },
		moveId: "TACKLE",
		target: { side: 1, slot: 0 },
	});
});

test("Rain Dance applies rain to the shared field", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithRainDance()]] },
			{ teams: [[createModestSecondaryFixture()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({ type: "field-effect-applied", effect: "rain", turns: 5 });
	expect(battle.state.field.weather).toBe("rain");
	expect(battle.state.field.weatherTurns).toBe(4);
});

test("Grassy Terrain applies grassy terrain to the shared field", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithGrassyTerrain()]] },
			{ teams: [[createModestSecondaryFixture()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "field-effect-applied",
		effect: "grassy-terrain",
		turns: 5,
	});
	expect(battle.state.field.terrain).toBe("grassy");
	expect(battle.state.field.terrainTurns).toBe(4);
});

test("Grassy Terrain heals grounded combatants at the end of the turn", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createDamagedPrimaryFixtureWithGrassyTerrain()]] },
			{ teams: [[createModestSecondaryFixture()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let beforeDamage = battle.state.sides[0].active[0]?.combatant.creature.status.damage ?? 0;
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);
	let healedEvent = events.find(
		(event) => event.type === "damage-dealt" && event.target.side === 0 && event.damage === 0,
	);
	let afterDamage = battle.state.sides[0].active[0]?.combatant.creature.status.damage ?? 0;

	expect(healedEvent).toBeDefined();
	expect(afterDamage).toBeLessThan(beforeDamage);
});

test("Gravity applies gravity turns to the shared field", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithGravity()]] },
			{ teams: [[createModestSecondaryFixture()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({ type: "field-effect-applied", effect: "gravity", turns: 5 });
	expect(battle.state.field.gravityTurns).toBe(4);
});

test("Spikes damages a creature that switches in", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithSpikes()]] },
			{ teams: [[createModestSecondaryFixtureWithTackle(), createBackupSecondaryFixture()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "switch", target: { side: 1, slot: 0 }, creature: 1 },
	]);

	expect(battle.state.sides[1].effects.spikesLayers).toBe(1);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "switch", target: { side: 1, slot: 0 }, creature: 0 },
	]);

	expect(events).toContainEqual({
		type: "hazard-triggered",
		target: { side: 1, slot: 0 },
		effect: "spikes",
	});
});

test("Toxic applies escalating poison and increases residual damage each turn", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithToxic()]] },
			{ teams: [[createModestSecondaryFixtureWithTackle(HEAVY_SPECIES_ID)]] },
		],
		/** 0.89 passes Toxic's 90% accuracy so the poison lands. */
		random: () => 0.89,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let firstTurnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 1, slot: 0 } },
	]);
	let firstResidual = firstTurnEvents.find(
		(event) => event.type === "damage-dealt" && event.target.side === 1,
	);

	expect(firstTurnEvents).toContainEqual({
		type: "status-applied",
		target: { side: 1, slot: 0 },
		status: State.Poisoned,
	});
	expect(battle.state.sides[1].active[0]?.combatant.creature.status.poison).toBe("escalating");
	expect(firstResidual?.type === "damage-dealt" ? firstResidual.damage : null).toBeGreaterThan(0);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let secondTurnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 2, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 1, slot: 0 } },
	]);
	let secondResidual = secondTurnEvents.find(
		(event) => event.type === "damage-dealt" && event.target.side === 1,
	);

	expect(secondResidual?.type === "damage-dealt" ? secondResidual.damage : null).toBeGreaterThan(
		firstResidual?.type === "damage-dealt" ? firstResidual.damage : 0,
	);
});

test("Two layers of Toxic Spikes apply escalating poison on switch-in", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithToxicSpikes()]] },
			{
				teams: [
					[
						createModestSecondaryFixtureWithTackle(HEAVY_SPECIES_ID),
						createBackupSecondaryFixture(HEAVY_SPECIES_ID),
					],
				],
			},
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 1, slot: 0 } },
	]);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 1, slot: 0 } },
	]);

	expect(battle.state.sides[1].effects.toxicSpikesLayers).toBe(2);

	let thirdTurnStarted = readEvent(session.next());
	expect(thirdTurnStarted).toEqual({ type: "turn-started", turn: 3 });
	let thirdRequest = readEvent(session.next());
	if (thirdRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let thirdTurnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 2, target: { side: 1, slot: 0 } },
		{ type: "switch", target: { side: 1, slot: 0 }, creature: 1 },
	]);
	let firstResidual = thirdTurnEvents.find(
		(event) => event.type === "damage-dealt" && event.target.side === 1,
	);

	expect(thirdTurnEvents).toContainEqual({
		type: "hazard-triggered",
		target: { side: 1, slot: 0 },
		effect: "toxic-spikes",
	});
	expect(battle.state.sides[1].active[0]?.combatant.creature.status.poison).toBe("escalating");
	expect(firstResidual?.type === "damage-dealt" ? firstResidual.damage : null).toBeGreaterThan(0);
});

test("Escalating poison resets to its opening stage after the combatant switches out", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithToxic()]] },
			{
				teams: [
					[
						createModestSecondaryFixtureWithTackle(HEAVY_SPECIES_ID),
						createBackupSecondaryFixture(HEAVY_SPECIES_ID),
					],
				],
			},
		],
		/** 0.89 passes Toxic's 90% accuracy so the poison lands. */
		random: () => 0.89,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let firstTurnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);
	let openingResidual = firstTurnEvents.find(
		(event) => event.type === "damage-dealt" && event.target.side === 1,
	);

	readEvent(session.next());
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 2, target: { side: 1, slot: 0 } },
		{ type: "switch", target: { side: 1, slot: 0 }, creature: 1 },
	]);

	readEvent(session.next());
	let thirdRequest = readEvent(session.next());
	if (thirdRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let thirdTurnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 2, target: { side: 1, slot: 0 } },
		{ type: "switch", target: { side: 1, slot: 0 }, creature: 0 },
	]);
	let returnResidual = thirdTurnEvents.find(
		(event) => event.type === "damage-dealt" && event.target.side === 1,
	);

	expect(battle.state.sides[1].active[0]?.combatant.creature.status.poison).toBe("escalating");
	expect(openingResidual?.type === "damage-dealt" ? openingResidual.damage : null).toBe(
		returnResidual?.type === "damage-dealt" ? returnResidual.damage : null,
	);
	expect(battle.state.sides[1].active[0]?.combatant.volatile.escalatingPoisonStage).toBe(2);
});

test("Toxic Spikes respects misty terrain when a grounded target switches in", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{
				teams: [
					[createPrimaryFixtureWithMistyTerrain(), createBackupSecondaryFixture(HEAVY_SPECIES_ID)],
				],
			},
			{ teams: [[createModestSecondaryFixtureWithToxicSpikes(), createBackupSecondaryFixture()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "switch", target: { side: 0, slot: 0 }, creature: 1 },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(
		events.some((event) => event.type === "hazard-triggered" && event.effect === "toxic-spikes"),
	).toBe(false);
	expect(battle.state.sides[0].active[0]?.combatant.creature.status.state).toBe(null);
});

test("A grounded Poison-type absorbs Toxic Spikes on switch-in", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithTackle()]] },
			{
				teams: [
					[
						createModestSecondaryFixtureWithTackle(HEAVY_SPECIES_ID),
						createBackupSecondaryFixture(PRIMARY_SPECIES_ID),
					],
				],
			},
		],
		random: () => 1,
	});
	battle.state.sides[1].effects.toxicSpikesLayers = 2;
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "switch", target: { side: 1, slot: 0 }, creature: 1 },
	]);

	expect(events).toContainEqual({
		type: "hazard-triggered",
		target: { side: 1, slot: 0 },
		effect: "toxic-spikes",
	});
	expect(battle.state.sides[1].effects.toxicSpikesLayers).toBe(0);
	expect(battle.state.sides[1].active[0]?.combatant.creature.status.state).toBe(null);
});

test("Gravity makes a flying switch-in trigger grounded hazards", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithTackle()]] },
			{
				teams: [
					[
						createModestSecondaryFixtureWithTackle(),
						createBackupSecondaryFixture(FOUR_X_ROCK_WEAK_SPECIES_ID),
					],
				],
			},
		],
		random: () => 1,
	});
	battle.state.field.gravityTurns = 2;
	battle.state.sides[1].effects.spikesLayers = 1;
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "switch", target: { side: 1, slot: 0 }, creature: 1 },
	]);

	expect(events).toContainEqual({
		type: "hazard-triggered",
		target: { side: 1, slot: 0 },
		effect: "spikes",
	});
});

test("Earlier switch-in hazards resolve before Toxic Spikes absorption", () => {
	let reserve = createBackupSecondaryFixture(PRIMARY_SPECIES_ID);
	let reserveHP = getCreatureStat(GAME_DATA, reserve, Stat.HP);
	reserve.status.damage = reserveHP - 1;
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithTackle()]] },
			{ teams: [[createModestSecondaryFixtureWithTackle(HEAVY_SPECIES_ID), reserve]] },
		],
		random: () => 1,
	});
	battle.state.sides[1].effects.stealthRock = true;
	battle.state.sides[1].effects.toxicSpikesLayers = 2;
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "switch", target: { side: 1, slot: 0 }, creature: 1 },
	]);

	expect(events).toContainEqual({
		type: "hazard-triggered",
		target: { side: 1, slot: 0 },
		effect: "stealth-rock",
	});
	expect(
		events.some((event) => event.type === "hazard-triggered" && event.effect === "toxic-spikes"),
	).toBe(false);
	expect(events).toContainEqual({ type: "creature-fainted", target: { side: 1, slot: 0 } });
	expect(battle.state.sides[1].effects.toxicSpikesLayers).toBe(2);
});

test("Protect prevents direct damage for the turn", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithProtect()]] },
			{ teams: [[createModestSecondaryFixture()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "volatile-applied",
		target: { side: 0, slot: 0 },
		effect: "protect",
	});
	expect(events.some((event) => event.type === "damage-dealt" && event.target.side === 0)).toBe(
		false,
	);
});

test("Protect blocks targeted status effects for the turn", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithProtect()]] },
			{ teams: [[createModestSecondaryFixtureWithSleepPowder()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events.some((event) => event.type === "status-applied" && event.target.side === 0)).toBe(
		false,
	);
	expect(battle.state.sides[0].active[0]?.combatant.creature.status.state).toBe(null);
});

test("Protect uses declining success on consecutive turns", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithProtect()]] },
			{ teams: [[createModestSecondaryFixtureWithTackle()]] },
		],
		random: createRandomSequence(0.75),
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	readEvent(session.next());
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "move-failed",
		user: { side: 0, slot: 0 },
		reason: "requirement",
	});
	expect(events.some((event) => event.type === "damage-dealt" && event.target.side === 0)).toBe(
		true,
	);
	let active = battle.state.sides[0].active[0]?.combatant;
	if (!active) throw new TypeError("Expected active combatant.");
	expect(active.volatile.protectionSuccessStreak).toBe(0);
});

test("Protect resets its declining success after a different move", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithProtect()]] },
			{ teams: [[createModestSecondaryFixtureWithTackle()]] },
		],
		random: createRandomSequence(0.75),
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	readEvent(session.next());
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	readEvent(session.next());
	let thirdRequest = readEvent(session.next());
	if (thirdRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "volatile-applied",
		target: { side: 0, slot: 0 },
		effect: "protect",
	});
	expect(events.some((event) => event.type === "move-failed" && event.user.side === 0)).toBe(false);
	expect(events.some((event) => event.type === "damage-dealt" && event.target.side === 0)).toBe(
		false,
	);
});

test("Detect protects like Protect", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithDetect()]] },
			{ teams: [[createModestSecondaryFixtureWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "volatile-applied",
		target: { side: 0, slot: 0 },
		effect: "protect",
	});
	expect(events.some((event) => event.type === "damage-dealt" && event.target.side === 0)).toBe(
		false,
	);
});

test("Swift still respects Protect despite always-hit accuracy", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithSwift()]] },
			{ teams: [[createModestSecondaryFixtureWithDetect()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "move-used",
		user: { side: 0, slot: 0 },
		moveId: "SWIFT",
		target: { side: 1, slot: 0 },
	});
	expect(events.some((event) => event.type === "damage-dealt" && event.target.side === 1)).toBe(
		false,
	);
});

test("Endure leaves the user at 1 HP against lethal damage", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createLowHpPrimaryFixtureWithEndure()]] },
			{ teams: [[createModestSecondaryFixtureWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 1, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "volatile-applied",
		target: { side: 0, slot: 0 },
		effect: "endure",
	});
	let active = battle.state.sides[0].active[0]?.combatant;
	if (!active) throw new TypeError("Expected active combatant.");
	expect(getCreatureCurrentHP(GAME_DATA, active.creature)).toBe(1);
	expect(events.some((event) => event.type === "creature-fainted" && event.target.side === 0)).toBe(
		false,
	);
});

test("Endure uses declining success on consecutive turns", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createLowHpPrimaryFixtureWithEndure()]] },
			{ teams: [[createModestSecondaryFixtureWithTackle()]] },
		],
		random: createRandomSequence(0.75),
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	readEvent(session.next());
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "move-failed",
		user: { side: 0, slot: 0 },
		reason: "requirement",
	});
	expect(events).toContainEqual({ type: "creature-fainted", target: { side: 0, slot: 0 } });
});

test("False Swipe cannot knock out the target", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithFalseSwipe()]] },
			{ teams: [[createLowHpSecondaryFixtureWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	let active = battle.state.sides[1].active[0]?.combatant;
	if (!active) throw new TypeError("Expected active combatant.");
	expect(getCreatureCurrentHP(GAME_DATA, active.creature)).toBe(1);
	expect(events.some((event) => event.type === "creature-fainted" && event.target.side === 1)).toBe(
		false,
	);
});

test("Belly Drum costs half max HP and maximizes attack", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithBellyDrum()]] },
			{ teams: [[createModestSecondaryFixtureWithGrowl()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let user = battle.state.sides[0].active[0]?.combatant;
	if (!user) throw new TypeError("Expected active combatant.");
	let maxHP = getCreatureCurrentHP(GAME_DATA, user.creature);
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "stat-stage-changed",
		target: { side: 0, slot: 0 },
		stat: Stat.Attack,
		stages: 6,
		value: 6,
	});
	expect(user.statStages[Stat.Attack]).toBe(6);
	expect(getCreatureCurrentHP(GAME_DATA, user.creature)).toBe(maxHP - Math.floor(maxHP / 2));
});

test("Belly Drum fails when the user is at or below half HP", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createHalfHpPrimaryFixtureWithBellyDrum()]] },
			{ teams: [[createModestSecondaryFixtureWithGrowl()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let user = battle.state.sides[0].active[0]?.combatant;
	if (!user) throw new TypeError("Expected active combatant.");
	let hpBeforeMove = getCreatureCurrentHP(GAME_DATA, user.creature);
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "move-failed",
		user: { side: 0, slot: 0 },
		reason: "requirement",
	});
	expect(
		events.some(
			(event) =>
				event.type === "stat-stage-changed" &&
				event.target.side === 0 &&
				event.stat === Stat.Attack &&
				event.value === 6,
		),
	).toBe(false);
	expect(getCreatureCurrentHP(GAME_DATA, user.creature)).toBe(hpBeforeMove);
});

test("Jump Kick crash damage is applied when the move misses", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithJumpKick()]] },
			{ teams: [[createModestSecondaryFixtureWithSandAttack()]] },
		],
		random: createRandomSequence(1, 1, 0.99),
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 2, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let user = battle.state.sides[0].active[0]?.combatant;
	if (!user) throw new TypeError("Expected active combatant.");
	let maxHP = getCreatureCurrentHP(GAME_DATA, user.creature);
	let hpBeforeMiss = maxHP;
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "move-missed",
		user: { side: 0, slot: 0 },
		target: { side: 1, slot: 0 },
	});
	expect(getCreatureCurrentHP(GAME_DATA, user.creature)).toBe(hpBeforeMiss - Math.floor(maxHP / 2));
});

test("Fake Out only works on the user's first action", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithFakeOut()]] },
			{ teams: [[createModestSecondaryFixtureWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let firstTurnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(firstTurnEvents).toContainEqual({
		type: "volatile-applied",
		target: { side: 1, slot: 0 },
		effect: "flinch",
	});
	expect(firstTurnEvents.some((event) => event.type === "move-used" && event.user.side === 1)).toBe(
		false,
	);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let secondTurnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(
		secondTurnEvents.some(
			(event) => event.type === "move-used" && event.user.side === 0 && event.moveId === "FAKE_OUT",
		),
	).toBe(true);
	expect(secondTurnEvents).toContainEqual({
		type: "move-failed",
		user: { side: 0, slot: 0 },
		reason: "requirement",
	});
	expect(secondTurnEvents).toContainEqual({
		type: "move-used",
		user: { side: 1, slot: 0 },
		moveId: "TACKLE",
		target: { side: 0, slot: 0 },
	});
});

test("duplicate side effects fail before applying again", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithReflect()]] },
			{ teams: [[createModestSecondaryFixtureWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	readEvent(session.next());
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "move-failed",
		user: { side: 0, slot: 0 },
		reason: "requirement",
	});
	expect(
		events.filter(
			(event) =>
				event.type === "side-effect-applied" && event.side === 0 && event.effect === "reflect",
		).length,
	).toBe(0);
	expect(battle.state.sides[0].effects.reflectTurns).toBe(3);
});

test("duplicate non-room field effects fail before applying again", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithRainDance()]] },
			{ teams: [[createModestSecondaryFixtureWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	readEvent(session.next());
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "move-failed",
		user: { side: 0, slot: 0 },
		reason: "requirement",
	});
	expect(
		events.filter((event) => event.type === "field-effect-applied" && event.effect === "rain")
			.length,
	).toBe(0);
	expect(battle.state.field.weather).toBe("rain");
	expect(battle.state.field.weatherTurns).toBe(3);
});

test("reusing trick room clears the active room instead of failing", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithTrickRoom()]] },
			{ teams: [[createModestSecondaryFixtureWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	readEvent(session.next());
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events).not.toContainEqual({
		type: "move-failed",
		user: { side: 0, slot: 0 },
		reason: "requirement",
	});
	expect(events).toContainEqual({ type: "field-effect-applied", effect: "trick-room", turns: 0 });
	expect(battle.state.field.trickRoomTurns).toBe(0);
});

test("Feint breaks protection and still deals damage", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithFeint()]] },
			{ teams: [[createModestSecondaryFixtureWithDetect()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "move-used",
		user: { side: 1, slot: 0 },
		moveId: "DETECT",
		target: { side: 0, slot: 0 },
	});
	expect(events).toContainEqual({
		type: "move-used",
		user: { side: 0, slot: 0 },
		moveId: "FEINT",
		target: { side: 1, slot: 0 },
	});
	expect(events.some((event) => event.type === "damage-dealt" && event.target.side === 1)).toBe(
		true,
	);
});

test("Confuse Ray applies confusion to the target", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithConfuseRay()]] },
			{ teams: [[createModestSecondaryFixture()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "volatile-applied",
		target: { side: 1, slot: 0 },
		effect: "confusion",
	});
	expect(battle.state.sides[1].active[0]?.combatant.volatile.confusionTurns).toBe(2);
});

test("Fly spends one turn charging, avoids later attacks, then hits on the next turn", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithFly()]] },
			{ teams: [[createModestSecondaryFixtureWithTackle()]] },
		],
		/**
		 * 0.94 passes Fly's 95% accuracy on the strike turn while keeping
		 * damage maximal; the opponent's Tackle still misses the airborne
		 * user via semi-invulnerability.
		 */
		random: () => 0.94,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let firstTurnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(battle.state.sides[0].active[0]?.combatant.volatile.charging).toBe(true);
	expect(
		firstTurnEvents.some((event) => event.type === "damage-dealt" && event.target.side === 0),
	).toBe(true);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let firstResolutionEvent = readEvent(
		session.next([
			{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
			{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
		]),
	);

	expect(firstResolutionEvent).toEqual({
		type: "move-used",
		user: { side: 1, slot: 0 },
		moveId: "TACKLE",
		target: { side: 0, slot: 0 },
	});
	let secondTurnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(battle.state.sides[0].active[0]?.combatant.volatile.charging).toBe(false);
	expect(secondTurnEvents).toContainEqual({
		type: "move-missed",
		user: { side: 1, slot: 0 },
		target: { side: 0, slot: 0 },
	});
	expect(
		secondTurnEvents.some((event) => event.type === "damage-dealt" && event.target.side === 1),
	).toBe(true);
	let secondTurnFirstDamage = secondTurnEvents.find((event) => event.type === "damage-dealt");
	if (!secondTurnFirstDamage || secondTurnFirstDamage.type !== "damage-dealt") {
		throw new TypeError("Expected damage event from Fly.");
	}
	expect(secondTurnFirstDamage.target).toEqual({ side: 1, slot: 0 });
});

test("Swift misses an invulnerable target despite always-hit accuracy", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createSlowPrimaryFixtureWithSwift()]] },
			{ teams: [[createFastSecondaryFixtureWithFly()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "move-used",
		user: { side: 0, slot: 0 },
		moveId: "SWIFT",
		target: { side: 1, slot: 0 },
	});
	expect(events).toContainEqual({
		type: "move-missed",
		user: { side: 0, slot: 0 },
		target: { side: 1, slot: 0 },
	});
	expect(events.some((event) => event.type === "damage-dealt" && event.target.side === 1)).toBe(
		false,
	);
});

test("confused combatants can lose their action and hurt themselves", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithConfuseRay()]] },
			{ teams: [[createModestSecondaryFixtureWithTackle()]] },
		],
		random: createRandomSequence(1, 1, 0),
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 1, target: { side: 0, slot: 0 } },
	]);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events.some((event) => event.type === "move-used" && event.user.side === 1)).toBe(false);
	let selfDamage = events.find((event) => event.type === "damage-dealt" && event.target.side === 1);
	if (!selfDamage || selfDamage.type !== "damage-dealt") {
		throw new TypeError("Expected confusion self-hit damage.");
	}
	expect(selfDamage.damage).toBeGreaterThan(0);
});

test("Light Screen reduces special damage on the protected side", () => {
	let withoutLightScreen = getOpeningDamage([
		{ teams: [[createPrimaryFixtureWithEmber()]] },
		{ teams: [[createModestSecondaryFixture()]] },
	]);
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithLightScreen()]] },
			{ teams: [[createModestSecondaryFixtureWithEmber()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let secondTurnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	let screenedDamage = secondTurnEvents.find((event) => event.type === "damage-dealt");
	if (!screenedDamage || screenedDamage.type !== "damage-dealt") {
		throw new TypeError("Expected special damage event.");
	}

	expect(screenedDamage.damage).toBeLessThan(withoutLightScreen);
	expect(battle.state.sides[0].effects.lightScreenTurns).toBeGreaterThan(0);
});

test("Dragon Rage deals fixed damage", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithDragonRage()]] },
			{ teams: [[createModestSecondaryFixtureWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	let damage = events.find((event) => event.type === "damage-dealt" && event.target.side === 1);
	if (!damage || damage.type !== "damage-dealt")
		throw new TypeError("Expected Dragon Rage damage.");
	expect(damage.damage).toBe(40);
});

test("Brine deals more damage to a target below half HP", () => {
	let healthyDamage = getOpeningDamage([
		{ teams: [[createPrimaryFixtureWithBrine()]] },
		{ teams: [[createModestSecondaryFixtureWithTackle()]] },
	]);
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithBrine()]] },
			{ teams: [[createBelowHalfHpSecondaryFixtureWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);
	let damage = events.find((event) => event.type === "damage-dealt" && event.target.side === 1);
	if (!damage || damage.type !== "damage-dealt") throw new TypeError("Expected Brine damage.");

	expect(damage.damage).toBeGreaterThan(healthyDamage);
});

test("Hex deals more damage to a statused target", () => {
	let healthyDamage = getOpeningDamage([
		{ teams: [[createPrimaryFixtureWithHex()]] },
		{ teams: [[createModestSecondaryFixtureWithTackle()]] },
	]);
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithHex()]] },
			{ teams: [[createParalyzedSecondaryFixtureWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);
	let damage = events.find((event) => event.type === "damage-dealt" && event.target.side === 1);
	if (!damage || damage.type !== "damage-dealt") throw new TypeError("Expected Hex damage.");

	expect(damage.damage).toBeGreaterThan(healthyDamage);
});

test("Electro Ball deals more damage when the user is much faster", () => {
	let slowerDamage = getFirstDamageDealt([
		{ teams: [[createBravePrimaryFixtureWithElectroBall()]] },
		{ teams: [[createModestSecondaryFixtureWithTackle()]] },
	]);
	let fasterDamage = getFirstDamageDealt([
		{ teams: [[createFastPrimaryFixtureWithElectroBall()]] },
		{ teams: [[createSlowSecondaryFixtureWithTackle()]] },
	]);

	expect(fasterDamage).toBeGreaterThan(slowerDamage);
});

test("Gyro Ball deals more damage when the user is much slower", () => {
	let fasterUserDamage = getFirstDamageDealt([
		{ teams: [[createFastPrimaryFixtureWithGyroBall()]] },
		{ teams: [[createModestSecondaryFixtureWithTackle()]] },
	]);
	let slowerUserDamage = getFirstDamageDealt([
		{ teams: [[createBravePrimaryFixtureWithGyroBall()]] },
		{ teams: [[createFastSecondaryFixtureWithTackle()]] },
	]);

	expect(slowerUserDamage).toBeGreaterThan(fasterUserDamage);
});

test("Flail deals more damage at low HP", () => {
	let healthyDamage = getFirstDamageDealt([
		{ teams: [[createPrimaryFixtureWithFlail()]] },
		{ teams: [[createModestSecondaryFixtureWithTackle()]] },
	]);
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createLowHpPrimaryFixtureWithFlail()]] },
			{ teams: [[createModestSecondaryFixtureWithGrowl()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);
	let damage = events.find((event) => event.type === "damage-dealt" && event.target.side === 1);
	if (!damage || damage.type !== "damage-dealt") throw new TypeError("Expected Flail damage.");

	expect(damage.damage).toBeGreaterThan(healthyDamage);
});

test("Endeavor deals damage equal to the HP gap between target and user", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createLowHpPrimaryFixtureWithEndeavor()]] },
			{ teams: [[createModestSecondaryFixtureWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let user = battle.state.sides[0].active[0]?.combatant;
	let target = battle.state.sides[1].active[0]?.combatant;
	if (!user || !target) throw new TypeError("Expected active combatants.");
	let expectedDamage =
		getCreatureCurrentHP(GAME_DATA, target.creature) -
		getCreatureCurrentHP(GAME_DATA, user.creature);
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);
	let damage = events.find((event) => event.type === "damage-dealt" && event.target.side === 1);
	if (!damage || damage.type !== "damage-dealt") throw new TypeError("Expected Endeavor damage.");

	expect(damage.damage).toBe(expectedDamage);
	expect(getCreatureCurrentHP(GAME_DATA, target.creature)).toBe(
		getCreatureCurrentHP(GAME_DATA, user.creature),
	);
});

test("Endeavor fails when the target does not have more HP than the user", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithEndeavor()]] },
			{ teams: [[createLowHpSecondaryFixtureWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "move-failed",
		user: { side: 0, slot: 0 },
		reason: "requirement",
	});
	expect(events.some((event) => event.type === "damage-dealt" && event.target.side === 1)).toBe(
		false,
	);
});

test("Heavy Slam deals more damage to lighter targets", () => {
	let veryLightTargetDamage = getFirstDamageDealt([
		{ teams: [[createHeavyFixtureWithHeavySlam()]] },
		{ teams: [[createLightFixtureWithTackle()]] },
	]);
	let heavierTargetDamage = getFirstDamageDealt([
		{ teams: [[createHeavyFixtureWithHeavySlam()]] },
		{ teams: [[createModestSecondaryFixtureWithTackle()]] },
	]);

	expect(veryLightTargetDamage).toBeGreaterThan(heavierTargetDamage);
});

test("Follow Me redirects an attack from an ally to the user in doubles", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithFollowMe(), createBackupPrimaryFixture()]] },
			{ teams: [[createModestSecondaryFixtureWithTackle(), createBackupSecondaryFixture()]] },
		],
		slots: 2,
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let firstTurnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 1 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 1 } },
	]);

	expect(firstTurnEvents).toContainEqual({
		type: "move-used",
		user: { side: 1, slot: 0 },
		moveId: "TACKLE",
		target: { side: 0, slot: 0 },
	});
	expect(
		firstTurnEvents.some(
			(event) =>
				event.type === "damage-dealt" && event.target.side === 0 && event.target.slot === 0,
		),
	).toBe(true);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let secondTurnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 1 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 1 } },
	]);

	expect(secondTurnEvents).toContainEqual({
		type: "move-used",
		user: { side: 1, slot: 0 },
		moveId: "TACKLE",
		target: { side: 0, slot: 1 },
	});
	expect(
		secondTurnEvents.some(
			(event) =>
				event.type === "damage-dealt" && event.target.side === 0 && event.target.slot === 1,
		),
	).toBe(true);
});

test("Dragon Tail forces the target to switch after dealing damage", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithDragonTail()]] },
			{ teams: [[createModestSecondaryFixtureWithTackle(), createBackupSecondaryFixture()]] },
		],
		random: () => 0,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 1, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "creature-switched",
		target: { side: 1, slot: 0 },
		creature: 1,
	});
	expect(battle.state.sides[1].active[0]?.creatureIndex).toBe(1);
});

test("Roar forces the target to switch without dealing damage", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithRoar()]] },
			{ teams: [[createSlowSecondaryFixtureWithTackle(), createBackupSecondaryFixture()]] },
		],
		random: () => 0,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 1, target: { side: 0, slot: 0 } },
	]);

	expect(events.some((event) => event.type === "damage-dealt" && event.target.side === 1)).toBe(
		false,
	);
	expect(events).toContainEqual({
		type: "creature-switched",
		target: { side: 1, slot: 0 },
		creature: 1,
	});
	expect(battle.state.sides[1].active[0]?.creatureIndex).toBe(1);
});

test("Baton Pass switches the user and preserves stat stages", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithBatonPass(), createBackupPrimaryFixture()]] },
			{ teams: [[createModestSecondaryFixtureWithGrowl()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let active = battle.state.sides[0].active[0]?.combatant;
	if (!active) throw new TypeError("Expected active combatant.");
	active.statStages[Stat.Attack] = 2;
	active.statStages[Stat.Defense] = 1;
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 }, creature: 1 },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "creature-switched",
		target: { side: 0, slot: 0 },
		creature: 1,
	});
	expect(battle.state.sides[0].active[0]?.creatureIndex).toBe(1);
	expect(battle.state.sides[0].active[0]?.combatant.statStages[Stat.Attack]).toBe(2);
	expect(battle.state.sides[0].active[0]?.combatant.statStages[Stat.Defense]).toBe(1);
});

test("Future Sight deals damage at the end of a later turn", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithFutureSight()]] },
			{ teams: [[createModestSecondaryFixtureWithGrowl()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	expect(battle.state.delayedAttacks).toHaveLength(1);
	expect(battle.state.delayedAttacks[0]?.moveId).toBe("FUTURE_SIGHT");

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let secondTurnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	expect(
		secondTurnEvents.some((event) => event.type === "damage-dealt" && event.target.side === 1),
	).toBe(true);
});

test("Charge doubles the user's next Electric attack once", () => {
	/** 0.89 passes Charge Beam's 90% accuracy so both the baseline and charged shots land. */
	let normalDamage = getFirstDamageDealt(
		[
			{ teams: [[createPrimaryFixtureWithChargeBeam()]] },
			{ teams: [[createModestSecondaryFixtureWithGrowl()]] },
		],
		() => 0.89,
	);
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithCharge()]] },
			{ teams: [[createModestSecondaryFixtureWithGrowl()]] },
		],
		random: () => 0.89,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let secondTurnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);
	let damage = secondTurnEvents.find(
		(event) => event.type === "damage-dealt" && event.target.side === 1,
	);
	if (!damage || damage.type !== "damage-dealt")
		throw new TypeError("Expected charged Electric damage.");

	expect(damage.damage).toBeGreaterThan(normalDamage);
});

test("Focus Energy raises the user's critical-hit chance", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithFocusEnergy()]] },
			{ teams: [[createModestSecondaryFixtureWithGrowl()]] },
		],
		random: () => 0.1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let secondTurnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	expect(secondTurnEvents).toContainEqual({ type: "critical-hit", target: { side: 1, slot: 0 } });
});

test("High-crit moves raise the user's critical-hit chance", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithRazorLeaf()]] },
			{ teams: [[createModestSecondaryFixtureWithGrowl()]] },
		],
		random: () => 0.1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let turnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(turnEvents).toContainEqual({ type: "critical-hit", target: { side: 1, slot: 0 } });
});

test("Critical-rate item stages raise the user's critical-hit chance once applied", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithTackle()]] },
			{ teams: [[createModestSecondaryFixtureWithGrowl()]] },
		],
		random: () => 0.4,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let direHit = ITEMS.DIREHIT.effect;
	if (direHit.kind !== "critical-rate") throw new TypeError("Expected a crit-rate battle item.");
	battle.state.sides[0].active[0]!.combatant.volatile.criticalHitStages = direHit.stages;
	let turnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(turnEvents).toContainEqual({ type: "critical-hit", target: { side: 1, slot: 0 } });
});

test("Aqua Ring heals the user at the end of the turn", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createDamagedPrimaryFixtureWithAquaRing()]] },
			{ teams: [[createModestSecondaryFixtureWithGrowl()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	let startingHP = getCreatureCurrentHP(
		GAME_DATA,
		battle.state.sides[0].active[0]!.combatant.creature,
	);
	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	let endingHP = getCreatureCurrentHP(
		GAME_DATA,
		battle.state.sides[0].active[0]!.combatant.creature,
	);
	expect(endingHP).toBeGreaterThan(startingHP);
});

test("Healing Wish restores the next replacement", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{
				teams: [
					[createPrimaryFixtureWithHealingWish(), createDamagedParalyzedBackupPrimaryFixture()],
				],
			},
			{ teams: [[createModestSecondaryFixtureWithGrowl()]] },
		],
		random: () => 1,
	});
	battle.state.sides[0]!.effects.stealthRock = true;
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	let replacementRequest = readEvent(session.next());
	if (replacementRequest.type !== "request-replacements")
		throw new TypeError("Expected replacement request.");
	let replacementEvents: BattleEvent[] = [];
	replacementEvents.push(
		readEvent(session.next([{ type: "replace", target: { side: 0, slot: 0 }, creature: 1 }])),
	);

	while (true) {
		let result = session.next();
		let event = readEvent(result);
		replacementEvents.push(event);
		if (event.type === "turn-started") break;
		if (result.done) break;
	}

	let replacement = battle.state.sides[0].active[0]?.combatant;
	if (!replacement) throw new TypeError("Expected replacement combatant.");
	let maxHP = getCreatureStat(GAME_DATA, replacement.creature, Stat.HP);

	expect(replacementEvents[0]).toEqual({
		type: "creature-switched",
		target: { side: 0, slot: 0 },
		creature: 1,
	});
	expect(replacementEvents[1]).toEqual({
		type: "hazard-triggered",
		target: { side: 0, slot: 0 },
		effect: "stealth-rock",
	});
	if (replacementEvents[2]?.type !== "damage-dealt") {
		throw new TypeError("Expected hazard damage after replacement switch-in.");
	}
	expect(replacementEvents[2].damage).toBeGreaterThan(0);
	if (replacementEvents[3]?.type !== "damage-dealt") {
		throw new TypeError("Expected Healing Wish heal event after switch-in hazards.");
	}
	expect(replacementEvents[3].damage).toBe(0);
	expect(replacementEvents[3].remainingHP).toBe(maxHP);

	expect(replacement.creature.status.state).toBe(null);
	expect(getCreatureCurrentHP(GAME_DATA, replacement.creature)).toBe(maxHP);
});

test("Curse boosts Attack and Defense and lowers Speed for non-Ghost users", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithCurse()]] },
			{ teams: [[createModestSecondaryFixtureWithGrowl()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "stat-stage-changed",
		target: { side: 0, slot: 0 },
		stat: Stat.Attack,
		stages: 1,
		value: 1,
	});
	expect(events).toContainEqual({
		type: "stat-stage-changed",
		target: { side: 0, slot: 0 },
		stat: Stat.Defense,
		stages: 1,
		value: 1,
	});
	expect(events).toContainEqual({
		type: "stat-stage-changed",
		target: { side: 0, slot: 0 },
		stat: Stat.Speed,
		stages: -1,
		value: -1,
	});
});

test("Curse deals half the user's HP and curses the target for Ghost users", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createSpectralFixtureWithCurse()]] },
			{ teams: [[createModestSecondaryFixtureWithGrowl()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	let user = battle.state.sides[0].active[0]?.combatant;
	if (!user) throw new TypeError("Expected active combatant.");
	let maxHP = getCreatureStat(GAME_DATA, user.creature, Stat.HP);
	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	expect(getCreatureCurrentHP(GAME_DATA, user.creature)).toBe(maxHP - Math.floor(maxHP / 2));
	expect(battle.state.sides[1].active[0]?.combatant.volatile.cursed).toBe(true);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let secondTurnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	expect(
		secondTurnEvents.some((event) => event.type === "damage-dealt" && event.target.side === 1),
	).toBe(true);
});

test("Assurance deals more damage after the target was already hit this turn", () => {
	let normalDamage = getFirstDamageDealt([
		{ teams: [[createPrimaryFixtureWithAssurance()]] },
		{ teams: [[createModestSecondaryFixtureWithTackle()]] },
	]);
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithAssurance()]] },
			{ teams: [[createModestSecondaryFixtureWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let target = battle.state.sides[1].active[0]?.combatant;
	if (!target) throw new TypeError("Expected active target.");
	target.volatile.lastDamageThisTurn = {
		amount: 12,
		source: { side: 1, slot: 0 },
		moveClass: DamageClass.Physical,
	};
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);
	let damage = events.find((event) => event.type === "damage-dealt" && event.target.side === 1);
	if (!damage || damage.type !== "damage-dealt") throw new TypeError("Expected Assurance damage.");

	expect(damage.damage).toBeGreaterThan(normalDamage);
});

test("Counter returns double the last physical damage taken", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithCounter()]] },
			{ teams: [[createModestSecondaryFixtureWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);
	let takenDamage = events.find(
		(event) => event.type === "damage-dealt" && event.target.side === 0,
	);
	if (!takenDamage || takenDamage.type !== "damage-dealt")
		throw new TypeError("Expected damage taken.");
	let counterDamage = [...events]
		.reverse()
		.find((event) => event.type === "damage-dealt" && event.target.side === 1);
	if (!counterDamage || counterDamage.type !== "damage-dealt")
		throw new TypeError("Expected Counter damage.");

	expect(counterDamage.damage).toBe(takenDamage.damage * 2);
});

test("Destiny Bond makes the attacker faint after knocking out the user", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createLowHpPrimaryFixtureWithDestinyBond()]] },
			{ teams: [[createLightFixtureWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "volatile-applied",
		target: { side: 0, slot: 0 },
		effect: "destiny-bond",
	});
	expect(events.some((event) => event.type === "creature-fainted" && event.target.side === 0)).toBe(
		true,
	);
	expect(events.some((event) => event.type === "creature-fainted" && event.target.side === 1)).toBe(
		true,
	);
});

test("a simultaneous elimination with no reserves finishes as a draw", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createLowHpPrimaryFixtureWithDestinyBond()]] },
			{ teams: [[createLightFixtureWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	let finishEvent = readEvent(session.next());

	expect(finishEvent).toEqual({ type: "battle-finished", winnerSide: null });
	expect(battle.state.phase).toBe("finished");
	expect(battle.state.winnerSide).toBe(null);
});

test("a simultaneous elimination with reserves still requests replacements", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createLowHpPrimaryFixtureWithDestinyBond(), createBackupPrimaryFixture()]] },
			{ teams: [[createLightFixtureWithTackle(), createBackupSecondaryFixture()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	let replacementEvent = readEvent(session.next());

	expect(replacementEvent).toEqual({
		type: "request-replacements",
		requests: [
			{ side: 0, slot: 0, team: 0, choices: [1] },
			{ side: 1, slot: 0, team: 0, choices: [1] },
		],
	});
	expect(battle.state.phase).toBe("awaiting-replacement");
	expect(battle.state.winnerSide).toBe(null);
});

test("Fell Stinger sharply raises attack after a knockout", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithFellStinger()]] },
			{ teams: [[createLowHpSecondaryFixtureWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 1, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "stat-stage-changed",
		target: { side: 0, slot: 0 },
		stat: Stat.Attack,
		stages: 3,
		value: 3,
	});
	expect(battle.state.sides[0].active[0]?.combatant.statStages[Stat.Attack]).toBe(3);
});

test("Focus Punch fails if the user was damaged earlier in the turn", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithFocusPunch()]] },
			{ teams: [[createModestSecondaryFixtureWithQuickAttack()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "move-failed",
		user: { side: 0, slot: 0 },
		reason: "requirement",
	});
	expect(events.some((event) => event.type === "damage-dealt" && event.target.side === 1)).toBe(
		false,
	);
});

test("Take Down deals recoil to the user", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithTakeDown()]] },
			{ teams: [[createModestSecondaryFixtureWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events.some((event) => event.type === "damage-dealt" && event.target.side === 0)).toBe(
		true,
	);
});

test("Sandstorm deals residual damage to non-immune combatants", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithSandstorm()]] },
			{ teams: [[createModestSecondaryFixture()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({ type: "field-effect-applied", effect: "sand", turns: 5 });
	expect(events.some((event) => event.type === "damage-dealt" && event.target.side === 1)).toBe(
		true,
	);
	expect(battle.state.field.weather).toBe("sand");
	expect(battle.state.field.weatherTurns).toBe(4);
});

test("Hyper Beam forces the user to recharge on the next turn", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithHyperBeam()]] },
			{ teams: [[createModestSecondaryFixtureWithTackle()]] },
		],
		/** 0.89 passes Hyper Beam's 90% accuracy so it connects and forces the recharge. */
		random: () => 0.89,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "move-failed",
		user: { side: 0, slot: 0 },
		reason: "recharge",
	});
});

test("Taunt prevents the target from using status moves", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithTaunt()]] },
			{ teams: [[createModestSecondaryFixture()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "move-failed",
		user: { side: 1, slot: 0 },
		reason: "taunt",
	});
});

test("Disable prevents using the disabled move slot", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithDisable()]] },
			{ teams: [[createModestSecondaryFixtureWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "move-failed",
		user: { side: 1, slot: 0 },
		reason: "disabled",
	});
});

test("Encore locks the target into its last successful move slot", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createModestSecondaryFixtureWithEncore()]] },
			{ teams: [[createPrimaryFixtureWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 1, target: { side: 0, slot: 0 } },
	]);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	let thirdTurnStarted = readEvent(session.next());
	expect(thirdTurnStarted).toEqual({ type: "turn-started", turn: 3 });
	let thirdRequest = readEvent(session.next());
	if (thirdRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "move-used",
		user: { side: 1, slot: 0 },
		moveId: "EMBER",
		target: { side: 0, slot: 0 },
	});
	expect(battle.state.sides[1].active[0]?.combatant.volatile.encoredMoveSlot).toBe(1);
});

test("Identify lets Normal moves hit a Ghost target on later turns", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithIdentify()]] },
			{ teams: [[createSpectralFixtureWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let firstTurnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 1, target: { side: 0, slot: 0 } },
	]);

	expect(firstTurnEvents).toContainEqual({
		type: "volatile-applied",
		target: { side: 1, slot: 0 },
		effect: "identify",
	});
	expect(battle.state.sides[1].active[0]?.combatant.volatile.identified).toBe(true);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let secondTurnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 1, target: { side: 0, slot: 0 } },
	]);

	expect(
		secondTurnEvents.some((event) => event.type === "damage-dealt" && event.target.side === 1),
	).toBe(true);
});

test("Swift still respects type immunity despite always-hit accuracy", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithSwift()]] },
			{ teams: [[createSpectralFixtureWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "effectiveness",
		target: { side: 1, slot: 0 },
		effectiveness: 0,
	});
	expect(events.some((event) => event.type === "damage-dealt" && event.target.side === 1)).toBe(
		false,
	);
});

test("Identify clears when the identified combatant switches out", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithIdentify()]] },
			{ teams: [[createSpectralFixtureWithTackle(), createBackupSecondaryFixture()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 1, target: { side: 0, slot: 0 } },
	]);

	expect(battle.state.sides[1].active[0]?.combatant.volatile.identified).toBe(true);

	readEvent(session.next());
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "switch", target: { side: 1, slot: 0 }, creature: 1 },
	]);

	expect(battle.state.sides[1].teams[0]?.creatures[0]?.volatile.identified).toBe(false);
	expect(battle.state.sides[1].active[0]?.combatant.volatile.identified).toBe(false);
});

test("Attract ends when the source switches out before the target acts", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithAttract(), createBackupPrimaryFixture()]] },
			{ teams: [[createSlowSecondaryFixtureWithTackle()]] },
		],
		random: () => 0,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(battle.state.sides[1].active[0]?.combatant.volatile.attracted).toBe(true);

	readEvent(session.next());
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let secondTurnEvents = collectTurnEvents(session, battle, [
		{ type: "switch", target: { side: 0, slot: 0 }, creature: 1 },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(secondTurnEvents).toContainEqual({
		type: "move-used",
		user: { side: 1, slot: 0 },
		moveId: "TACKLE",
		target: { side: 0, slot: 0 },
	});
	expect(
		secondTurnEvents.some(
			(event) =>
				event.type === "move-failed" && event.user.side === 1 && event.reason === "attract",
		),
	).toBe(false);
	expect(battle.state.sides[1].active[0]?.combatant.volatile.attracted).toBe(false);
	expect(battle.state.sides[1].active[0]?.combatant.volatile.attractedBy).toBeNull();
});

test("Wrap traps and deals residual damage on later turns", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithWrap()]] },
			{ teams: [[createModestSecondaryFixtureWithTackle()]] },
		],
		/** 0.89 passes Wrap's 90% accuracy so the trap and residual damage occur. */
		random: () => 0.89,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(battle.state.sides[1].active[0]?.combatant.volatile.partiallyTrappedTurns).toBeGreaterThan(
		0,
	);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let secondTurnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(
		secondTurnEvents.some((event) => event.type === "damage-dealt" && event.target.side === 1),
	).toBe(true);
});

test("Double Slap can hit multiple times in one move", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithDoubleSlap()]] },
			{ teams: [[createModestSecondaryFixtureWithTackle()]] },
		],
		/** 0.84 passes Double Slap's 85% accuracy and yields the maximum hit count. */
		random: () => 0.84,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	let hits = events.filter((event) => event.type === "damage-dealt" && event.target.side === 1);
	expect(hits.length).toBeGreaterThan(1);
});

test("Sleep Powder applies sleep and sleeping combatants cannot act", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithSleepPowder()]] },
			{ teams: [[createModestSecondaryFixtureWithTackle()]] },
		],
		/** 0.74 passes Sleep Powder's 75% accuracy so the sleep lands. */
		random: () => 0.74,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let firstTurnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 1, target: { side: 0, slot: 0 } },
	]);

	expect(firstTurnEvents).toContainEqual({
		type: "status-applied",
		target: { side: 1, slot: 0 },
		status: State.Asleep,
	});

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let secondTurnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(
		secondTurnEvents.some((event) => event.type === "move-used" && event.user.side === 1),
	).toBe(false);
});

test("Hypnosis applies sleep and sleeping combatants cannot act", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithHypnosis()]] },
			{ teams: [[createModestSecondaryFixtureWithTackle()]] },
		],
		/** 0.59 passes Hypnosis's 60% accuracy so the sleep lands. */
		random: () => 0.59,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let firstTurnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(firstTurnEvents).toContainEqual({
		type: "status-applied",
		target: { side: 1, slot: 0 },
		status: State.Asleep,
	});

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let secondTurnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(
		secondTurnEvents.some((event) => event.type === "move-used" && event.user.side === 1),
	).toBe(false);
});

test("sleep tracks turns and clears when the combatant wakes up", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithGrowl()]] },
			{ teams: [[createSleepingSecondaryFixtureWithTackle()]] },
		],
		random: createRandomSequence(0, 1),
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let firstTurnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(firstTurnEvents.some((event) => event.type === "move-used" && event.user.side === 1)).toBe(
		false,
	);

	readEvent(session.next());
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let secondTurnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(
		secondTurnEvents.some((event) => event.type === "move-used" && event.user.side === 1),
	).toBe(true);
	expect(battle.state.sides[1].active[0]?.combatant.creature.status.state).toBe(null);
	expect(battle.state.sides[1].active[0]?.combatant.majorStatus.sleepTurns).toBe(0);
});

test("frozen combatants can thaw on their turn and then act", () => {
	let secondary = createSlowSecondaryFixtureWithTackle();
	secondary.status.state = State.Frozen;
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [{ teams: [[createPrimaryFixtureWithGrowl()]] }, { teams: [[secondary]] }],
		random: () => 0,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let firstTurnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(firstTurnEvents.some((event) => event.type === "move-used" && event.user.side === 1)).toBe(
		true,
	);
	expect(battle.state.sides[1].active[0]?.combatant.creature.status.state).toBe(null);
});

test("frozen combatants can thaw by using a fire move", () => {
	let primary = createPrimaryFixtureWithEmber();
	primary.status.state = State.Frozen;
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [{ teams: [[primary]] }, { teams: [[createModestSecondaryFixtureWithGrowl()]] }],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "move-used",
		user: { side: 0, slot: 0 },
		moveId: "EMBER",
		target: { side: 1, slot: 0 },
	});
	expect(battle.state.sides[0].active[0]?.combatant.creature.status.state).toBe(null);
});

test("paralysis can prevent a combatant from acting", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithGrowl()]] },
			{ teams: [[createParalyzedSecondaryFixtureWithTackle()]] },
		],
		random: () => 0,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events.some((event) => event.type === "move-used" && event.user.side === 1)).toBe(false);
});

test("Absorb heals the user after dealing damage", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createDamagedPrimaryFixtureWithAbsorb()]] },
			{ teams: [[createSleepingSecondaryFixtureWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let beforeDamage = battle.state.sides[0].active[0]?.combatant.creature.status.damage ?? 0;
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);
	let damageEvent = events.find(
		(event) => event.type === "damage-dealt" && event.target.side === 1,
	);
	let healedEvent = events.find(
		(event) => event.type === "damage-dealt" && event.target.side === 0 && event.damage === 0,
	);
	let afterDamage = battle.state.sides[0].active[0]?.combatant.creature.status.damage ?? 0;

	expect(damageEvent).toBeDefined();
	expect(healedEvent).toBeDefined();
	expect(afterDamage).toBeLessThan(beforeDamage);
});

test("Dream Eater heals the user when the target is asleep", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createDamagedPrimaryFixtureWithDreamEater()]] },
			{ teams: [[createSleepingSecondaryFixtureWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let beforeDamage = battle.state.sides[0].active[0]?.combatant.creature.status.damage ?? 0;
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);
	let healedEvent = events.find(
		(event) => event.type === "damage-dealt" && event.target.side === 0 && event.damage === 0,
	);
	let afterDamage = battle.state.sides[0].active[0]?.combatant.creature.status.damage ?? 0;

	expect(events.some((event) => event.type === "damage-dealt" && event.target.side === 1)).toBe(
		true,
	);
	expect(healedEvent).toBeDefined();
	expect(afterDamage).toBeLessThan(beforeDamage);
});

test("accuracy drops can cause a move to miss", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithSandAttack()]] },
			{ teams: [[createModestSecondaryFixtureWithTackle()]] },
		],
		random: createRandomSequence(1, 0.9),
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let secondTurnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(secondTurnEvents).toContainEqual({
		type: "move-missed",
		user: { side: 1, slot: 0 },
		target: { side: 0, slot: 0 },
	});
});

/**
 * Regression: the neutral-stage shortcut in `moveCanConnect` let sub-100
 * accuracy moves hit automatically at neutral stat stages, skipping the
 * base-accuracy roll. The roll must run and can fail at neutral stages.
 */
test("a sub-100 accuracy move can miss at neutral stages when the accuracy roll fails", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithBlizzard()]] },
			{ teams: [[createModestSecondaryFixture()]] },
		],
		/** A high roll fails the 70% base-accuracy check (0.99 < 0.7 is false). */
		random: () => 0.99,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "move-missed",
		user: { side: 0, slot: 0 },
		target: { side: 1, slot: 0 },
	});
	expect(
		events.some(
			(event) =>
				event.type === "damage-dealt" && event.target.side === 1 && event.target.slot === 0,
		),
	).toBe(false);
});

/**
 * Companion to the regression above: a low roll clears the base-accuracy
 * check, so the same move connects and deals damage.
 */
test("a sub-100 accuracy move connects at neutral stages when the accuracy roll succeeds", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithBlizzard()]] },
			{ teams: [[createModestSecondaryFixture()]] },
		],
		/** A low roll passes the 70% base-accuracy check (0 < 0.7 is true). */
		random: () => 0,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	expect(
		events.some(
			(event) => event.type === "move-missed" && event.user.side === 0 && event.user.slot === 0,
		),
	).toBe(false);
	expect(
		events.some(
			(event) =>
				event.type === "damage-dealt" && event.target.side === 1 && event.target.slot === 0,
		),
	).toBe(true);
});

/**
 * Regression: `getCombatantSpeed` applied a non-spec +10% boost under
 * electric terrain (`Math.floor(speed * 1.1)`). Terrain leaves effective
 * speed unchanged.
 */
test("electric terrain does not boost a combatant's effective speed", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithElectricTerrain()]] },
			{ teams: [[createModestSecondaryFixture()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");

	let combatant = battle.state.sides[0].active[0]?.combatant;
	if (!combatant) throw new TypeError("Expected an active combatant.");
	let position: BattlePosition = { side: 0, slot: 0 };
	let readSpeed = (
		battle as unknown as {
			getCombatantSpeed(position: BattlePosition, combatant: CombatantState): number;
		}
	).getCombatantSpeed.bind(battle);

	expect(battle.state.field.terrain).toBe(null);
	let speedWithoutTerrain = readSpeed(position, combatant);

	/** Slot 0 casts Electric Terrain (move 0), setting the shared terrain to electric. */
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);

	expect(battle.state.field.terrain).toBe("electric");
	let speedUnderTerrain = readSpeed(position, combatant);

	expect(speedUnderTerrain).toBe(speedWithoutTerrain);
});

test("Glare applies guaranteed paralysis", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithGlare()]] },
			{ teams: [[createModestSecondaryFixtureWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "status-applied",
		target: { side: 1, slot: 0 },
		status: State.Paralyzed,
	});
});

test("Glare does not paralyze Electric-type targets", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithGlare()]] },
			{ teams: [[createModestSecondaryFixtureWithTackle(ELECTRIC_SPECIES_ID)]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events.some((event) => event.type === "status-applied" && event.target.side === 1)).toBe(
		false,
	);
	expect(battle.state.sides[1].active[0]?.combatant.creature.status.state).toBe(null);
});

test("Dragon Breath can apply paralysis after dealing damage", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithDragonBreath()]] },
			{ teams: [[createModestSecondaryFixtureWithTackle()]] },
		],
		random: () => 0,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events.some((event) => event.type === "damage-dealt" && event.target.side === 1)).toBe(
		true,
	);
	expect(events).toContainEqual({
		type: "status-applied",
		target: { side: 1, slot: 0 },
		status: State.Paralyzed,
	});
});

test("Metal Sound sharply lowers the target special defense", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithMetalSound()]] },
			{ teams: [[createModestSecondaryFixtureWithTackle()]] },
		],
		/** 0.84 passes Metal Sound's 85% accuracy so the special-defense drop applies. */
		random: () => 0.84,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "stat-stage-changed",
		target: { side: 1, slot: 0 },
		stat: Stat.SpecialDefense,
		stages: -2,
		value: -2,
	});
});

test("Mud-Slap lowers the target accuracy after dealing damage", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithMudSlap()]] },
			{ teams: [[createModestSecondaryFixtureWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events.some((event) => event.type === "damage-dealt" && event.target.side === 1)).toBe(
		true,
	);
	expect(events).toContainEqual({
		type: "stat-stage-changed",
		target: { side: 1, slot: 0 },
		stat: "accuracy",
		stages: -1,
		value: -1,
	});
});

test("Icy Wind deals damage and lowers the target speed", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithIcyWind()]] },
			{ teams: [[createModestSecondaryFixtureWithTackle()]] },
		],
		/** 0.94 passes Icy Wind's 95% accuracy while keeping damage maximal. */
		random: () => 0.94,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events.some((event) => event.type === "damage-dealt" && event.target.side === 1)).toBe(
		true,
	);
	expect(events).toContainEqual({
		type: "stat-stage-changed",
		target: { side: 1, slot: 0 },
		stat: Stat.Speed,
		stages: -1,
		value: -1,
	});
	expect(battle.state.sides[1].active[0]?.combatant.statStages[Stat.Speed]).toBe(-1);
});

test("Leaf Storm lowers the user's special attack after hitting", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithLeafStorm()]] },
			{ teams: [[createModestSecondaryFixtureWithTackle()]] },
		],
		/** 0.89 passes Leaf Storm's 90% accuracy while keeping damage maximal. */
		random: () => 0.89,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events.some((event) => event.type === "damage-dealt" && event.target.side === 1)).toBe(
		true,
	);
	expect(events).toContainEqual({
		type: "stat-stage-changed",
		target: { side: 0, slot: 0 },
		stat: Stat.SpecialAttack,
		stages: -2,
		value: -2,
	});
	expect(battle.state.sides[0].active[0]?.combatant.statStages[Stat.SpecialAttack]).toBe(-2);
});

test("Close Combat lowers the user's defenses after hitting", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithCloseCombat()]] },
			{ teams: [[createModestSecondaryFixtureWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "stat-stage-changed",
		target: { side: 0, slot: 0 },
		stat: Stat.Defense,
		stages: -1,
		value: -1,
	});
	expect(events).toContainEqual({
		type: "stat-stage-changed",
		target: { side: 0, slot: 0 },
		stat: Stat.SpecialDefense,
		stages: -1,
		value: -1,
	});
	expect(battle.state.sides[0].active[0]?.combatant.statStages[Stat.Defense]).toBe(-1);
	expect(battle.state.sides[0].active[0]?.combatant.statStages[Stat.SpecialDefense]).toBe(-1);
});

test("Self-Destruct knocks out the user after dealing damage", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithSelfDestruct()]] },
			{ teams: [[createModestSecondaryFixtureWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events.some((event) => event.type === "damage-dealt" && event.target.side === 1)).toBe(
		true,
	);
	expect(events).toContainEqual({ type: "creature-fainted", target: { side: 0, slot: 0 } });
	expect(battle.state.sides[0].active[0]).toBe(null);
});

test("Final Gambit deals damage equal to the user's HP and knocks out the user", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithFinalGambit()]] },
			{ teams: [[createModestSecondaryFixtureWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let activeTarget = battle.state.sides[1].active[0]?.combatant.creature;
	if (!activeTarget) throw new TypeError("Expected active Final Gambit target.");
	let expectedDamage = getCreatureCurrentHP(GAME_DATA, activeTarget);
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);
	let damageEvent = events.find(
		(event) => event.type === "damage-dealt" && event.target.side === 1,
	);

	if (!damageEvent || damageEvent.type !== "damage-dealt") {
		throw new TypeError("Expected Final Gambit damage event.");
	}

	expect(damageEvent.damage).toBe(expectedDamage);
	expect(events).toContainEqual({ type: "creature-fainted", target: { side: 0, slot: 0 } });
});

test("Thrash locks the user into repeated attacks and causes confusion after it ends", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createPrimaryFixtureWithThrash()]] },
			{ teams: [[createModestSecondaryFixtureWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let firstRequest = readEvent(session.next());
	if (firstRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	let secondTurnStarted = readEvent(session.next());
	expect(secondTurnStarted).toEqual({ type: "turn-started", turn: 2 });
	let secondRequest = readEvent(session.next());
	if (secondRequest.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let secondTurnEvents = collectTurnEvents(session, battle, [
		{ type: "fight", move: 1, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(secondTurnEvents).toContainEqual({
		type: "move-used",
		user: { side: 0, slot: 0 },
		moveId: "THRASH",
		target: { side: 1, slot: 0 },
	});
	expect(battle.state.sides[0].active[0]?.combatant.volatile.rampageTurns).toBe(0);
	expect(battle.state.sides[0].active[0]?.combatant.volatile.confusionTurns).toBe(2);
});

test("a stale single-target action emits an explicit invalid-target failure", () => {
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[createSlowPrimaryFixtureWithSwift()]] },
			{ teams: [[createFastSecondaryFixtureWithSelfDestruct()]] },
		],
		random: () => 1,
	});
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	expect(events).toContainEqual({
		type: "move-failed",
		user: { side: 0, slot: 0 },
		reason: "invalid-target",
	});
	expect(events.some((event) => event.type === "move-used" && event.user.side === 0)).toBe(false);
	if (battle.state.sides[0].active[0]?.combatant === null) {
		throw new TypeError("Expected active combatant.");
	}
	expect(battle.state.sides[0].active[0]?.combatant.volatile.lastMoveSlot).toBeNull();
});

test("an invalid team count for the battle format throws", () => {
	expect(
		() =>
			new Battle({
				gameData: GAME_DATA,
				slots: 3,
				sides: [
					{ teams: [[createPrimaryFixture()], [createBackupPrimaryFixture()]] },
					{ teams: [[createModestSecondaryFixture()]] },
				],
			}),
	).toThrow("must provide either 1 team or 3 teams");
});

test("using a heal item restores HP, emits an item-used event, and spends the turn", () => {
	let ally = createPrimaryFixture();
	/** Take damage so a heal has room to work. */
	let maxHP = getCreatureStat(GAME_DATA, ally, Stat.HP);
	ally.status.damage = maxHP - 1;

	/** A non-damaging enemy move so the heal is observable at the end of the turn. */
	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [{ teams: [[ally]] }, { teams: [[createModestSecondaryFixtureWithGrowl()]] }],
		random: () => 1,
	});
	let session = battle.start();
	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");

	let events = collectTurnEvents(session, battle, [
		{ type: "use-item", itemId: "POTION", effect: { kind: "heal-hp", amount: 20 }, creature: 0 },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	let used = events.find((event) => event.type === "item-used");
	if (used?.type !== "item-used") throw new TypeError("Expected an item-used event.");
	expect(used.itemId).toBe("POTION");
	expect(used.healed).toBe(20);
	expect(used.remainingHP).toBe(21);
	expect(getCreatureCurrentHP(GAME_DATA, ally)).toBe(21);
	/** The item resolves before the enemy's move, and the enemy still acts this turn. */
	let usedIndex = events.findIndex((event) => event.type === "item-used");
	let enemyMoveIndex = events.findIndex(
		(event) => event.type === "move-used" && event.user.side === 1,
	);
	expect(enemyMoveIndex).toBeGreaterThan(usedIndex);
});

test("using a status-cure item clears the status without healing HP", () => {
	let ally = createPrimaryFixture();
	ally.status.state = State.Poisoned;

	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [{ teams: [[ally]] }, { teams: [[createModestSecondaryFixtureWithTackle()]] }],
		random: () => 1,
	});
	let session = battle.start();
	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");

	let events = collectTurnEvents(session, battle, [
		{
			type: "use-item",
			itemId: "ANTIDOTE",
			effect: { kind: "cure-status", status: [State.Poisoned] },
			creature: 0,
		},
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	let used = events.find((event) => event.type === "item-used");
	if (used?.type !== "item-used") throw new TypeError("Expected an item-used event.");
	expect(used.status).toBeNull();
	expect(used.healed).toBe(0);
	expect(ally.status.state).toBeNull();
});

test("using a revive item on a fainted bench creature restores it to half HP", () => {
	let active = createPrimaryFixture();
	let benched = createBackupPrimaryFixture();
	let benchedMaxHP = getCreatureStat(GAME_DATA, benched, Stat.HP);
	benched.status.damage = benchedMaxHP;

	let battle = new Battle({
		gameData: GAME_DATA,
		sides: [
			{ teams: [[active, benched]] },
			{ teams: [[createModestSecondaryFixtureWithTackle()]] },
		],
		random: () => 1,
	});
	let session = battle.start();
	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");

	let events = collectTurnEvents(session, battle, [
		{ type: "use-item", itemId: "REVIVE", effect: { kind: "revive", amount: "half" }, creature: 1 },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);

	let used = events.find((event) => event.type === "item-used");
	if (used?.type !== "item-used") throw new TypeError("Expected an item-used event.");
	expect(used.revived).toBe(true);
	expect(used.creature).toBe(1);
	expect(getCreatureCurrentHP(GAME_DATA, benched)).toBe(Math.max(1, Math.ceil(benchedMaxHP / 2)));
});

function createPrimaryFixture() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["VINE_WHIP", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["VINE_WHIP", "RAZOR_LEAF", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithGrowl() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["GROWL", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["GROWL", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithTailwind() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["TAILWIND", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["TAILWIND", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithAgility() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["AGILITY", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["AGILITY", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithBulkUp() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["BULK_UP", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["BULK_UP", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithBabyDollEyes() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		moveset: ["BABY_DOLL_EYES", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["BABY_DOLL_EYES", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithReflect() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["REFLECT", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["REFLECT", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithBrickBreak() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		moveset: ["BRICK_BREAK", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["BRICK_BREAK", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithHaze() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["HAZE", "GROWL", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["HAZE", "GROWL", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithClearSmog() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["CLEAR_SMOG", "GROWL", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["CLEAR_SMOG", "GROWL", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithTrickRoom() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["TRICK_ROOM", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["TRICK_ROOM", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithRainDance() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["RAIN_DANCE", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["RAIN_DANCE", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithSafeguard() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["SAFEGUARD", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["SAFEGUARD", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithMist() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["MIST", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["MIST", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithGrassyTerrain() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["GRASSY_TERRAIN", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["GRASSY_TERRAIN", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithElectricTerrain() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["ELECTRIC_TERRAIN", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["ELECTRIC_TERRAIN", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithMistyTerrain() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["MISTY_TERRAIN", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["MISTY_TERRAIN", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createDamagedPrimaryFixtureWithGrassyTerrain() {
	let creature = createPrimaryFixtureWithGrassyTerrain();
	creature.status.damage = 16;
	return creature;
}

function createPrimaryFixtureWithGravity() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["GRAVITY", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["GRAVITY", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithSandstorm() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["SANDSTORM", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["SANDSTORM", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithSpikes() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["SPIKES", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["SPIKES", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithToxic() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["TOXIC", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["TOXIC", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithToxicSpikes() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["TOXIC_SPIKES", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["TOXIC_SPIKES", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithDefog() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["DEFOG", "SPIKES", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["DEFOG", "SPIKES", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithProtect() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["PROTECT", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["PROTECT", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithDetect() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["DETECT", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["DETECT", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithFakeOut() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		moveset: ["FAKE_OUT", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["FAKE_OUT", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithFeint() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		moveset: ["FEINT", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["FEINT", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithConfuseRay() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["CONFUSE_RAY", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["CONFUSE_RAY", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithTackle() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["TACKLE", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["TACKLE", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithFly() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["FLY", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["FLY", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithSwift() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["SWIFT", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["SWIFT", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createSlowPrimaryFixtureWithSwift() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		moveset: ["SWIFT", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["SWIFT", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithBlizzard() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["BLIZZARD", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["BLIZZARD", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithLightScreen() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["LIGHT_SCREEN", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["LIGHT_SCREEN", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithEmber() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["EMBER", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["EMBER", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithBrine() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["BRINE", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["BRINE", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithAssurance() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		moveset: ["ASSURANCE", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["ASSURANCE", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithCounter() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		moveset: ["COUNTER", "GROWTH", "LEECH_SEED", "TACKLE"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["COUNTER", "GROWTH", "LEECH_SEED", "TACKLE"]),
	});
}

function createPrimaryFixtureWithDragonTail() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		moveset: ["DRAGON_TAIL", "GROWTH", "LEECH_SEED", "TACKLE"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["DRAGON_TAIL", "GROWTH", "LEECH_SEED", "TACKLE"]),
	});
}

function createPrimaryFixtureWithFollowMe() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["FOLLOW_ME", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["FOLLOW_ME", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithRoar() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["ROAR", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["ROAR", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithBatonPass() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["BATON_PASS", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["BATON_PASS", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithFutureSight() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["FUTURE_SIGHT", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["FUTURE_SIGHT", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithCharge() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["CHARGE", "CHARGE_BEAM", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["CHARGE", "CHARGE_BEAM", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithChargeBeam() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["CHARGE_BEAM", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["CHARGE_BEAM", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithFocusEnergy() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["FOCUS_ENERGY", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["FOCUS_ENERGY", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithRazorLeaf() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["RAZOR_LEAF", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["RAZOR_LEAF", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithAquaRing() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["AQUA_RING", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["AQUA_RING", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithHealingWish() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["HEALING_WISH", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["HEALING_WISH", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithCurse() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		moveset: ["CURSE", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["CURSE", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithDestinyBond() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["DESTINY_BOND", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["DESTINY_BOND", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithFellStinger() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		moveset: ["FELL_STINGER", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["FELL_STINGER", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithFocusPunch() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		moveset: ["FOCUS_PUNCH", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["FOCUS_PUNCH", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithHex() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["HEX", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["HEX", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createBravePrimaryFixtureWithElectroBall() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		moveset: ["ELECTRO_BALL", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["ELECTRO_BALL", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createFastPrimaryFixtureWithElectroBall() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["ELECTRO_BALL", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 255,
		},
		status: createStatus(["ELECTRO_BALL", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createBravePrimaryFixtureWithGyroBall() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		moveset: ["GYRO_BALL", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["GYRO_BALL", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createFastPrimaryFixtureWithGyroBall() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["GYRO_BALL", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 255,
		},
		status: createStatus(["GYRO_BALL", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithFlail() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		moveset: ["FLAIL", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["FLAIL", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithEndeavor() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		moveset: ["ENDEAVOR", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["ENDEAVOR", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createHeavyFixtureWithHeavySlam() {
	return new Creature({
		nickname: "Heavy Anchor",
		species: HEAVY_SPECIES_ID,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		size: { scale: 128, weight: 128 },
		moveset: ["HEAVY_SLAM", "TACKLE", "REST", "SNORE"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["HEAVY_SLAM", "TACKLE", "REST", "SNORE"]),
	});
}

function createPrimaryFixtureWithDragonRage() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["DRAGON_RAGE", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["DRAGON_RAGE", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithTakeDown() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["TAKE_DOWN", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["TAKE_DOWN", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithHyperBeam() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["HYPER_BEAM", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["HYPER_BEAM", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithTaunt() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["TAUNT", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["TAUNT", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithDisable() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["DISABLE", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["DISABLE", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithIdentify() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["IDENTIFY", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["IDENTIFY", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithAttract() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["ATTRACT", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["ATTRACT", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithWrap() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["WRAP", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["WRAP", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithDoubleSlap() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["DOUBLE_SLAP", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["DOUBLE_SLAP", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithSleepPowder() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["SLEEP_POWDER", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["SLEEP_POWDER", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithHypnosis() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["HYPNOSIS", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["HYPNOSIS", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithAbsorb() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["ABSORB", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["ABSORB", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createDamagedPrimaryFixtureWithAbsorb() {
	let creature = createPrimaryFixtureWithAbsorb();
	creature.status.damage = 16;
	return creature;
}

function createPrimaryFixtureWithDreamEater() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["DREAM_EATER", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["DREAM_EATER", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createDamagedPrimaryFixtureWithDreamEater() {
	let creature = createPrimaryFixtureWithDreamEater();
	creature.status.damage = 16;
	return creature;
}

function createPrimaryFixtureWithIcyWind() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["ICY_WIND", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["ICY_WIND", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithLeafStorm() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["LEAF_STORM", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["LEAF_STORM", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithCloseCombat() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		moveset: ["CLOSE_COMBAT", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["CLOSE_COMBAT", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithSelfDestruct() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		moveset: ["SELF_DESTRUCT", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["SELF_DESTRUCT", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithFinalGambit() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["FINAL_GAMBIT", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["FINAL_GAMBIT", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithThrash() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		moveset: ["THRASH", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["THRASH", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithGlare() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["GLARE", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["GLARE", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithDragonBreath() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["DRAGON_BREATH", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["DRAGON_BREATH", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithMetalSound() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["METAL_SOUND", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["METAL_SOUND", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithMudSlap() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["MUD_SLAP", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["MUD_SLAP", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithSandAttack() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["SAND_ATTACK", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["SAND_ATTACK", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithEndure() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["ENDURE", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["ENDURE", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithFalseSwipe() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		moveset: ["FALSE_SWIPE", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["FALSE_SWIPE", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithBellyDrum() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		moveset: ["BELLY_DRUM", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["BELLY_DRUM", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createPrimaryFixtureWithJumpKick() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		moveset: ["JUMP_KICK", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["JUMP_KICK", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createLowHpPrimaryFixture() {
	let creature = createPrimaryFixture();
	creature.status.damage = getCreatureCurrentHP(GAME_DATA, creature) - 1;
	return creature;
}

function createLowHpPrimaryFixtureWithFlail() {
	let creature = createPrimaryFixtureWithFlail();
	creature.status.damage = getCreatureCurrentHP(GAME_DATA, creature) - 1;
	return creature;
}

function createLowHpPrimaryFixtureWithEndeavor() {
	let creature = createPrimaryFixtureWithEndeavor();
	creature.status.damage = getCreatureCurrentHP(GAME_DATA, creature) - 1;
	return creature;
}

function createLowHpPrimaryFixtureWithDestinyBond() {
	let creature = createPrimaryFixtureWithDestinyBond();
	creature.status.damage = getCreatureCurrentHP(GAME_DATA, creature) - 1;
	return creature;
}

function createDamagedPrimaryFixtureWithAquaRing() {
	let creature = createPrimaryFixtureWithAquaRing();
	creature.status.damage = 20;
	return creature;
}

function createLowHpPrimaryFixtureWithEndure() {
	let creature = createPrimaryFixtureWithEndure();
	creature.status.damage = getCreatureCurrentHP(GAME_DATA, creature) - 1;
	return creature;
}

function createHalfHpPrimaryFixtureWithBellyDrum() {
	let creature = createPrimaryFixtureWithBellyDrum();
	let maxHP = getCreatureCurrentHP(GAME_DATA, creature);
	creature.status.damage = Math.ceil(maxHP / 2);
	return creature;
}

function createLowHpSecondaryFixtureWithTackle() {
	let creature = createModestSecondaryFixtureWithTackle();
	creature.status.damage = getCreatureCurrentHP(GAME_DATA, creature) - 1;
	return creature;
}

function createBelowHalfHpSecondaryFixtureWithTackle() {
	let creature = createModestSecondaryFixtureWithTackle();
	let maxHP = getCreatureCurrentHP(GAME_DATA, creature);
	creature.status.damage = Math.floor(maxHP / 2) + 10;
	return creature;
}

function createParalyzedSecondaryFixtureWithTackle() {
	let creature = createModestSecondaryFixtureWithTackle();
	creature.status.state = State.Paralyzed;
	return creature;
}

function createBackupPrimaryFixture() {
	return new Creature({
		nickname: "Reserve Beta",
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["TACKLE", "VINE_WHIP", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 0,
			[Stat.Attack]: 0,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["TACKLE", "VINE_WHIP", "GROWTH", "LEECH_SEED"]),
	});
}

function createDamagedParalyzedBackupPrimaryFixture() {
	let creature = createBackupPrimaryFixture();
	creature.status.damage = 20;
	creature.status.state = State.Paralyzed;
	return creature;
}

function createBackupSecondaryFixture(speciesId = SECONDARY_SPECIES_ID) {
	return new Creature({
		species: speciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["TACKLE", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 0,
			[Stat.Attack]: 0,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["TACKLE", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createModestSecondaryFixture() {
	return new Creature({
		species: SECONDARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["VINE_WHIP", "RAZOR_LEAF", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 0,
			[Stat.Attack]: 0,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["VINE_WHIP", "RAZOR_LEAF", "GROWTH", "LEECH_SEED"]),
	});
}

function createModestSecondaryFixtureWithTackle(speciesId = SECONDARY_SPECIES_ID) {
	return new Creature({
		species: speciesId,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["TACKLE", "RAZOR_LEAF", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 0,
			[Stat.Attack]: 0,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["TACKLE", "RAZOR_LEAF", "GROWTH", "LEECH_SEED"]),
	});
}

function createSlowSecondaryFixtureWithTackle() {
	return new Creature({
		species: SECONDARY_SPECIES_ID,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		moveset: ["TACKLE", "RAZOR_LEAF", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 0,
			[Stat.Attack]: 0,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["TACKLE", "RAZOR_LEAF", "GROWTH", "LEECH_SEED"]),
	});
}

function createFastSecondaryFixtureWithTackle() {
	return new Creature({
		species: SECONDARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["TACKLE", "RAZOR_LEAF", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 0,
			[Stat.Attack]: 0,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 255,
		},
		status: createStatus(["TACKLE", "RAZOR_LEAF", "GROWTH", "LEECH_SEED"]),
	});
}

function createFastPlayerFixtureWithTackle() {
	return new Creature({
		species: PRIMARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["TACKLE", "RAZOR_LEAF", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 0,
			[Stat.Attack]: 0,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 255,
		},
		status: createStatus(["TACKLE", "RAZOR_LEAF", "GROWTH", "LEECH_SEED"]),
	});
}

function createSlowPlayerFixtureWithTackle() {
	return new Creature({
		species: PRIMARY_SPECIES_ID,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		moveset: ["TACKLE", "RAZOR_LEAF", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 0,
			[Stat.Attack]: 0,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["TACKLE", "RAZOR_LEAF", "GROWTH", "LEECH_SEED"]),
	});
}

function createFastSecondaryFixtureWithFly() {
	return new Creature({
		species: SECONDARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["FLY", "RAZOR_LEAF", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 0,
			[Stat.Attack]: 0,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 255,
		},
		status: createStatus(["FLY", "RAZOR_LEAF", "GROWTH", "LEECH_SEED"]),
	});
}

function createFastSecondaryFixtureWithSelfDestruct() {
	return new Creature({
		species: SECONDARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["SELF_DESTRUCT", "RAZOR_LEAF", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 0,
			[Stat.Attack]: 0,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 255,
		},
		status: createStatus(["SELF_DESTRUCT", "RAZOR_LEAF", "GROWTH", "LEECH_SEED"]),
	});
}

function createLightFixtureWithTackle() {
	return new Creature({
		species: LIGHT_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["TACKLE", "POUND", "REST", "SING"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 0,
			[Stat.Attack]: 0,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["TACKLE", "POUND", "REST", "SING"]),
	});
}

function createModestSecondaryFixtureWithDetect() {
	return new Creature({
		species: SECONDARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["DETECT", "RAZOR_LEAF", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 0,
			[Stat.Attack]: 0,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["DETECT", "RAZOR_LEAF", "GROWTH", "LEECH_SEED"]),
	});
}

function createModestSecondaryFixtureWithEmber() {
	return new Creature({
		species: SECONDARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["EMBER", "RAZOR_LEAF", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 0,
			[Stat.Attack]: 0,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["EMBER", "RAZOR_LEAF", "GROWTH", "LEECH_SEED"]),
	});
}

function createModestSecondaryFixtureWithEncore() {
	return new Creature({
		species: SECONDARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["ENCORE", "EMBER", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 0,
			[Stat.Attack]: 0,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["ENCORE", "EMBER", "GROWTH", "LEECH_SEED"]),
	});
}

function createModestSecondaryFixtureWithGrowl() {
	return new Creature({
		species: SECONDARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["GROWL", "RAZOR_LEAF", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 0,
			[Stat.Attack]: 0,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["GROWL", "RAZOR_LEAF", "GROWTH", "LEECH_SEED"]),
	});
}

function createModestSecondaryFixtureWithReflect() {
	return new Creature({
		species: SECONDARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["REFLECT", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 0,
			[Stat.Attack]: 0,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["REFLECT", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createModestSecondaryFixtureWithSpikes() {
	return new Creature({
		species: SECONDARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["SPIKES", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 0,
			[Stat.Attack]: 0,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["SPIKES", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createModestSecondaryFixtureWithToxicSpikes() {
	return new Creature({
		species: SECONDARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["TOXIC_SPIKES", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 0,
			[Stat.Attack]: 0,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["TOXIC_SPIKES", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createModestSecondaryFixtureWithSandAttack() {
	return new Creature({
		species: SECONDARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["SAND_ATTACK", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 0,
			[Stat.Attack]: 0,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["SAND_ATTACK", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createModestSecondaryFixtureWithSleepPowder() {
	return new Creature({
		species: SECONDARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["SLEEP_POWDER", "RAZOR_LEAF", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 0,
			[Stat.Attack]: 0,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["SLEEP_POWDER", "RAZOR_LEAF", "GROWTH", "LEECH_SEED"]),
	});
}

function createSleepingSecondaryFixtureWithTackle() {
	let creature = createModestSecondaryFixtureWithTackle();
	creature.status.state = State.Asleep;
	return creature;
}

function createSecondaryFixtureWithMeanLook() {
	return new Creature({
		species: SECONDARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["MEAN_LOOK", "RAZOR_LEAF", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 0,
			[Stat.Attack]: 0,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["MEAN_LOOK", "RAZOR_LEAF", "GROWTH", "LEECH_SEED"]),
	});
}

function createBravePrimaryFixtureWithQuickAttack() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		moveset: ["QUICK_ATTACK", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["QUICK_ATTACK", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createBravePrimaryFixtureWithExtremeSpeed() {
	return new Creature({
		nickname: "Reserve Alpha",
		species: PRIMARY_SPECIES_ID,
		nature: "BRAVE" as NatureId,
		experience: 1000000,
		moveset: ["EXTREME_SPEED", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 255,
			[Stat.Attack]: 255,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["EXTREME_SPEED", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createModestSecondaryFixtureWithQuickAttack() {
	return new Creature({
		species: SECONDARY_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["QUICK_ATTACK", "TACKLE", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 0,
			[Stat.Attack]: 0,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["QUICK_ATTACK", "TACKLE", "GROWTH", "LEECH_SEED"]),
	});
}

function createSpectralFixtureWithTackle() {
	return new Creature({
		species: SPECTRAL_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["TACKLE", "CONFUSE_RAY", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 0,
			[Stat.Attack]: 0,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["TACKLE", "CONFUSE_RAY", "GROWTH", "LEECH_SEED"]),
	});
}

function createSpectralFixtureWithCurse() {
	return new Creature({
		species: SPECTRAL_SPECIES_ID,
		nature: "MODEST" as NatureId,
		experience: 1000000,
		moveset: ["CURSE", "CONFUSE_RAY", "GROWTH", "LEECH_SEED"],
		iv: createPerfectStats(),
		ev: {
			[Stat.HP]: 0,
			[Stat.Attack]: 0,
			[Stat.Defense]: 0,
			[Stat.SpecialAttack]: 0,
			[Stat.SpecialDefense]: 0,
			[Stat.Speed]: 0,
		},
		status: createStatus(["CURSE", "CONFUSE_RAY", "GROWTH", "LEECH_SEED"]),
	});
}

function createPerfectStats() {
	return {
		[Stat.HP]: 31,
		[Stat.Attack]: 31,
		[Stat.Defense]: 31,
		[Stat.SpecialAttack]: 31,
		[Stat.SpecialDefense]: 31,
		[Stat.Speed]: 31,
	};
}

function createStatus(moveset: [string, string, string, string]) {
	return {
		state: null,
		damage: 0,
		pp: getMovePP(
			moveset[0] as keyof typeof MOVES,
			moveset[1] as keyof typeof MOVES,
			moveset[2] as keyof typeof MOVES,
			moveset[3] as keyof typeof MOVES,
		),
	};
}

function getMovePP(
	move1: keyof typeof MOVES,
	move2: keyof typeof MOVES,
	move3: keyof typeof MOVES,
	move4: keyof typeof MOVES,
) {
	return [MOVES[move1].pp, MOVES[move2].pp, MOVES[move3].pp, MOVES[move4].pp] as [
		number,
		number,
		number,
		number,
	];
}

function readEvent(result: IteratorResult<BattleEvent, BattleEvent>) {
	if (result.done) return result.value;
	return result.value;
}

function collectTurnEvents(
	session: Generator<BattleEvent, BattleEvent, any>,
	battle: Battle,
	commands: Array<any>,
) {
	let events: BattleEvent[] = [];
	events.push(readEvent(session.next(commands)));

	while (true) {
		let result = session.next();
		let event = readEvent(result);
		events.push(event);
		if (event.type === "turn-ended") break;
		if (result.done || battle.state.phase !== "resolving-turn") break;
	}

	return events;
}

function getOpeningDamage(sides: ConstructorParameters<typeof Battle>[0]["sides"]) {
	let battle = new Battle({ gameData: GAME_DATA, sides, random: () => 1 });
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 2, target: { side: 0, slot: 0 } },
	]);
	let damage = events.find((event) => event.type === "damage-dealt" && event.target.side === 1);
	if (!damage || damage.type !== "damage-dealt")
		throw new TypeError("Expected opening damage event.");
	return damage.damage;
}

function getFirstDamageDealt(
	sides: ConstructorParameters<typeof Battle>[0]["sides"],
	random: () => number = () => 1,
) {
	let battle = new Battle({ gameData: GAME_DATA, sides, random });
	let session = battle.start();

	readEvent(session.next());
	readEvent(session.next());
	let request = readEvent(session.next());
	if (request.type !== "request-turn-commands") throw new TypeError("Expected turn request.");
	let events = collectTurnEvents(session, battle, [
		{ type: "fight", move: 0, target: { side: 1, slot: 0 } },
		{ type: "fight", move: 0, target: { side: 0, slot: 0 } },
	]);
	let damage = events.find((event) => event.type === "damage-dealt" && event.target.side === 1);
	if (!damage || damage.type !== "damage-dealt") {
		throw new TypeError("Expected first damage event.");
	}

	return damage.damage;
}

function createRandomSequence(...values: number[]) {
	let index = 0;
	return () => {
		let value = values[index] ?? values.at(-1) ?? 0;
		index += 1;
		return value;
	};
}

function getSpeciesId(
	predicate: (species: (typeof SPECIES)[keyof typeof SPECIES]) => boolean,
): SpeciesId {
	for (let [speciesId, species] of Object.entries(SPECIES)) {
		if (predicate(species)) return speciesId as SpeciesId;
	}

	throw new ReferenceError("Expected a species fixture matching the requested predicate.");
}
