/**
 * Resolves how one battle turn is transformed from validated player commands
 * into a deterministic sequence of executable actions. This module centralizes
 * the ordering rules that decide which commands become actionable entries and
 * how those entries are ranked against each other before turn resolution
 * continues.
 *
 * It also defines the shared contracts used by the turn-ordering step so the
 * surrounding battle systems can provide state, lookups, and rule callbacks
 * without coupling this logic to any specific content set or presentation
 * layer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { GameData } from "~/game/data/game-data";
import type { Move } from "~/game/data/move";

import { DamageClass } from "~/game/data/move";

import type {
	BattleActiveSlotState,
	BattlePosition,
	BattleState,
	FightCommand,
	TurnCommand,
} from "../battle";
import type { CombatantState } from "../combatant-state";

const MOVE_SLOTS = [0, 1, 2, 3] as const;

const FALLBACK_MOVE_ID = "fallback";

/**
 * Sentinel move type with no entry in any type chart. The effectiveness lookup
 * treats a missing attacking-type entry as neutral (×1), so the fallback move
 * is never zeroed by type immunity the way a `normal`-typed move would be.
 */
const TYPELESS = "typeless";

const FALLBACK_MOVE: Move = {
	type: TYPELESS,
	damageClass: DamageClass.Physical,
	power: 50,
	accuracy: 0,
	pp: 0,
	effect: { kind: "recoil", ratio: 0.25 },
};

/** Captures one validated command with its resolved move and ordering data. */
export interface TurnAction {
	user: CombatantState;
	userPosition: BattlePosition;
	command: TurnCommand;
	moveId: string | null;
	move: Move | null;
	priority: number;
	speed: number;
	isChargingRelease: boolean;
}

/** Provides the battle state and callbacks needed to build ordered actions. */
export interface TurnOrderingContext {
	state: BattleState;
	gameData: GameData;
	random(): number;
	getActiveCombatant(position: BattlePosition): BattleActiveSlotState | null;
	canCombatantLeaveBattle(position: BattlePosition, combatant: CombatantState): boolean;
	canSwitchCombatant(
		position: BattlePosition,
		active: BattleActiveSlotState,
		creatureIndex: number,
	): boolean;
	getCombatantSpeed(position: BattlePosition, combatant: CombatantState): number;
	getMovePriority(move: Move): number;
}

/** Builds and sorts one turn's actionable commands using the current battle state. */
export function getTurnActions(
	context: TurnOrderingContext,
	requests: BattlePosition[],
	commands: TurnCommand[],
): TurnAction[] {
	if (requests.length !== commands.length) {
		throw new RangeError("Turn command count must match the number of requested active slots.");
	}

	let actions: Array<TurnAction & { turnOrderRoll: number }> = [];

	for (let [index, request] of requests.entries()) {
		let command = commands[index];
		if (!command) continue;

		let active = context.getActiveCombatant(request);
		if (active === null) continue;

		if (command.type === "leave-battle") {
			if (context.canCombatantLeaveBattle(request, active.combatant) === false) continue;

			actions.push({
				turnOrderRoll: context.random(),
				user: active.combatant,
				userPosition: request,
				command,
				moveId: null,
				move: null,
				priority: Number.POSITIVE_INFINITY,
				speed: Number.POSITIVE_INFINITY,
				isChargingRelease: false,
			});
			continue;
		}

		if (command.type === "use-item") {
			// Using an item resolves at the top of the turn regardless of speed.
			actions.push({
				turnOrderRoll: context.random(),
				user: active.combatant,
				userPosition: request,
				command,
				moveId: null,
				move: null,
				priority: Number.POSITIVE_INFINITY,
				speed: Number.POSITIVE_INFINITY,
				isChargingRelease: false,
			});
			continue;
		}

		if (command.type === "switch") {
			if (context.canSwitchCombatant(request, active, command.creature) === false) continue;

			actions.push({
				turnOrderRoll: context.random(),
				user: active.combatant,
				userPosition: request,
				command,
				moveId: null,
				move: null,
				priority: 6,
				speed: context.getCombatantSpeed(request, active.combatant),
				isChargingRelease: false,
			});
			continue;
		}

		if (command.type !== "fight") continue;

		let chargingMoveId = active.combatant.volatile.chargingMoveId;
		if (chargingMoveId !== null) {
			let move = context.gameData.moves.get(chargingMoveId);
			if (!move) throw new ReferenceError(`Move ${chargingMoveId} not found in game data.`);

			actions.push({
				turnOrderRoll: context.random(),
				user: active.combatant,
				userPosition: request,
				command,
				moveId: chargingMoveId,
				move,
				priority: context.getMovePriority(move),
				speed: context.getCombatantSpeed(request, active.combatant),
				isChargingRelease: true,
			});
			continue;
		}

		command = resolveForcedMoveSelection(active.combatant, command);

		let moveId = active.combatant.creature.moveset[command.move];
		if (!moveId || canCommitMoveSlot(active.combatant, command.move) === false) {
			if (hasCommittedRegularMove(active.combatant)) continue;

			actions.push({
				turnOrderRoll: context.random(),
				user: active.combatant,
				userPosition: request,
				command,
				moveId: FALLBACK_MOVE_ID,
				move: FALLBACK_MOVE,
				priority: context.getMovePriority(FALLBACK_MOVE),
				speed: context.getCombatantSpeed(request, active.combatant),
				isChargingRelease: false,
			});
			continue;
		}

		active.combatant.creature.status.pp[command.move] -= 1;

		let move = context.gameData.moves.get(moveId);
		if (!move) throw new ReferenceError(`Move ${moveId} not found in game data.`);

		actions.push({
			turnOrderRoll: context.random(),
			user: active.combatant,
			userPosition: request,
			command,
			moveId,
			move,
			priority: context.getMovePriority(move),
			speed: context.getCombatantSpeed(request, active.combatant),
			isChargingRelease: false,
		});
	}

	actions.sort((left, right) => {
		if (left.priority !== right.priority) return right.priority - left.priority;
		if (left.speed !== right.speed) {
			if (context.state.field.trickRoomTurns > 0) return left.speed - right.speed;
			return right.speed - left.speed;
		}
		if (left.turnOrderRoll !== right.turnOrderRoll) {
			return right.turnOrderRoll - left.turnOrderRoll;
		}
		if (left.userPosition.side !== right.userPosition.side) {
			return left.userPosition.side - right.userPosition.side;
		}

		return left.userPosition.slot - right.userPosition.slot;
	});

	return actions;
}

/** Applies forced Encore and rampage move locking before move lookup. */
function resolveForcedMoveSelection(
	combatant: CombatantState,
	command: FightCommand,
): FightCommand {
	if (combatant.volatile.encoreTurns > 0 && combatant.volatile.encoredMoveSlot !== null) {
		command = {
			...command,
			move: combatant.volatile.encoredMoveSlot,
		};
	}

	if (combatant.volatile.rampageTurns > 0 && combatant.volatile.rampageMoveSlot !== null) {
		command = {
			...command,
			move: combatant.volatile.rampageMoveSlot,
		};
	}

	return command;
}

function canCommitMoveSlot(combatant: CombatantState, moveSlot: 0 | 1 | 2 | 3): boolean {
	return (
		combatant.creature.moveset[moveSlot] !== null && combatant.creature.status.pp[moveSlot] > 0
	);
}

function hasCommittedRegularMove(combatant: CombatantState): boolean {
	for (let moveSlot of MOVE_SLOTS) {
		if (canCommitMoveSlot(combatant, moveSlot)) return true;
	}

	return false;
}
