/**
 * Tests for the bag's pure item classification.
 *
 * Covers `bagItemAction`, which decides how a confirmed bag item is used on a
 * creature: evolution items open the stone flow, recovery medicines open the
 * medicine flow, and everything else (held items, capture balls, PP/EV items, an
 * unknown record) stays browse-only. The scene wiring and canvas drawing are not
 * exercised here; only the classification is asserted so the routing rule stays a
 * pure function of the item record.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "bun:test";

import type { Item } from "~/game/data/item";

import { ItemAttribute } from "~/game/data/item";

import { bagItemAction } from "./bag";

/** Builds a minimal item with the given category and optional effect payload. */
function item(category: string, effect?: object): Item {
	return { category, attributes: [ItemAttribute.Countable], ...(effect ? { effect } : {}) } as Item;
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
