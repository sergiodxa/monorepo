/**
 * Tests for the new-game world factory.
 *
 * Covers the regression where a new game left the bestiary empty despite the
 * player already owning the starter.
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

import { createNewGameWorld, HERO_ID } from "./new-game";

let content = {
	species: SPECIES,
	moves: MOVES,
	items: ITEMS,
	natures: NATURES,
	typeChart: TYPE_MATCHUPS,
};

test("a new game registers the starter as seen and caught (regression)", () => {
	let world = createNewGameWorld(content);
	let starterSpeciesId = Object.keys(SPECIES)[0]!;
	let bestiary = world.bestiary[HERO_ID];

	expect(bestiary).toBeDefined();
	expect(bestiary!.caught).toContain(starterSpeciesId);
	expect(bestiary!.seen).toContain(starterSpeciesId);
});

test("a new game gives the player exactly one party creature (the starter)", () => {
	let world = createNewGameWorld(content);
	expect(world.party[HERO_ID]?.creatureIds.length).toBe(1);
});

test("a new game seeds the hero with a large starting balance", () => {
	let world = createNewGameWorld(content);
	expect(world.money[HERO_ID]?.amount).toBe(100000);
});
