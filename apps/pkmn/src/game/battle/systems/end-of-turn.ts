/**
 * Coordinates the end-of-turn battle systems for this module's portion of the combat engine.
 * It defines the shared context required by these systems and exposes the functions that resolve
 * delayed actions, residual effects, and the final reconciliation that prepares the next turn.
 *
 * This module focuses on between-turn state transitions rather than turn input or move selection.
 * Its responsibility is to keep end-of-turn processing ordered, deterministic, and isolated so the
 * wider battle flow can advance with a consistent view of combatant state and pending replacements.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { GameData } from "~/game/data/game-data";
import type { Move, MoveEffect } from "~/game/data/move";

import { Stat } from "~/game/data/stat";
import { State } from "~/game/data/status";
import { Effectiveness, Type } from "~/game/data/type";

import type { BattleEvent, BattlePosition, BattleState, ReplacementSelection } from "../battle";
import type { CombatantState } from "../combatant-state";

import { getCreatureSpecies, getCreatureStat } from "../mechanics";

/** Supplies the state and callbacks needed to resolve end-of-turn battle systems. */
export interface EndOfTurnContext {
	state: BattleState;
	gameData: GameData;
	random(): number;
	flattenEffects(effect: MoveEffect): MoveEffect[];
	findEffect<TKind extends MoveEffect["kind"]>(
		effects: MoveEffect[],
		kind: TKind,
	): Extract<MoveEffect, { kind: TKind }> | null;
	getActiveCombatant(
		position: BattlePosition,
	): BattleState["sides"][number]["active"][number] | null;
	clearActiveCombatant(position: BattlePosition): void;
	applyMoveDamage(
		user: CombatantState,
		userPosition: BattlePosition,
		target: CombatantState,
		targetPosition: BattlePosition,
		move: Move,
		effects: MoveEffect[],
		events: BattleEvent[],
	): number;
	applyDamage(
		combatant: CombatantState,
		position: BattlePosition,
		damage: number,
		events: BattleEvent[],
	): number;
	healSeedSource(sourceSide: number | null, amount: number, events: BattleEvent[]): void;
	getRemainingHP(combatant: CombatantState): number;
	getTypeEffectiveness(target: CombatantState, move: Move): Effectiveness;
	isGrounded(combatant: CombatantState): boolean;
	isCombatantFainted(combatant: CombatantState): boolean;
	reconcileSideState(sideIndex: number): ReplacementSelection[];
	updateWinnerSide(): void;
}

/**
 * Applies the full between-turn reconciliation pipeline in battle order.
 *
 * The order matters: delayed attacks can create new knockouts before residual effects run, residuals can
 * create replacement requests, and timer decay should happen only after all HP changes have resolved.
 */
export function reconcileAfterTurn(
	context: EndOfTurnContext,
	pendingReplacementRequests: ReplacementSelection[],
): BattleEvent[] {
	let events: BattleEvent[] = [];
	for (let event of applyDelayedAttacks(context)) events.push(event);
	for (let event of applyEndOfTurnEffects(context)) events.push(event);
	tickTurnEffects(context.state);
	pendingReplacementRequests.length = 0;
	for (let request of context.reconcileSideState(0)) pendingReplacementRequests.push(request);
	for (let request of context.reconcileSideState(1)) pendingReplacementRequests.push(request);
	context.updateWinnerSide();
	return events;
}

/**
 * Applies delayed attacks that mature between turns and trims the remaining queue.
 *
 * These effects intentionally resolve outside the normal action order but before residual damage so they see
 * the final board from the turn that just ended.
 */
export function applyDelayedAttacks(context: EndOfTurnContext): BattleEvent[] {
	let events: BattleEvent[] = [];
	let remaining = [] as BattleState["delayedAttacks"];

	for (let delayedAttack of context.state.delayedAttacks) {
		delayedAttack.turnsRemaining -= 1;
		if (delayedAttack.turnsRemaining > 0) {
			remaining.push(delayedAttack);
			continue;
		}
		if (delayedAttack.kind !== "future-sight") continue;
		let target = context.getActiveCombatant(delayedAttack.target);
		if (!target) continue;
		let move = context.gameData.moves.get(delayedAttack.moveId);
		if (!move) continue;
		let effects = context.flattenEffects(move.effect);
		context.applyMoveDamage(
			delayedAttack.user,
			delayedAttack.source,
			target.combatant,
			delayedAttack.target,
			move,
			effects,
			events,
		);
		if (context.isCombatantFainted(target.combatant)) {
			context.clearActiveCombatant(delayedAttack.target);
			events.push({ type: "creature-fainted", target: delayedAttack.target });
		}
	}

	context.state.delayedAttacks = remaining;
	return events;
}

