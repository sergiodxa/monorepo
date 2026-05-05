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

import type {
	BattleActiveSlotState,
	BattlePosition,
	BattleState,
	FightCommand,
	TurnCommand,
} from "../battle";
import type { CombatantState } from "../combatant-state";

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

	let actions: TurnAction[] = [];

	for (let [index, request] of requests.entries()) {
		let command = commands[index];
		if (!command) continue;

		let active = context.getActiveCombatant(request);
		if (active === null) continue;

		if (command.type === "leave-battle") {
			if (context.canCombatantLeaveBattle(request, active.combatant) === false) continue;

			actions.push({
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

		command = resolveForcedMoveSelection(active.combatant, command);

		let moveId = active.combatant.creature.moveset[command.move];
		if (!moveId) continue;
		let chargingMoveId = active.combatant.volatile.chargingMoveId;
		if (chargingMoveId !== null) moveId = chargingMoveId;

		let move = context.gameData.moves.get(moveId);
		if (!move) throw new ReferenceError(`Move ${moveId} not found in game data.`);

		actions.push({
			user: active.combatant,
			userPosition: request,
			command,
			moveId,
			move,
			priority: context.getMovePriority(move),
			speed: context.getCombatantSpeed(request, active.combatant),
			isChargingRelease: chargingMoveId !== null,
		});
	}

	actions.sort((left, right) => {
		if (left.priority !== right.priority) return right.priority - left.priority;
		if (left.speed !== right.speed) {
			if (context.state.field.trickRoomTurns > 0) return left.speed - right.speed;
			return right.speed - left.speed;
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
