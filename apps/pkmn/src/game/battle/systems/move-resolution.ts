/**
 * Coordinates move resolution within the battle systems layer by defining the
 * contracts and helpers needed to evaluate one action from setup through
 * aftermath. It centralizes the logic that turns a chosen move and its effects
 * into state changes and emitted battle events while staying decoupled from any
 * single battle controller implementation.
 *
 * This module exists as the integration point for hit checks, damage handling,
 * effect processing, secondary outcomes, and combatant cleanup during move
 * execution. It keeps the resolution flow explicit and reusable so the broader
 * battle engine can delegate move processing to a focused system with clear
 * inputs, outputs, and extension points.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Move, MoveEffect } from "~/game/data/move";

import { DamageClass } from "~/game/data/move";
import { Type } from "~/game/data/type";

import type { BattleEvent, BattlePosition, FightCommand } from "../battle";
import type { CombatantState } from "../combatant-state";

/** Collects the battle callbacks needed to resolve one move without owning the whole battle class. */
export interface MoveResolutionContext {
	random(): number;
	flattenEffects(effect: MoveEffect): MoveEffect[];
	findEffect<TKind extends MoveEffect["kind"]>(
		effects: MoveEffect[],
		kind: TKind,
	): Extract<MoveEffect, { kind: TKind }> | null;
	resolveBeforeMove(
		user: CombatantState,
		userPosition: BattlePosition,
		move: Move,
		command: FightCommand,
		events: BattleEvent[],
	): boolean;
	resolveEffect(
		user: CombatantState,
		userPosition: BattlePosition,
		target: CombatantState,
		targetPosition: BattlePosition,
		move: Move,
		effect: MoveEffect,
	): BattleEvent[];
	applyChargeEffect(user: CombatantState, effect: Extract<MoveEffect, { kind: "charge" }>): void;
	resolveReactiveFailure(
		user: CombatantState,
		userPosition: BattlePosition,
		effects: MoveEffect[],
		events: BattleEvent[],
	): boolean;
	resolveCurse(
		user: CombatantState,
		userPosition: BattlePosition,
		target: CombatantState,
		targetPosition: BattlePosition,
		effects: MoveEffect[],
		events: BattleEvent[],
	): boolean;
	applyBellyDrum(
		user: CombatantState,
		userPosition: BattlePosition,
		effects: MoveEffect[],
		events: BattleEvent[],
	): void;
	moveCanConnect(user: CombatantState, target: CombatantState, move: Move): boolean;
	applyCrashOnMiss(
		user: CombatantState,
		userPosition: BattlePosition,
		effects: MoveEffect[],
		events: BattleEvent[],
	): void;
	isCombatantFainted(combatant: CombatantState): boolean;
	clearActiveCombatant(position: BattlePosition): void;
	moveDealsDamage(move: Move, effects: MoveEffect[]): boolean;
	applyMoveDamage(
		user: CombatantState,
		userPosition: BattlePosition,
		target: CombatantState,
		targetPosition: BattlePosition,
		move: Move,
		effects: MoveEffect[],
		events: BattleEvent[],
	): number;
	applyDrainHealing(
		user: CombatantState,
		userPosition: BattlePosition,
		target: CombatantState,
		effects: MoveEffect[],
		damageDealt: number,
		events: BattleEvent[],
	): void;
	applyRecoilDamage(
		user: CombatantState,
		userPosition: BattlePosition,
		effects: MoveEffect[],
		damageDealt: number,
		events: BattleEvent[],
	): void;
	applySelfDestruct(
		user: CombatantState,
		userPosition: BattlePosition,
		effects: MoveEffect[],
		events: BattleEvent[],
	): void;
	applyReactiveEffectsAfterDamage(
		user: CombatantState,
		userPosition: BattlePosition,
		target: CombatantState,
		targetPosition: BattlePosition,
		effects: MoveEffect[],
		damageDealt: number,
		events: BattleEvent[],
	): void;
	isEffectBlockedByProtect(effect: MoveEffect): boolean;
	applyHealingWishSelfKO(
		user: CombatantState,
		userPosition: BattlePosition,
		effects: MoveEffect[],
		events: BattleEvent[],
	): void;
	scheduleDelayedAttacks(
		user: CombatantState,
		userPosition: BattlePosition,
		targetPosition: BattlePosition,
		moveId: string,
		effects: MoveEffect[],
	): void;
	applyRampageState(user: CombatantState, effects: MoveEffect[], moveSlot: 0 | 1 | 2 | 3): void;
	applySwitchSelf(
		userPosition: BattlePosition,
		command: FightCommand,
		effects: MoveEffect[],
		events: BattleEvent[],
	): void;
	applyForceSwitchTarget(
		targetPosition: BattlePosition,
		target: CombatantState,
		move: Move,
		effects: MoveEffect[],
		damageDealt: number,
		events: BattleEvent[],
	): void;
}

