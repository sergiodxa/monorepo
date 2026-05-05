/**
 * Centralizes the battle damage system utilities used to resolve how much harm an action or self-inflicted effect produces.
 * This module defines the context contract for damage lookups and exposes the entry points that translate combat state,
 * move metadata, and effect modifiers into concrete numeric damage values.
 *
 * It also contains the internal calculation pipeline for standard damage resolution, including effect-specific overrides,
 * effectiveness adjustments, and event emission for notable outcomes. The result is a focused module that keeps damage
 * computation consistent, deterministic from its inputs, and isolated from presentation concerns.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { GameData } from "~/game/data/game-data";
import type { Move, MoveEffect } from "~/game/data/move";
import type { Effectiveness } from "~/game/data/type";

import { DamageClass } from "~/game/data/move";
import { Stat } from "~/game/data/stat";

import type { BattleEvent, BattlePosition, BattleState } from "../battle";
import type { CombatantState } from "../combatant-state";

import { getCreatureLevel, getCreatureSize, getCreatureStat } from "../mechanics";

/** Supplies state lookups needed by extracted damage calculations. */
export interface DamageSystemContext {
	state: BattleState;
	gameData: GameData;
	random(): number;
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
	getCriticalHitChance(user: CombatantState): number;
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

/** Resolves one move's actual damage amount after effect-specific overrides. */
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
	if (fixedDamage) return fixedDamage.value;

	let fixedDamageUserHP = context.findEffect(effects, "fixed-damage-user-hp");
	if (fixedDamageUserHP) return context.getRemainingHP(user);

	let counterLastPhysicalHit = context.findEffect(effects, "counter-last-physical-hit");
	if (counterLastPhysicalHit) {
		let damage = user.volatile.lastDamageThisTurn;
		if (!damage) return 0;
		if (damage.moveClass !== DamageClass.Physical) return 0;
		if (damage.source.side !== targetPosition.side || damage.source.slot !== targetPosition.slot) {
			return 0;
		}
		return damage.amount * 2;
	}

	let fixedDamageTargetHPGap = context.findEffect(effects, "fixed-damage-target-hp-gap");
	if (fixedDamageTargetHPGap) {
		return Math.max(0, context.getRemainingHP(target) - context.getRemainingHP(user));
	}

	let effectiveness = context.getTypeEffectiveness(target, move);
	return calculateDamage(context, user, target, targetPosition, move, effectiveness, events);
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
	let damage = getBaseDamage(context, user, target, move);
	damage = Math.floor(damage * context.getStabModifier(user, move));

	if (effectiveness !== 1) {
		events.push({ type: "effectiveness", target: targetPosition, effectiveness });
	}

	if (effectiveness === 2) damage = Math.floor(damage * 2);
	if (effectiveness === 0.5) damage = Math.floor(damage * 0.5);
	if (effectiveness === 0) damage = 0;

	if (context.random() < context.getCriticalHitChance(user)) {
		let targetSide = context.getCombatantSide(target);
		if (context.state.sides[targetSide]!.effects.luckyChantTurns === 0) {
			damage = Math.floor(damage * 1.5);
			events.push({ type: "critical-hit", target: targetPosition });
		}
	}

	return Math.floor(damage * ((85 + Math.floor(context.random() * 16)) / 100));
}

/** Computes pre-modifier base damage from stats, power, and field protections. */
function getBaseDamage(
	context: DamageSystemContext,
	user: CombatantState,
	target: CombatantState,
	move: Move,
): number {
	let power = getMovePower(context, user, target, move);
	let attackStat =
		move.damageClass === DamageClass.Physical
			? Math.floor(
					getCreatureStat(context.gameData, user.creature, Stat.Attack) *
						context.getStageModifier(user.statStages[Stat.Attack]),
				)
			: Math.floor(
					getCreatureStat(context.gameData, user.creature, Stat.SpecialAttack) *
						context.getStageModifier(user.statStages[Stat.SpecialAttack]),
				);
	let defenseStat =
		move.damageClass === DamageClass.Physical
			? Math.floor(
					getCreatureStat(context.gameData, target.creature, Stat.Defense) *
						context.getStageModifier(target.statStages[Stat.Defense]),
				)
			: Math.floor(
					getCreatureStat(context.gameData, target.creature, Stat.SpecialDefense) *
						context.getStageModifier(target.statStages[Stat.SpecialDefense]),
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

	if (
		move.damageClass === DamageClass.Physical &&
		context.state.sides[targetSide]!.effects.reflectTurns > 0
	) {
		return Math.floor(baseDamage * 0.5);
	}

	if (
		move.damageClass === DamageClass.Special &&
		context.state.sides[targetSide]!.effects.lightScreenTurns > 0
	) {
		return Math.floor(baseDamage * 0.5);
	}

	if (context.state.field.weather === "sun") {
		if (move.type === "fire") return Math.floor(baseDamage * 1.5);
		if (move.type === "water") return Math.floor(baseDamage * 0.5);
	}

	if (context.state.field.weather === "rain") {
		if (move.type === "water") return Math.floor(baseDamage * 1.5);
		if (move.type === "fire") return Math.floor(baseDamage * 0.5);
	}

	if (context.state.field.terrain === "electric" && move.type === "electric") {
		return Math.floor(baseDamage * 1.3);
	}

	if (context.state.field.terrain === "grassy" && move.type === "grass") {
		return Math.floor(baseDamage * 1.3);
	}

	if (context.state.field.terrain === "psychic" && move.type === "psychic") {
		return Math.floor(baseDamage * 1.3);
	}

	if (context.state.field.terrain === "misty" && move.type === "dragon") {
		return Math.floor(baseDamage * 0.5);
	}

	return baseDamage;
}

/** Resolves dynamic power rules before the normal base-damage formula runs. */
function getMovePower(
	context: DamageSystemContext,
	user: CombatantState,
	target: CombatantState,
	move: Move,
): number {
	let effects = context.flattenEffects(move.effect);

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
