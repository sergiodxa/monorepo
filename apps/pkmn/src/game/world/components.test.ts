/**
 * Verifies the per-instance creature component contracts and gender rolling.
 *
 * These tests pin the instance-state defaults (genderless, no held item, zero
 * friendship), confirm `rollGender` is deterministic under a seeded RNG and always
 * yields genderless for species without a ratio, and check that splitting a legacy
 * creature blob seeds the default instance state so older saves keep working.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "vitest";

import type { Species } from "~/game/data/species";

import { Gender } from "~/game/data/species";

import type { LegacyCreatureComponent } from "./components";

import {
	DEFAULT_CREATURE_INSTANCE,
	createCreatureInstance,
	mergeCreatureComponents,
	rollGender,
	splitCreatureComponents,
} from "./components";

/** A species gender ratio the roll can partition (mostly male, like a common starter). */
let COMMON_RATIO: Species["gender"] = { [Gender.Male]: 87.5, [Gender.Female]: 12.5 };
let EVEN_RATIO: Species["gender"] = { [Gender.Male]: 50, [Gender.Female]: 50 };

/** Builds a legacy aggregate creature blob for the split test. */
function legacyCreature(): LegacyCreatureComponent {
	return {
		species: "SPECIES_A",
		nature: "HARDY",
		experience: 100,
		moveset: ["MOVE_A", null, null, null],
		status: { state: null, damage: 0, pp: [35, 0, 0, 0] },
		iv: {
			hp: 0,
			attack: 0,
			defense: 0,
			"special-attack": 0,
			"special-defense": 0,
			speed: 0,
		},
		ev: {
			hp: 0,
			attack: 0,
			defense: 0,
			"special-attack": 0,
			"special-defense": 0,
			speed: 0,
		},
	} as unknown as LegacyCreatureComponent;
}

test("createCreatureInstance fills omitted fields from the default", () => {
	expect(createCreatureInstance()).toEqual(DEFAULT_CREATURE_INSTANCE);
	expect(createCreatureInstance({ heldItemId: "POTION" })).toEqual({
		gender: Gender.Genderless,
		heldItemId: "POTION",
		friendship: 0,
	});
});

test("rollGender always yields genderless for a species with no ratio", () => {
	// A throwing RNG proves the genderless branch never draws randomness.
	let random = () => {
		throw new Error("random should not be called for a genderless species");
	};
	expect(rollGender(Gender.Genderless, random)).toBe(Gender.Genderless);
});

test("rollGender partitions the ratio deterministically against the RNG draw", () => {
	// A low draw lands under the female share; a high draw lands in the male range.
	expect(rollGender(EVEN_RATIO, () => 0.1)).toBe(Gender.Female);
	expect(rollGender(EVEN_RATIO, () => 0.9)).toBe(Gender.Male);
	// The COMMON ratio only gives 12.5% to female, so a mid draw is male.
	expect(rollGender(COMMON_RATIO, () => 0.2)).toBe(Gender.Male);
	expect(rollGender(COMMON_RATIO, () => 0.05)).toBe(Gender.Female);
});

test("rollGender is stable for the same seeded value", () => {
	let seeded = () => 0.3;
	expect(rollGender(EVEN_RATIO, seeded)).toBe(rollGender(EVEN_RATIO, seeded));
});

test("rollGender treats a single-sex ratio as that sex without drawing", () => {
	let random = () => {
		throw new Error("random should not be called for a single-sex ratio");
	};
	expect(rollGender({ [Gender.Female]: 100 }, random)).toBe(Gender.Female);
	expect(rollGender({ [Gender.Male]: 100 }, random)).toBe(Gender.Male);
});

test("splitCreatureComponents seeds the default instance state", () => {
	let components = splitCreatureComponents({
		creatureId: "creature-1",
		creature: legacyCreature(),
	});
	expect(components.instance).toEqual(DEFAULT_CREATURE_INSTANCE);
});

test("mergeCreatureComponents carries the held item into the battle creature", () => {
	// Regression: the world's stored held item must reach the battle Creature snapshot,
	// otherwise held-item battle effects (Leftovers, type boosts) never fire in play.
	let held = splitCreatureComponents({ creatureId: "creature-1", creature: legacyCreature() });
	held.instance = createCreatureInstance({ heldItemId: "POTION" });
	expect(mergeCreatureComponents(held).heldItemId).toBe("POTION");

	let empty = splitCreatureComponents({ creatureId: "creature-2", creature: legacyCreature() });
	expect(mergeCreatureComponents(empty).heldItemId).toBeNull();
});
