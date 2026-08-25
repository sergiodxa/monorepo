/**
 * Resolves move and self-inflicted damage from combat state, move metadata, and
 * effect modifiers, keeping the calculation deterministic and free of
 * presentation concerns.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { GameData } from "~/game/data/game-data";
import type { Move, MoveEffect } from "~/game/data/move";
import type { Effectiveness } from "~/game/data/type";

import { DamageClass } from "~/game/data/move";
import { Stat } from "~/game/data/stat";
import { State } from "~/game/data/status";

import type { BattleEvent, BattlePosition, BattleState } from "../battle";
import type { CombatantState } from "../combatant-state";

import { getCreatureLevel, getCreatureSize, getCreatureStat } from "../mechanics";

/** Supplies state lookups needed by extracted damage calculations. */
export interface DamageSystemContext {
	state: BattleState;
	gameData: GameData;
	random(): number;
	isGrounded(combatant: CombatantState): boolean;
	findEffect<TKind extends MoveEffect["kind"]>(
		effects: MoveEffect[],
		kind: TKind,
	): Extract<MoveEffect, { kind: TKind }> | null;
	flattenEffects(effect: MoveEffect): MoveEffect[];
	getRemainingHP(combatant: CombatantState): number;
	getTypeEffectiveness(target: CombatantState, move: Move): Effectiveness;
	getCombatantSide(combatant: CombatantState): number;
	getCombatantPosition(combatant: CombatantState): BattlePosition;
	getCombatantSpeed(position: BattlePosition, combatant: CombatantState): number;
	getStageModifier(stage: number): number;
	getCriticalHitChance(user: CombatantState, move: Move): number;
	getStabModifier(user: CombatantState, move: Move): number;
}

/** Resolves multi-hit ranges into the number of attacks that should land. */
export function getMoveHitCount(context: DamageSystemContext, effects: MoveEffect[]): number {
	let multiHit = context.findEffect(effects, "multi-hit");
	if (!multiHit) return 1;
	if (typeof multiHit.hits === "number") return multiHit.hits;

	let [min, max] = multiHit.hits;
	return min + Math.floor(context.random() * (max - min + 1));
}

/**
 * Resolves one move's actual damage amount through effect-specific overrides
 * before falling back to the standard formula. Type immunity still zeroes
 * level-based fixed damage even though it bypasses the formula entirely.
 */
export function getResolvedMoveDamage(
	context: DamageSystemContext,
	user: CombatantState,
	target: CombatantState,
	targetPosition: BattlePosition,
	move: Move,
	effects: MoveEffect[],
	events: BattleEvent[],
): number {
	let ohko = context.findEffect(effects, "ohko");
	if (ohko) return context.getRemainingHP(target);

	let fixedDamage = context.findEffect(effects, "fixed-damage");
	if (fixedDamage) {
		if ("value" in fixedDamage) return fixedDamage.value;

		if (fixedDamage.amount === "user-level") {
			if (context.getTypeEffectiveness(target, move) === 0) return 0;
			return getCreatureLevel(context.gameData, user.creature);
		}

		return Math.max(1, Math.floor(context.getRemainingHP(target) / 2));
	}

	let fixedDamageUserHP = context.findEffect(effects, "fixed-damage-user-hp");
	if (fixedDamageUserHP) return context.getRemainingHP(user);

	let counterLastPhysicalHit = context.findEffect(effects, "counter-last-physical-hit");
	if (counterLastPhysicalHit) {
		return getCounterDamage(user, targetPosition, 2, DamageClass.Physical);
	}

	let counterLastSpecialHit = context.findEffect(effects, "counter-last-special-hit");
	if (counterLastSpecialHit) {
		return getCounterDamage(user, targetPosition, counterLastSpecialHit.ratio, DamageClass.Special);
	}

	let counterLastAnyHit = context.findEffect(effects, "counter-last-any-hit");
	if (counterLastAnyHit) {
		return getCounterDamage(user, targetPosition, counterLastAnyHit.ratio, null);
	}

	let fixedDamageTargetHPGap = context.findEffect(effects, "fixed-damage-target-hp-gap");
	if (fixedDamageTargetHPGap) {
		return Math.max(0, context.getRemainingHP(target) - context.getRemainingHP(user));
	}

	if (context.findEffect(effects, "power-from-held-item")) {
		if (getHeldItemPower(context, user) === null) return 0;
	}

	let effectiveness = context.getTypeEffectiveness(target, move);
	return calculateDamage(context, user, target, targetPosition, move, effectiveness, events);
}

