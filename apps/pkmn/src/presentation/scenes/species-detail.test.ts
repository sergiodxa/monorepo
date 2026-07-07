/**
 * Tests for the species-detail screen's pure content-row builder.
 *
 * Covers `speciesDetailRows`: the dex number is zero-padded, one or two types are
 * joined into a single line, the seen/caught status resolves to the right label,
 * every base stat becomes its own row, and the "Where to catch" section lists each
 * habitat zone — collapsing to a single "Unknown" line when the habitat is empty.
 * The canvas drawing and the scene's input routing are not exercised here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "bun:test";

import type { SpeciesDetailView } from "~/game/selectors";

import { speciesDetailRows } from "./species-detail";

/** A base view with two types, caught, and no habitat, tweaked per test. */
function view(overrides: Partial<SpeciesDetailView> = {}): SpeciesDetailView {
	return {
		speciesId: "GRASSMON",
		name: "GRASSMON",
		number: 7,
		types: ["grass", "poison"],
		baseStats: {
			hp: 45,
			attack: 49,
			defense: 49,
			"special-attack": 65,
			"special-defense": 65,
			speed: 45,
		},
		seen: true,
		caught: true,
		habitat: [],
		...overrides,
	};
}

/** Returns the value of the first row with the given label. */
function valueOf(rows: ReturnType<typeof speciesDetailRows>, label: string): string | undefined {
	return rows.find((row) => row.label === label)?.value;
}

test("speciesDetailRows zero-pads the dex number and joins the types", () => {
	let rows = speciesDetailRows(view());
	expect(valueOf(rows, "NO")).toBe("#007");
	expect(valueOf(rows, "TYPE")).toBe("grass / poison");
});

test("speciesDetailRows shows a single type without a separator", () => {
	let rows = speciesDetailRows(view({ types: ["fire"] }));
	expect(valueOf(rows, "TYPE")).toBe("fire");
});

test("speciesDetailRows resolves the seen/caught status label", () => {
	expect(valueOf(speciesDetailRows(view({ seen: true, caught: true })), "STATUS")).toBe("Caught");
	expect(valueOf(speciesDetailRows(view({ seen: true, caught: false })), "STATUS")).toBe("Seen");
	expect(valueOf(speciesDetailRows(view({ seen: false, caught: false })), "STATUS")).toBe("-");
});

test("speciesDetailRows renders every base stat as its own labelled row", () => {
	let rows = speciesDetailRows(view());
	expect(valueOf(rows, "HP")).toBe("45");
	expect(valueOf(rows, "ATK")).toBe("49");
	expect(valueOf(rows, "DEF")).toBe("49");
	expect(valueOf(rows, "SP.ATK")).toBe("65");
	expect(valueOf(rows, "SP.DEF")).toBe("65");
	expect(valueOf(rows, "SPD")).toBe("45");
});

test("speciesDetailRows lists each habitat zone under a single WHERE label", () => {
	let rows = speciesDetailRows(view({ habitat: ["route-1", "cave-2"] }));
	let whereIndex = rows.findIndex((row) => row.label === "WHERE");
	expect(whereIndex).toBeGreaterThanOrEqual(0);
	expect(rows[whereIndex]!.value).toBe("route-1");
	// The second zone continues under a blank label, not a repeated "WHERE".
	expect(rows[whereIndex + 1]).toEqual({ label: "", value: "cave-2" });
});

test("speciesDetailRows shows Unknown for a species with no known habitat", () => {
	let rows = speciesDetailRows(view({ habitat: [] }));
	expect(valueOf(rows, "WHERE")).toBe("Unknown");
});