/**
 * Queues a delayed attack for later reconciliation.
 *
 * Scheduling stays separate from execution so move resolution remains synchronous while future-hit style
 * effects can still reuse the standard damage pipeline when they finally land.
 */
export function scheduleDelayedAttacks(
	context: Pick<EndOfTurnContext, "state" | "findEffect">,
	user: CombatantState,
	userPosition: BattlePosition,
	targetPosition: BattlePosition,
	moveId: string,
	effects: MoveEffect[],
) {
	let delayedAttack = context.findEffect(effects, "delayed-attack");
	if (!delayedAttack) return;
	context.state.delayedAttacks.push({
		kind: "future-sight",
		moveId,
		user,
		source: userPosition,
		target: targetPosition,
		turnsRemaining: delayedAttack.turns,
	});
}

/**
 * Applies residual status, terrain, weather, and volatile effects to every active combatant.
 *
 * The walk happens over active slots rather than whole rosters because most residual effects only apply on
 * the field, and each slot needs immediate knockout cleanup before later effects continue.
 */
export function applyEndOfTurnEffects(context: EndOfTurnContext): BattleEvent[] {
	let events: BattleEvent[] = [];

	for (let [sideIndex, side] of context.state.sides.entries()) {
		for (let [slotIndex, active] of side.active.entries()) {
			if (!active) continue;
			let position = { side: sideIndex, slot: slotIndex };
			let combatant = active.combatant;
			let maxHP = getCreatureStat(context.gameData, combatant.creature, Stat.HP);

			switch (combatant.creature.status.state) {
				case State.Burned:
				case State.Poisoned: {
					let damage =
						combatant.creature.status.poison === "escalating"
							? Math.max(1, Math.floor((maxHP * combatant.volatile.escalatingPoisonStage) / 16))
							: Math.max(1, Math.floor(maxHP / 8));
					context.applyDamage(combatant, position, damage, events);
					if (
						combatant.creature.status.state === State.Poisoned &&
						combatant.creature.status.poison === "escalating" &&
						combatant.volatile.escalatingPoisonStage > 0
					) {
						combatant.volatile.escalatingPoisonStage += 1;
					}
					break;
				}
			}

			if (combatant.volatile.seeded) {
				let drained = context.applyDamage(
					combatant,
					position,
					Math.max(1, Math.floor(maxHP / 8)),
					events,
				);
				context.healSeedSource(combatant.volatile.seededBy, drained, events);
			}

			if (combatant.volatile.partiallyTrappedTurns > 0) {
				combatant.volatile.partiallyTrappedTurns -= 1;
				context.applyDamage(combatant, position, Math.max(1, Math.floor(maxHP / 8)), events);
			}

			applyFlatHealing(
				context,
				combatant,
				position,
				maxHP,
				events,
				combatant.volatile.aquaRing,
				16,
			);
			if (combatant.volatile.cursed) {
				context.applyDamage(combatant, position, Math.max(1, Math.floor(maxHP / 4)), events);
			}
			applyFlatHealing(
				context,
				combatant,
				position,
				maxHP,
				events,
				context.state.field.terrain === "grassy" && context.isGrounded(combatant),
				16,
			);

			if (context.state.field.weather === "sand") {
				let types = getCreatureSpecies(context.gameData, combatant.creature).types;
				if (
					types.includes(Type.ROCK) === false &&
					types.includes(Type.GROUND) === false &&
					types.includes(Type.STEEL) === false
				) {
					context.applyDamage(combatant, position, Math.max(1, Math.floor(maxHP / 16)), events);
				}
			}

			if (context.state.field.weather === "hail") {
				let types = getCreatureSpecies(context.gameData, combatant.creature).types;
				if (types.includes(Type.ICE) === false) {
					context.applyDamage(combatant, position, Math.max(1, Math.floor(maxHP / 16)), events);
				}
			}

			if (context.isCombatantFainted(combatant)) {
				context.clearActiveCombatant(position);
				events.push({ type: "creature-fainted", target: position });
			}
		}
	}

	return events;
}