/**
 * Reflects a multiple of the damage the user took this turn back at its source,
 * bypassing the stat/power formula the way OHKO and fixed-damage do. Nothing is
 * reflected when no qualifying hit landed this turn, or it came from another slot.
 */
function getCounterDamage(
	user: CombatantState,
	targetPosition: BattlePosition,
	ratio: number,
	requiredClass: DamageClass | null,
): number {
	let damage = user.volatile.lastDamageThisTurn;
	if (!damage) return 0;
	if (requiredClass !== null && damage.moveClass !== requiredClass) return 0;
	if (damage.source.side !== targetPosition.side || damage.source.slot !== targetPosition.slot) {
		return 0;
	}
	return Math.floor(damage.amount * ratio);
}

/** Computes self-hit confusion damage using the same stat pipeline as normal attacks. */
export function getConfusionDamage(context: DamageSystemContext, user: CombatantState): number {
	let attack = Math.floor(
		getCreatureStat(context.gameData, user.creature, Stat.Attack) *
			context.getStageModifier(user.statStages[Stat.Attack]),
	);
	let defense = Math.floor(
		getCreatureStat(context.gameData, user.creature, Stat.Defense) *
			context.getStageModifier(user.statStages[Stat.Defense]),
	);
	let level = getCreatureLevel(context.gameData, user.creature);

	return Math.floor(Math.floor((((2 * level) / 5 + 2) * 40 * attack) / defense) / 50) + 2;
}

/** Applies the standard move damage formula and emits matchup or crit events. */
function calculateDamage(
	context: DamageSystemContext,
	user: CombatantState,
	target: CombatantState,
	targetPosition: BattlePosition,
	move: Move,
	effectiveness: Effectiveness,
	events: BattleEvent[],
): number {
	let targetSide = context.getCombatantSide(target);
	let criticalHit =
		context.random() < context.getCriticalHitChance(user, move) &&
		context.state.sides[targetSide]!.effects.luckyChantTurns === 0;
	let damage = getBaseDamage(context, user, target, move, criticalHit);
	damage = Math.floor(damage * context.getStabModifier(user, move));

	if (effectiveness !== 1) {
		events.push({ type: "effectiveness", target: targetPosition, effectiveness });
	}

	damage = Math.floor(damage * effectiveness);

	if (criticalHit) {
		damage = Math.floor(damage * 1.5);
		events.push({ type: "critical-hit", target: targetPosition });
	}

	damage = applyHeldItemTypeBoost(context, user, move, damage);
	damage = applyMajorStatusDamageModifiers(user, move, damage);

	return Math.floor(damage * ((85 + Math.floor(context.random() * 16)) / 100));
}

/**
 * Multiplies outgoing damage when the attacker holds a matching type-boost item,
 * stacking as one more sequential multiply after STAB, effectiveness, and crit,
 * flooring the same way those modifiers do.
 */
function applyHeldItemTypeBoost(
	context: DamageSystemContext,
	user: CombatantState,
	move: Move,
	damage: number,
): number {
	let heldItemId = user.creature.heldItemId;
	if (heldItemId === null) return damage;

	let boost = context.gameData.items.get(heldItemId)?.battleEffect?.damageTypeBoost;
	if (!boost || boost.type !== move.type) return damage;

	return Math.floor(damage * boost.multiplier);
}

