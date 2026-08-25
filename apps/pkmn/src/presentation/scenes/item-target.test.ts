/**
 * Tests for the item-target picker's pure row derivation.
 *
 * Covers `itemTargetRows`, asserting the per-member formatting, the status
 * suffix, and the empty-party case so the picker's row list stays a pure
 * function of the party view.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "vitest";

import type { CreatureSummaryView, PartyView } from "~/game/selectors";

import { itemTargetRows } from "./item-target";

/** Builds a minimal creature summary with only the fields the picker reads. */
function creature(fields: Partial<CreatureSummaryView>): CreatureSummaryView {
	return {
		id: "c1",
		name: "BUDDY",
		speciesId: "BUDDY",
		level: 5,
		maxHP: 20,
		currentHP: 20,
		status: null,
		moves: [],
		location: "party:1",
		stats: { hp: 20, attack: 0, defense: 0, "special-attack": 0, "special-defense": 0, speed: 0 },
		ivs: { hp: 0, attack: 0, defense: 0, "special-attack": 0, "special-defense": 0, speed: 0 },
		evs: { hp: 0, attack: 0, defense: 0, "special-attack": 0, "special-defense": 0, speed: 0 },
		nature: "hardy",
		gender: "genderless" as CreatureSummaryView["gender"],
		heldItemId: null,
		...fields,
	};
}

/** Wraps a list of creatures in a party view for the derivation under test. */
function party(creatures: CreatureSummaryView[]): PartyView {
	return { playerId: "hero", creatures };
}

test("itemTargetRows lists each member with name, level, and HP in order", () => {
	let rows = itemTargetRows(
		party([
			creature({ name: "ALPHA", level: 5, currentHP: 12, maxHP: 20 }),
			creature({ name: "BETA", level: 9, currentHP: 30, maxHP: 30 }),
		]),
	);
	expect(rows).toEqual(["ALPHA  L5  12/20", "BETA  L9  30/30"]);
});

test("itemTargetRows appends the status label only when a member has one", () => {
	let rows = itemTargetRows(
		party([
			creature({ name: "SICK", currentHP: 4, maxHP: 20, status: "poison" }),
			creature({ name: "WELL", currentHP: 20, maxHP: 20, status: null }),
		]),
	);
	expect(rows).toEqual(["SICK  L5  4/20  poison", "WELL  L5  20/20"]);
});

test("itemTargetRows returns no rows for an empty party", () => {
	expect(itemTargetRows(party([]))).toEqual([]);
});