/**
 * Clears one-turn flags and decrements timers after all between-turn HP changes have finished.
 *
 * Doing timer decay last preserves guarantees like protection lasting for the whole turn and residual logic
 * observing the durations that were active while the turn resolved.
 */
export function tickTurnEffects(state: BattleState) {
	for (let side of state.sides) {
		side.followMeUserSlot = null;
		side.effects.reflectTurns = Math.max(0, side.effects.reflectTurns - 1);
		side.effects.lightScreenTurns = Math.max(0, side.effects.lightScreenTurns - 1);
		side.effects.tailwindTurns = Math.max(0, side.effects.tailwindTurns - 1);
		side.effects.safeguardTurns = Math.max(0, side.effects.safeguardTurns - 1);
		side.effects.mistTurns = Math.max(0, side.effects.mistTurns - 1);
		side.effects.luckyChantTurns = Math.max(0, side.effects.luckyChantTurns - 1);

		for (let active of side.active) {
			if (!active) continue;
			active.combatant.volatile.lastDamageThisTurn = null;
			active.combatant.volatile.flinched = false;
			if (active.combatant.volatile.successfulProtectionThisTurn === false) {
				active.combatant.volatile.protectionSuccessStreak = 0;
			}
			active.combatant.volatile.successfulProtectionThisTurn = false;
			active.combatant.volatile.protecting = false;
			active.combatant.volatile.enduring = false;
			active.combatant.volatile.tauntedTurns = Math.max(
				0,
				active.combatant.volatile.tauntedTurns - 1,
			);
			active.combatant.volatile.encoreTurns = Math.max(
				0,
				active.combatant.volatile.encoreTurns - 1,
			);
			active.combatant.volatile.disableTurns = Math.max(
				0,
				active.combatant.volatile.disableTurns - 1,
			);
			if (active.combatant.volatile.disableTurns === 0) {
				active.combatant.volatile.disabledMoveSlot = null;
			}
			if (
				active.combatant.volatile.partiallyTrappedTurns === 0 &&
				active.combatant.volatile.partialTrapSourceSide !== null
			) {
				active.combatant.volatile.trapped = false;
				active.combatant.volatile.partialTrapSourceSide = null;
			}
		}
	}

	state.field.weatherTurns = Math.max(0, state.field.weatherTurns - 1);
	if (state.field.weatherTurns === 0) state.field.weather = null;
	state.field.terrainTurns = Math.max(0, state.field.terrainTurns - 1);
	if (state.field.terrainTurns === 0) state.field.terrain = null;
	state.field.trickRoomTurns = Math.max(0, state.field.trickRoomTurns - 1);
	state.field.gravityTurns = Math.max(0, state.field.gravityTurns - 1);
	state.field.wonderRoomTurns = Math.max(0, state.field.wonderRoomTurns - 1);
	state.field.magicRoomTurns = Math.max(0, state.field.magicRoomTurns - 1);
}

/**
 * Applies one flat healing pulse and emits a synthetic HP update if HP changed.
 *
 * Residual healing reuses the damage event shape so the rest of the runtime can treat HP movement as one
 * ordered stream regardless of whether HP was lost or restored.
 */
function applyFlatHealing(
	context: EndOfTurnContext,
	combatant: CombatantState,
	position: BattlePosition,
	maxHP: number,
	events: BattleEvent[],
	shouldHeal: boolean,
	divisor: number,
) {
	if (!shouldHeal) return;
	let previous = combatant.creature.status.damage;
	combatant.creature.status.damage = Math.max(
		0,
		previous - Math.max(1, Math.floor(maxHP / divisor)),
	);
	if (previous === combatant.creature.status.damage) return;

	events.push({
		type: "damage-dealt",
		target: position,
		damage: 0,
		remainingHP: context.getRemainingHP(combatant),
	});
}
