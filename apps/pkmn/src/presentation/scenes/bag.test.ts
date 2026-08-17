/**
 * Tests for the bag's pure item classification and teach helpers.
 *
 * Covers `bagItemAction`, which decides how a confirmed bag item is used on a
 * creature: evolution items open the stone flow, recovery medicines open the
 * medicine flow, move-teaching machines open the teach flow, and everything else
 * (held items, capture balls, PP/EV items, an unknown record) stays browse-only.
 * Also covers `movesetFromSummary`, which rebuilds the four-slot moveset the teach
 * flow feeds the replace prompt, and `machineConsumedOnTeach`, which decides
 * whether a taught machine is spent. The scene wiring and canvas drawing are not
 * exercised here; only the pure routing and teach rules are asserted.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "vitest";

import type { Item } from "~/game/data/item";
import type { CreatureSummaryView } from "~/game/selectors";

import { ITEMS } from "~/content/items";
import { TYPE_MATCHUPS } from "~/content/matchups";
import { MOVES } from "~/content/moves";
import { NATURES } from "~/content/natures";
import { SPECIES } from "~/content/species";
import { ItemAttribute } from "~/game/data/item";
import { Engine } from "~/game/engine";
import { createCreatureId, createPlayerId } from "~/game/world/ids";
import { migrateWorld } from "~/game/world/migrate";

import { bagItemAction, machineConsumedOnTeach, movesetFromSummary } from "./bag";

/** Builds a minimal item with the given category and optional effect payload. */
function item(category: string, effect?: object): Item {
	return { category, attributes: [ItemAttribute.Countable], ...(effect ? { effect } : {}) } as Item;
}

/** Builds a machine item that teaches the given move, optionally single-use. */
function machine(teachesMoveId: string, consumable = false): Item {
	return {
		category: "all-machines",
		attributes: consumable
			? [ItemAttribute.Countable, ItemAttribute.Consumable]
			: [ItemAttribute.Countable],
		teachesMoveId,
	} as Item;
}

/** Builds a creature summary carrying only the move rows the teach flow reads. */
function creatureWithMoves(ids: Array<string | null>): CreatureSummaryView {
	return {
		moves: ids.map((id) => ({ id, pp: id ? 10 : 0 })),
	} as CreatureSummaryView;
}

test("bagItemAction routes an evolution item to the stone flow", () => {
	expect(bagItemAction(item("evolution"))).toBe("evolution");
});

test("bagItemAction routes a recovery medicine to the medicine flow", () => {
	expect(bagItemAction(item("medicine", { kind: "heal-hp", amount: 20 }))).toBe("medicine");
	expect(bagItemAction(item("medicine", { kind: "revive", amount: "full" }))).toBe("medicine");
	expect(bagItemAction(item("medicine", { kind: "cure-status", status: "any" }))).toBe("medicine");
});

test("bagItemAction leaves non-recovery medicine (PP/EV) browse-only", () => {
	expect(
		bagItemAction(item("medicine", { kind: "restore-pp", amount: 10, target: "one-move" })),
	).toBeNull();
	expect(bagItemAction(item("medicine", { kind: "pp-boost", amount: 1 }))).toBeNull();
});

test("bagItemAction leaves held items and plain items browse-only", () => {
	expect(bagItemAction(item("held-items"))).toBeNull();
	expect(bagItemAction(item("misc"))).toBeNull();
});

test("bagItemAction treats a capture ball (no recovery effect) as browse-only", () => {
	expect(bagItemAction(item("balls", { multiplier: 1.5 }))).toBeNull();
});

test("bagItemAction returns null for an unknown (missing) item", () => {
	expect(bagItemAction(undefined)).toBeNull();
});

test("bagItemAction routes a move-teaching machine to the teach flow", () => {
	// Regression: machines used to classify as null, so selecting one did nothing.
	expect(bagItemAction(machine("CUT"))).toBe("teach");
	expect(bagItemAction(machine("SURF", true))).toBe("teach");
});

test("movesetFromSummary rebuilds the four-slot tuple, padding empty slots with null", () => {
	expect(movesetFromSummary(creatureWithMoves(["TACKLE", "GROWL"]))).toEqual([
		"TACKLE",
		"GROWL",
		null,
		null,
	]);
	expect(movesetFromSummary(creatureWithMoves(["A", "B", "C", "D"]))).toEqual(["A", "B", "C", "D"]);
});

test("machineConsumedOnTeach spends a single-use machine but not a reusable one", () => {
	// A TM-style machine is marked Consumable; an HM-style machine omits the flag.
	expect(machineConsumedOnTeach(machine("SURF", true))).toBe(true);
	expect(machineConsumedOnTeach(machine("CUT"))).toBe(false);
});

let SPECIES_ID = Object.keys(SPECIES)[0]!;
let NATURE_ID = Object.keys(NATURES)[0]!;