/**
 * Reads the throw power the attacker's held item grants to an item-thrown attack.
 * Returns `null` when the wielder holds nothing or an item with no throw power,
 * signalling the move has no power source and must fail rather than default.
 */
function getHeldItemPower(context: DamageSystemContext, user: CombatantState): number | null {
	let heldItemId = user.creature.heldItemId;
	if (heldItemId === null) return null;

	let power = context.gameData.items.get(heldItemId)?.battleEffect?.flingPower;
	return power ?? null;
}

function applyMajorStatusDamageModifiers(user: CombatantState, move: Move, damage: number): number {
	if (user.creature.status.state === State.Burned && move.damageClass === DamageClass.Physical) {
		return Math.floor(damage * 0.5);
	}

	return damage;
}

/**
 * Computes pre-modifier base damage from stats, power, and field protections.
 * Screens, weather, and terrain stack as sequential multiplies rather than
 * mutually exclusive early returns, so several can affect the same hit.
 */
function getBaseDamage(
	context: DamageSystemContext,
	user: CombatantState,
	target: CombatantState,
	move: Move,
	criticalHit: boolean,
): number {
	let power = getMovePower(context, user, target, move);
	let attackStage =
		move.damageClass === DamageClass.Physical
			? user.statStages[Stat.Attack]
			: user.statStages[Stat.SpecialAttack];
	if (criticalHit && attackStage < 0) attackStage = 0;

	let defenseStage =
		move.damageClass === DamageClass.Physical
			? target.statStages[Stat.Defense]
			: target.statStages[Stat.SpecialDefense];
	if (criticalHit && defenseStage > 0) defenseStage = 0;

	let attackStat =
		move.damageClass === DamageClass.Physical
			? Math.floor(
					getCreatureStat(context.gameData, user.creature, Stat.Attack) *
						context.getStageModifier(attackStage),
				)
			: Math.floor(
					getCreatureStat(context.gameData, user.creature, Stat.SpecialAttack) *
						context.getStageModifier(attackStage),
				);
	let defenseStat =
		move.damageClass === DamageClass.Physical
			? Math.floor(
					getCreatureStat(context.gameData, target.creature, Stat.Defense) *
						context.getStageModifier(defenseStage),
				)
			: Math.floor(
					getCreatureStat(context.gameData, target.creature, Stat.SpecialDefense) *
						context.getStageModifier(defenseStage),
				);

	if (context.state.field.wonderRoomTurns > 0) {
		let swappedDefense =
			move.damageClass === DamageClass.Physical
				? getCreatureStat(context.gameData, target.creature, Stat.SpecialDefense)
				: getCreatureStat(context.gameData, target.creature, Stat.Defense);
		defenseStat = Math.floor(swappedDefense);
	}

	let level = getCreatureLevel(context.gameData, user.creature);
	let baseDamage =
		Math.floor(Math.floor((((2 * level) / 5 + 2) * power * attackStat) / defenseStat) / 50) + 2;
	let targetSide = context.getCombatantSide(target);

	if (!criticalHit) {
		if (
			move.damageClass === DamageClass.Physical &&
			context.state.sides[targetSide]!.effects.reflectTurns > 0
		) {
			baseDamage = Math.floor(baseDamage * 0.5);
		}

		if (
			move.damageClass === DamageClass.Special &&
			context.state.sides[targetSide]!.effects.lightScreenTurns > 0
		) {
			baseDamage = Math.floor(baseDamage * 0.5);
		}
	}

	if (context.state.field.weather === "sun") {
		if (move.type === "fire") baseDamage = Math.floor(baseDamage * 1.5);
		if (move.type === "water") baseDamage = Math.floor(baseDamage * 0.5);
	}

	if (context.state.field.weather === "rain") {
		if (move.type === "water") baseDamage = Math.floor(baseDamage * 1.5);
		if (move.type === "fire") baseDamage = Math.floor(baseDamage * 0.5);
	}

	if (
		context.state.field.terrain === "electric" &&
		move.type === "electric" &&
		context.isGrounded(user)
	) {
		baseDamage = Math.floor(baseDamage * 1.3);
	}

	if (
		context.state.field.terrain === "grassy" &&
		move.type === "grass" &&
		context.isGrounded(user)
	) {
		baseDamage = Math.floor(baseDamage * 1.3);
	}

	if (
		context.state.field.terrain === "psychic" &&
		move.type === "psychic" &&
		context.isGrounded(user)
	) {
		baseDamage = Math.floor(baseDamage * 1.3);
	}

	if (
		context.state.field.terrain === "misty" &&
		move.type === "dragon" &&
		context.isGrounded(target)
	) {
		baseDamage = Math.floor(baseDamage * 0.5);
	}

	return baseDamage;
}

