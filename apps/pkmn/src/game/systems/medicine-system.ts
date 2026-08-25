/**
 * Pure helpers that compute how a medicine effect changes a creature's
 * stored HP and status without mutating anything, so the same computation
 * drives both battle turns and future overworld use.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { MedicineEffect } from "~/game/data/item";

import { State } from "~/game/data/status";

/** Snapshot of the creature values a medicine effect reads before it resolves. */
export interface MedicineTarget {
	/** Current remaining HP. Zero means the creature is fainted. */
	currentHP: number;
	maxHP: number;
	/** Current major status, or null when healthy. */
	status: State | null;
}

/**
 * Narrows an authored item effect to the HP/status-recovering medicine
 * effects, excluding capture, battle-item, PP, and EV effects so a
 * non-recovery item is never treated as usable here.
 */
export function isMedicineEffect(effect: unknown): effect is MedicineEffect {
	if (typeof effect !== "object" || effect === null || !("kind" in effect)) return false;
	let kind = (effect as { kind: unknown }).kind;
	return (
		kind === "heal-hp" ||
		kind === "cure-status" ||
		kind === "heal-hp-and-cure-status" ||
		kind === "revive"
	);
}

/** The resolved outcome of applying a medicine effect to a target snapshot. */
export interface MedicineResult {
	/** Whether the effect changed anything; a no-op leaves every field unchanged. */
	applied: boolean;
	/** HP the target should hold after the effect (always clamped to the maximum). */
	currentHP: number;
	/** HP restored by the effect (never negative). */
	healed: number;
	/** Major status the target should hold after the effect, or null when cured. */
	status: State | null;
	/** Whether the effect revived a fainted target this call. */
	revived: boolean;
}

/**
 * Computes the outcome of applying one medicine effect to a target snapshot
 * without mutating it. Ineligible targets resolve to a no-op, and a revive
 * always clears status to null since a fainted target has none left to cure.
 */
export function applyMedicine(effect: MedicineEffect, target: MedicineTarget): MedicineResult {
	let noop: MedicineResult = {
		applied: false,
		currentHP: target.currentHP,
		healed: 0,
		status: target.status,
		revived: false,
	};

	switch (effect.kind) {
		case "revive": {
			if (target.currentHP > 0) return noop;
			let restored =
				effect.amount === "full" ? target.maxHP : Math.max(1, Math.ceil(target.maxHP / 2));
			let currentHP = Math.min(target.maxHP, restored);
			return {
				applied: true,
				currentHP,
				healed: currentHP,
				status: null,
				revived: true,
			};
		}
		case "heal-hp": {
			return resolveHeal(effect.amount, target, target.status);
		}
		case "cure-status": {
			return resolveCure(effect.status, target, target.currentHP, 0);
		}
		case "heal-hp-and-cure-status": {
			let heal = resolveHeal(effect.amount, target, target.status);
			let cure = resolveCure(effect.status, target, heal.currentHP, heal.healed);
			return {
				applied: heal.applied || cure.applied,
				currentHP: cure.currentHP,
				healed: cure.healed,
				status: cure.status,
				revived: false,
			};
		}
		default: {
			return noop;
		}
	}
}

/** Resolves an HP restore against a living target, keeping status untouched. */
function resolveHeal(
	amount: number | "full",
	target: MedicineTarget,
	status: State | null,
): MedicineResult {
	if (target.currentHP <= 0 || target.currentHP >= target.maxHP) {
		return { applied: false, currentHP: target.currentHP, healed: 0, status, revived: false };
	}

	let restored = amount === "full" ? target.maxHP : target.currentHP + amount;
	let currentHP = Math.min(target.maxHP, Math.max(target.currentHP, restored));
	return {
		applied: currentHP > target.currentHP,
		currentHP,
		healed: currentHP - target.currentHP,
		status,
		revived: false,
	};
}

/** Resolves a status cure against a target, keeping HP at the passed-through value. */
function resolveCure(
	cures: State[] | "any",
	target: MedicineTarget,
	currentHP: number,
	healed: number,
): MedicineResult {
	let clears =
		target.status !== null && (cures === "any" || cures.includes(target.status)) === true;
	return {
		applied: healed > 0 || clears,
		currentHP,
		healed,
		status: clears ? null : target.status,
		revived: false,
	};
}