/**
 * Builds an engine holding one party creature with the given moveset plus a bag of
 * machine copies, so the bag's teach dispatches can be exercised end to end.
 *
 * `HM01` teaches CUT and omits `Consumable` (reusable, HM-style); `HM01` is the
 * only machine authored today, so a single-use case reuses it with a Consumable
 * override injected at the content layer to model a TM.
 */
function createTeachEngine(
	moveset: [string, string | null, string | null, string | null],
	bag: Record<string, number>,
	items = ITEMS as unknown as Record<string, Item>,
) {
	let playerId = createPlayerId("hero");
	let creatureId = createCreatureId("buddy");
	let engine = Engine.create({
		content: { species: SPECIES, moves: MOVES, items, natures: NATURES, typeChart: TYPE_MATCHUPS },
		world: migrateWorld({
			entities: [playerId, creatureId],
			playerId,
			playerProfile: { [playerId]: { name: "Hero" } },
			party: { [playerId]: { creatureIds: [creatureId] } },
			inventory: { [playerId]: { items: bag } },
			bestiary: { [playerId]: { seen: [], caught: [] } },
			storageBoxes: { [playerId]: { boxes: [] } },
			creature: {
				[creatureId]: {
					species: SPECIES_ID,
					nature: NATURE_ID,
					experience: 100000,
					moveset,
					status: {
						state: null,
						damage: 0,
						pp: [10, 10, 10, 10] as [number, number, number, number],
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
	return { engine, playerId, creatureId };
}

test("teaching a machine move appends it when the creature has a free slot", () => {
	let { engine, creatureId } = createTeachEngine(["TACKLE", "GROWL", null, null], { HM01: 1 });
	let moveId = ITEMS.HM01.teachesMoveId; // CUT

	let events = engine.dispatch({ type: "learn-move", creatureId, moveId });

	expect(events.some((event) => event.type === "learned-move")).toBe(true);
	let summary = engine.selectCreatureSummary(creatureId);
	expect(summary.moves.map((slot) => slot.id)).toEqual(["TACKLE", "GROWL", moveId, null]);
});

test("teaching a machine move to a full moveset replaces the chosen slot", () => {
	let { engine, creatureId } = createTeachEngine(["TACKLE", "GROWL", "SURF", "STRENGTH"], {
		HM01: 1,
	});
	let moveId = ITEMS.HM01.teachesMoveId; // CUT

	let events = engine.dispatch({ type: "learn-move", creatureId, moveId, replaceSlotIndex: 1 });

	let learned = events.find((event) => event.type === "learned-move");
	expect(learned?.type === "learned-move" ? learned.replacedMoveId : null).toBe("GROWL");
	let summary = engine.selectCreatureSummary(creatureId);
	expect(summary.moves.map((slot) => slot.id)).toEqual(["TACKLE", moveId, "SURF", "STRENGTH"]);
});

test("teaching a machine move the creature already knows is a no-op", () => {
	let moveId = ITEMS.HM01.teachesMoveId; // CUT
	let { engine, creatureId } = createTeachEngine([moveId, "GROWL", null, null], { HM01: 1 });

	let events = engine.dispatch({ type: "learn-move", creatureId, moveId });

	expect(events.some((event) => event.type === "learned-move")).toBe(false);
	let summary = engine.selectCreatureSummary(creatureId);
	expect(summary.moves.map((slot) => slot.id)).toEqual([moveId, "GROWL", null, null]);
});

test("a single-use machine decrements after teaching, while a reusable HM does not", () => {
	// HM01 is reusable: teaching it never removes it from the bag.
	let hm = createTeachEngine(["TACKLE", "GROWL", null, null], { HM01: 2 });
	if (machineConsumedOnTeach(ITEMS.HM01 as unknown as Item)) {
		hm.engine.dispatch({
			type: "remove-inventory-item",
			playerId: hm.playerId,
			itemId: "HM01",
			count: 1,
		});
	}
	expect(
		hm.engine.selectInventory(hm.playerId).entries.find((entry) => entry.id === "HM01")?.count,
	).toBe(2);

	// A TM-style consumable machine: teaching it removes exactly one copy.
	let tmItems = {
		...ITEMS,
		TM01: { ...ITEMS.HM01, attributes: [...ITEMS.HM01.attributes, ItemAttribute.Consumable] },
	} as unknown as Record<string, Item>;
	let tm = createTeachEngine(["TACKLE", "GROWL", null, null], { TM01: 2 }, tmItems);
	if (machineConsumedOnTeach(tmItems.TM01!)) {
		tm.engine.dispatch({
			type: "remove-inventory-item",
			playerId: tm.playerId,
			itemId: "TM01",
			count: 1,
		});
	}
	expect(
		tm.engine.selectInventory(tm.playerId).entries.find((entry) => entry.id === "TM01")?.count,
	).toBe(1);
});