/**
 * Resolves dynamic power rules before the normal base-damage formula runs.
 * The held-item power path falls back to the move's own power only
 * defensively, since a missing throw power already fails the move earlier.
 */
function getMovePower(
	context: DamageSystemContext,
	user: CombatantState,
	target: CombatantState,
	move: Move,
): number {
	let effects = context.flattenEffects(move.effect);

	if (context.findEffect(effects, "power-from-held-item")) {
		return getHeldItemPower(context, user) ?? move.power;
	}

	if (context.findEffect(effects, "double-power-on-damaged-target")) {
		let targetMaxHP = getCreatureStat(context.gameData, target.creature, Stat.HP);
		if (context.getRemainingHP(target) <= Math.floor(targetMaxHP / 2)) return move.power * 2;
	}

	if (
		user.volatile.chargedElectric &&
		move.damageClass !== DamageClass.Status &&
		move.type === "electric"
	) {
		return move.power * 2;
	}

	if (context.findEffect(effects, "double-power-if-target-damaged-this-turn")) {
		if (target.volatile.lastDamageThisTurn !== null) return move.power * 2;
	}

	if (context.findEffect(effects, "double-power-on-status-target")) {
		if (target.creature.status.state !== null) return move.power * 2;
	}

	if (context.findEffect(effects, "power-from-target-speed")) {
		let userSpeed = Math.max(
			1,
			context.getCombatantSpeed(context.getCombatantPosition(user), user),
		);
		let targetSpeed = Math.max(
			1,
			context.getCombatantSpeed(context.getCombatantPosition(target), target),
		);
		let ratio = userSpeed / targetSpeed;
		if (ratio >= 4) return 150;
		if (ratio >= 3) return 120;
		if (ratio >= 2) return 80;
		if (ratio >= 1) return 60;
		return 40;
	}

	if (context.findEffect(effects, "power-from-user-speed")) {
		let userSpeed = Math.max(
			1,
			context.getCombatantSpeed(context.getCombatantPosition(user), user),
		);
		let targetSpeed = Math.max(
			1,
			context.getCombatantSpeed(context.getCombatantPosition(target), target),
		);
		return Math.max(1, Math.min(150, Math.floor((25 * targetSpeed) / userSpeed)));
	}

	if (context.findEffect(effects, "power-from-user-hp")) {
		let maxHP = getCreatureStat(context.gameData, user.creature, Stat.HP);
		let currentHP = context.getRemainingHP(user);
		let ratio = Math.floor((currentHP * 48) / maxHP);
		if (ratio <= 1) return 200;
		if (ratio <= 4) return 150;
		if (ratio <= 9) return 100;
		if (ratio <= 16) return 80;
		if (ratio <= 32) return 40;
		return 20;
	}

	if (context.findEffect(effects, "power-from-weight")) {
		let userWeight = getCreatureSize(context.gameData, user.creature).weight;
		let targetWeight = getCreatureSize(context.gameData, target.creature).weight;
		let ratio = userWeight / Math.max(0.1, targetWeight);
		if (ratio >= 5) return 120;
		if (ratio >= 4) return 100;
		if (ratio >= 3) return 80;
		if (ratio >= 2) return 60;
		return 40;
	}

	return move.power;
}