/**
 * Resolves one submitted move into the exact ordered events expected by battle orchestration.
 *
 * The sequence is intentionally centralized here: pre-move locks and failures, charge handling, hit checks,
 * direct damage, follow-up effects, forced switching, and knockout cleanup. Keeping that order in one place
 * makes `Battle` smaller without changing the event stream that tests treat as behavior.
 */
export function resolveMoveEvents(
	context: MoveResolutionContext,
	user: CombatantState,
	userPosition: BattlePosition,
	command: FightCommand,
	targetPosition: BattlePosition,
	target: CombatantState,
	move: Move,
	moveId: string,
	isChargingRelease: boolean,
): BattleEvent[] {
	let events: BattleEvent[] = [];
	let effects = context.flattenEffects(move.effect);

	if (context.resolveBeforeMove(user, userPosition, move, command, events)) {
		return events;
	}

	events.push({
		type: "move-used",
		user: userPosition,
		moveId,
		target: targetPosition,
	});

	let chargeEffect = context.findEffect(effects, "charge");
	if (chargeEffect?.kind === "charge" && isChargingRelease === false) {
		context.applyChargeEffect(user, chargeEffect);
		user.volatile.chargingMoveId = moveId;
		user.volatile.actedThisBattle = true;
		return events;
	}

	if (chargeEffect?.kind === "charge") {
		user.volatile.charging = false;
		user.volatile.invulnerable = false;
		user.volatile.chargingMoveId = null;
	}

	if (context.resolveReactiveFailure(user, userPosition, effects, events)) {
		return events;
	}

	if (context.resolveCurse(user, userPosition, target, targetPosition, effects, events)) {
		user.volatile.lastMoveSlot = command.move;
		user.volatile.actedThisBattle = true;
		return events;
	}

	context.applyBellyDrum(user, userPosition, effects, events);

	if (context.moveCanConnect(user, target, move) === false) {
		context.applyCrashOnMiss(user, userPosition, effects, events);
		user.volatile.lastMoveSlot = command.move;
		user.volatile.actedThisBattle = true;
		if (context.isCombatantFainted(user)) {
			context.clearActiveCombatant(userPosition);
			events.push({ type: "creature-fainted", target: userPosition });
		}
		events.push({ type: "move-missed", user: userPosition, target: targetPosition });
		return events;
	}

	for (let effect of effects) {
		if (effect.kind !== "break-protect") continue;
		for (let event of context.resolveEffect(
			user,
			userPosition,
			target,
			targetPosition,
			move,
			effect,
		)) {
			events.push(event);
		}
	}

	let damageDealt = 0;
	if (context.moveDealsDamage(move, effects) && target.volatile.protecting === false) {
		damageDealt = context.applyMoveDamage(
			user,
			userPosition,
			target,
			targetPosition,
			move,
			effects,
			events,
		);
		context.applyDrainHealing(user, userPosition, target, effects, damageDealt, events);
		context.applyRecoilDamage(user, userPosition, effects, damageDealt, events);
		context.applySelfDestruct(user, userPosition, effects, events);
		context.applyReactiveEffectsAfterDamage(
			user,
			userPosition,
			target,
			targetPosition,
			effects,
			damageDealt,
			events,
		);
	}

	for (let effect of effects) {
		if (effect.kind === "break-protect") continue;
		if (target.volatile.protecting && context.isEffectBlockedByProtect(effect)) continue;
		for (let event of context.resolveEffect(
			user,
			userPosition,
			target,
			targetPosition,
			move,
			effect,
		)) {
			events.push(event);
		}
	}

	context.applyHealingWishSelfKO(user, userPosition, effects, events);
	context.scheduleDelayedAttacks(user, userPosition, targetPosition, moveId, effects);

	user.volatile.lastMoveSlot = command.move;
	user.volatile.actedThisBattle = true;
	if (!context.findEffect(effects, "destiny-bond")) {
		user.volatile.destinyBonded = false;
	}
	if (move.damageClass !== DamageClass.Status && move.type === Type.ELECTRIC) {
		user.volatile.chargedElectric = false;
	}
	context.applyRampageState(user, effects, command.move);
	context.applySwitchSelf(userPosition, command, effects, events);
	context.applyForceSwitchTarget(targetPosition, target, move, effects, damageDealt, events);

	if (context.isCombatantFainted(user)) {
		context.clearActiveCombatant(userPosition);
		events.push({ type: "creature-fainted", target: userPosition });
	}

	if (context.isCombatantFainted(target)) {
		context.clearActiveCombatant(targetPosition);
		events.push({ type: "creature-fainted", target: targetPosition });
	}

	return events;
}
