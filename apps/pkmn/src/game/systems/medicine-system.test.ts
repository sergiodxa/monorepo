/**
 * Verifies the pure medicine-system rules that compute how a recovery item changes a
 * creature's stored HP and major status. The assertions pin down healing, status
 * cures, revives, clamping at maximum HP, and the no-op cases so the engine and
 * presentation can share one deterministic recovery calculation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "bun:test";

import { State } from "~/game/data/status";

import { applyMedicine, isMedicineEffect } from "./medicine-system";

test("heal-hp restores the fixed amount and reports how much was healed", () => {
	let result = applyMedicine(
		{ kind: "heal-hp", amount: 20 },
		{ currentHP: 10, maxHP: 50, status: null },
	);

	expect(result).toEqual({
		applied: true,
		currentHP: 30,
		healed: 20,
		status: null,
		revived: false,
	});
});

test("heal-hp clamps the restored HP at the maximum", () => {
	let result = applyMedicine(
		{ kind: "heal-hp", amount: 200 },
		{ currentHP: 40, maxHP: 50, status: null },
	);

	expect(result.currentHP).toBe(50);
	expect(result.healed).toBe(10);
	expect(result.applied).toBe(true);
});

test("heal-hp full tops the creature off", () => {
	let result = applyMedicine(
		{ kind: "heal-hp", amount: "full" },
		{ currentHP: 5, maxHP: 50, status: null },
	);

	expect(result.currentHP).toBe(50);
	expect(result.healed).toBe(45);
});

test("heal-hp is a no-op at full HP", () => {
	let result = applyMedicine(
		{ kind: "heal-hp", amount: 20 },
		{ currentHP: 50, maxHP: 50, status: null },
	);

	expect(result.applied).toBe(false);
	expect(result.currentHP).toBe(50);
	expect(result.healed).toBe(0);
});

test("heal-hp cannot heal a fainted creature", () => {
	let result = applyMedicine(
		{ kind: "heal-hp", amount: 20 },
		{ currentHP: 0, maxHP: 50, status: null },
	);

	expect(result.applied).toBe(false);
	expect(result.currentHP).toBe(0);
});

test("cure-status clears a matching status and leaves HP untouched", () => {
	let result = applyMedicine(
		{ kind: "cure-status", status: [State.Poisoned] },
		{ currentHP: 20, maxHP: 50, status: State.Poisoned },
	);

	expect(result).toEqual({
		applied: true,
		currentHP: 20,
		healed: 0,
		status: null,
		revived: false,
	});
});

test("cure-status ignores a status it does not target", () => {
	let result = applyMedicine(
		{ kind: "cure-status", status: [State.Poisoned] },
		{ currentHP: 20, maxHP: 50, status: State.Burned },
	);

	expect(result.applied).toBe(false);
	expect(result.status).toBe(State.Burned);
});

test("cure-status any clears whatever status is present", () => {
	let result = applyMedicine(
		{ kind: "cure-status", status: "any" },
		{ currentHP: 20, maxHP: 50, status: State.Asleep },
	);

	expect(result.applied).toBe(true);
	expect(result.status).toBeNull();
});

test("cure-status is a no-op on a healthy creature", () => {
	let result = applyMedicine(
		{ kind: "cure-status", status: "any" },
		{ currentHP: 20, maxHP: 50, status: null },
	);

	expect(result.applied).toBe(false);
	expect(result.status).toBeNull();
});

test("heal-hp-and-cure-status both heals and cures in one call", () => {
	let result = applyMedicine(
		{ kind: "heal-hp-and-cure-status", amount: "full", status: "any" },
		{ currentHP: 8, maxHP: 50, status: State.Paralyzed },
	);

	expect(result.applied).toBe(true);
	expect(result.currentHP).toBe(50);
	expect(result.healed).toBe(42);
	expect(result.status).toBeNull();
});

test("heal-hp-and-cure-status applies when only the cure lands at full HP", () => {
	let result = applyMedicine(
		{ kind: "heal-hp-and-cure-status", amount: "full", status: "any" },
		{ currentHP: 50, maxHP: 50, status: State.Burned },
	);

	expect(result.applied).toBe(true);
	expect(result.healed).toBe(0);
	expect(result.status).toBeNull();
});

test("revive restores a fainted creature to half its maximum HP", () => {
	let result = applyMedicine(
		{ kind: "revive", amount: "half" },
		{ currentHP: 0, maxHP: 50, status: State.Poisoned },
	);

	expect(result.applied).toBe(true);
	expect(result.revived).toBe(true);
	expect(result.currentHP).toBe(25);
	expect(result.status).toBeNull();
});

test("revive full restores a fainted creature to its maximum HP", () => {
	let result = applyMedicine(
		{ kind: "revive", amount: "full" },
		{ currentHP: 0, maxHP: 51, status: null },
	);

	expect(result.currentHP).toBe(51);
	expect(result.revived).toBe(true);
});

test("revive half rounds up to at least one HP", () => {
	let result = applyMedicine(
		{ kind: "revive", amount: "half" },
		{ currentHP: 0, maxHP: 1, status: null },
	);

	expect(result.currentHP).toBe(1);
});

test("revive is a no-op on a creature that has not fainted", () => {
	let result = applyMedicine(
		{ kind: "revive", amount: "half" },
		{ currentHP: 10, maxHP: 50, status: null },
	);

	expect(result.applied).toBe(false);
	expect(result.revived).toBe(false);
	expect(result.currentHP).toBe(10);
});

test("non-recovery effects are no-ops on HP and status", () => {
	let result = applyMedicine(
		{ kind: "restore-pp", amount: "full", target: "all-moves" },
		{ currentHP: 10, maxHP: 50, status: State.Burned },
	);

	expect(result.applied).toBe(false);
	expect(result.currentHP).toBe(10);
	expect(result.status).toBe(State.Burned);
});

test("isMedicineEffect accepts recovery effects and rejects other item effects", () => {
	expect(isMedicineEffect({ kind: "heal-hp", amount: 20 })).toBe(true);
	expect(isMedicineEffect({ kind: "cure-status", status: "any" })).toBe(true);
	expect(isMedicineEffect({ kind: "revive", amount: "half" })).toBe(true);
	expect(isMedicineEffect({ kind: "heal-hp-and-cure-status", amount: "full", status: "any" })).toBe(
		true,
	);

	expect(isMedicineEffect({ multiplier: 1.5 })).toBe(false);
	expect(isMedicineEffect({ kind: "critical-rate", stages: 2 })).toBe(false);
	expect(isMedicineEffect({ kind: "restore-pp", amount: 10, target: "one-move" })).toBe(false);
	expect(isMedicineEffect(undefined)).toBe(false);
});
