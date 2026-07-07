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

import { StatusEffectType } from "~/game/data/move";

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

test("well-known status moves carry an authored effect kind", () => {
	let expectations: Record<string, string> = {
		GROWL: "modify-stat",
		SWORDS_DANCE: "modify-stat",
		WITHDRAW: "modify-stat",
		ROCK_POLISH: "modify-stat",
		TOXIC: "apply-status",
		THUNDER_WAVE: "apply-status",
		WILL_O_WISP: "apply-status",
		SPORE: "apply-status",
		STUN_SPORE: "apply-status",
		SUPERSONIC: "confuse",
		SWEET_KISS: "confuse",
		TEETER_DANCE: "confuse",
		BLOCK: "trap",
		LEECH_SEED: "leech-seed",
		REFLECT: "side-effect",
		LOW_KICK: "power-from-weight",
		REVERSAL: "power-from-user-hp",
	};
	for (let [id, kind] of Object.entries(expectations)) {
		let move = movesById[id];
		expect(move, `${id} should exist`).toBeDefined();
		expect(effectKinds(move!.effect), `${id} should declare ${kind}`).toContain(kind);
	}
});

test("percentage self-heal moves declare the heal effect", () => {
	for (let id of [
		"RECOVER",
		"SOFT_BOILED",
		"SLACK_OFF",
		"ROOST",
		"SYNTHESIS",
		"MORNING_SUN",
		"MOONLIGHT",
	]) {
		let move = movesById[id];
		expect(move, `${id} should exist`).toBeDefined();
		expect(effectKinds(move!.effect), `${id} should heal the user`).toContain("heal");
	}
});

test("TOXIC applies escalating poison, not a flat status", () => {
	let move = movesById.TOXIC;
	expect(move).toBeDefined();
	let effect = move!.effect;
	expect(effect.kind).toBe("apply-status");
	if (effect.kind === "apply-status") {
		expect(effect.status).toBe(StatusEffectType.Poison);
		expect(effect.poisonVariant).toBe("escalating");
		expect(effect.chance).toBe(1);
	}
});

test("compound status moves combine a stat drop with confusion", () => {
	for (let id of ["SWAGGER", "FLATTER"]) {
		let move = movesById[id];
		expect(move, `${id} should exist`).toBeDefined();
		let kinds = effectKinds(move!.effect);
		expect(kinds, `${id} should raise a stat`).toContain("modify-stat");
		expect(kinds, `${id} should confuse`).toContain("confuse");
	}
});

test("every guaranteed apply-status move keeps chance in the 0..1 range", () => {
	function assertChances(effect: MoveEffect) {
		if (effect.kind === "compound") {
			for (let inner of effect.effects) assertChances(inner);
			return;
		}
		if (effect.kind === "apply-status" || effect.kind === "flinch") {
			expect(effect.chance).toBeGreaterThanOrEqual(0);
			expect(effect.chance).toBeLessThanOrEqual(1);
		}
	}
	for (let move of Object.values(movesById)) assertChances(move.effect);
});

test("level-based fixed-damage moves declare fixed-damage by user-level", () => {
	for (let id of ["NIGHT_SHADE", "SEISMIC_TOSS"]) {
		let move = movesById[id];
		expect(move, `${id} should exist`).toBeDefined();
		let effect = move!.effect;
		expect(effect.kind, `${id} should be fixed-damage`).toBe("fixed-damage");
		if (effect.kind === "fixed-damage" && "amount" in effect) {
			expect(effect.amount, `${id} should scale with the user's level`).toBe("user-level");
		} else {
			throw new Error(`${id} should carry an amount-based fixed-damage effect`);
		}
	}
});

test("SUPER_FANG halves the target's current HP", () => {
	let move = movesById.SUPER_FANG;
	expect(move).toBeDefined();
	let effect = move!.effect;
	expect(effect.kind).toBe("fixed-damage");
	if (effect.kind === "fixed-damage" && "amount" in effect) {
		expect(effect.amount).toBe("half-target-hp");
	} else {
		throw new Error("SUPER_FANG should carry an amount-based fixed-damage effect");
	}
});

test("counter/reflect moves declare their reflecting effect and ratio", () => {
	let mirrorCoat = movesById.MIRROR_COAT;
	expect(mirrorCoat).toBeDefined();
	let mirrorEffect = mirrorCoat!.effect;
	expect(mirrorEffect.kind).toBe("counter-last-special-hit");
	if (mirrorEffect.kind === "counter-last-special-hit") {
		expect(mirrorEffect.ratio).toBe(2);
	}

	let metalBurst = movesById.METAL_BURST;
	expect(metalBurst).toBeDefined();
	let metalEffect = metalBurst!.effect;
	expect(metalEffect.kind).toBe("counter-last-any-hit");
	if (metalEffect.kind === "counter-last-any-hit") {
		expect(metalEffect.ratio).toBe(1.5);
	}
});

test("power-0 moves still lacking an effect stays at or below the known baseline", () => {
	// Coverage guard: counts status/utility moves that deal no damage AND carry no
	// authored effect, so they resolve to a no-op. The baseline can only shrink as
	// more moves gain effects; a rise means a modeled move regressed to `none`.
	let stranded = Object.entries(movesById).filter(
		([, move]) => move.power === 0 && move.effect.kind === "none",
	);
	expect(stranded.length).toBeLessThanOrEqual(52);
});
