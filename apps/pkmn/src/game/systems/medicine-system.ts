/**
 * Pure helpers that compute how a medicine effect changes one creature's stored HP
 * and major status. Given a target's current HP, maximum HP, and status, these
 * functions resolve the new HP (clamped to the maximum), the statuses cleared, and
 * whether a revive occurred, without mutating anything or reaching into world state.
 *
 * The engine layer owns the actual mutation and event emission; this module keeps
 * the recovery rules in one testable place so the same computation drives both the
 * in-battle turn action and any future overworld use. The rules are content-agnostic
 * and operate only on the generic medicine-effect shape and the shared status enum.
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
	/** Maximum HP the creature can hold. */
	maxHP: number;
	/** Current major status, or null when healthy. */
	status: State | null;
}

/**
 * Narrows an authored item effect to the HP/status-recovering medicine effects.
 *
 * Only heal, cure, combined, and revive effects act on a creature's stored HP or
 * status; capture multipliers, battle-item boosts, PP restoration, and EV training
 * effects are excluded so a non-recovery item is never treated as usable here.
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
 * Computes the outcome of applying one medicine effect to a target snapshot.
 *
 * The input is left untouched; callers apply the returned `currentHP`/`status` and
 * emit an event only when `applied` is true. HP-only medicine on a full-HP or fainted
 * target, status cures with no matching status, and revives on a healthy target are
 * all no-ops. A revive restores a fainted target to a fraction of its maximum HP; a
 * "full" revive tops it off, a "half" revive rounds up to at least one HP.
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
				// A fainted creature carries no major status to clear.
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
			// restore-pp, pp-boost and raise-ev do not act on stored HP or status.
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
	// HP restoration cannot act on a fainted target or one already at full HP.
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
