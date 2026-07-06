/**
 * Content sanity checks for the authored move set.
 *
 * These guard against move records that silently do nothing — most importantly
 * the one-hit-KO moves, which carry `power: 0` and therefore deal no damage
 * unless they declare the `ohko` effect. Regression coverage for the bug where
 * Fissure/Guillotine/Sheer Cold shipped with `kind: "none"`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "bun:test";

import type { Move, MoveEffect } from "~/game/data/move";

import { MOVES } from "./moves";

/** The move set indexed by arbitrary string id for lookup in tests. */
let movesById = MOVES as Record<string, Move>;

/** Flattens a (possibly compound) move effect into its leaf effect kinds. */
function effectKinds(effect: MoveEffect): string[] {
	if (effect.kind === "compound") return effect.effects.flatMap(effectKinds);
	return [effect.kind];
}

test("one-hit-KO moves declare the ohko effect (regression)", () => {
	for (let id of ["FISSURE", "GUILLOTINE", "SHEER_COLD", "HORN_DRILL"]) {
		let move = movesById[id];
		expect(move, `${id} should exist`).toBeDefined();
		expect(effectKinds(move!.effect), `${id} should be a one-hit KO`).toContain("ohko");
	}
});
