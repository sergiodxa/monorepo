/**
 * Coordinates roster-related battle operations for active and reserve combatants.
 *
 * This module centralizes the logic that evaluates switch actions, replacement prompts,
 * and roster availability checks so the battle engine can keep team state consistent
 * while resolving turn flow.
 *
 * It focuses on the rules for moving creatures between active slots and reserve slots,
 * gathering the events that result from those transitions, and exposing small helpers
 * that other battle systems can use without duplicating roster bookkeeping logic.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type {
	BattleEvent,
	BattlePosition,
	BattleState,
	ReplacementCommand,
	ReplacementInput,
	ReplacementSelection,
} from "../battle";
import type { CombatantState } from "../combatant-state";

import type { TurnAction } from "./turn-order";

/** Provides state and callbacks for extracted switch and roster helpers. */
export interface RosterSystemContext {
	state: BattleState;
	getActiveCombatant(
		position: BattlePosition,
	): BattleState["sides"][number]["active"][number] | null;
	clearActiveCombatant(position: BattlePosition): void;
	isCombatantFainted(combatant: CombatantState): boolean;
	resetSwitchVolatiles(combatant: CombatantState): void;
	applySwitchInHazards(position: BattlePosition, combatant: CombatantState): BattleEvent[];
	applyHealingWish(
		combatant: CombatantState,
		sideIndex: number,
		position: BattlePosition,
	): BattleEvent[];
	activateReplacement(
		sideIndex: number,
		slotIndex: number,
		teamIndex: number,
		creatureIndex: number,
	): void;
	forfeitSide(sideIndex: number): void;
}

/** Resolves a manual switch action and returns the emitted switch-side events. */
export function resolveSwitchAction(
	context: RosterSystemContext,
	action: TurnAction,
): BattleEvent[] {
	if (action.command.type !== "switch") return [];
	let active = context.getActiveCombatant(action.userPosition);
	if (active === null) return [];
	let side = context.state.sides[action.userPosition.side]!;
	let replacement = side.teams[active.teamIndex]!.creatures[action.command.creature];
	if (!replacement) return [];

	context.resetSwitchVolatiles(active.combatant);
	side.active[action.userPosition.slot] = {
		teamIndex: active.teamIndex,
		creatureIndex: action.command.creature,
		combatant: replacement,
	};

	let events: BattleEvent[] = [
		{ type: "creature-switched", target: action.userPosition, creature: action.command.creature },
	];

	for (let event of context.applySwitchInHazards(action.userPosition, replacement)) {
		events.push(event);
	}

	for (let event of context.applyHealingWish(
		replacement,
		action.userPosition.side,
		action.userPosition,
	)) {
		events.push(event);
	}

	if (context.isCombatantFainted(replacement)) {
		context.clearActiveCombatant(action.userPosition);
		events.push({ type: "creature-fainted", target: action.userPosition });
	}

	return events;
}

/** Collects open replacement requests after refreshing elimination flags for one side. */
export function collectReplacementRequests(
	state: BattleState,
	sideIndex: number,
	isCombatantFainted: (combatant: CombatantState) => boolean,
): ReplacementSelection[] {
	let side = state.sides[sideIndex]!;
	let requests: ReplacementSelection[] = [];

	for (let teamIndex = 0; teamIndex < side.teams.length; teamIndex += 1) {
		if (teamHasRemainingPresence(state, sideIndex, teamIndex, isCombatantFainted) === false) {
			side.teams[teamIndex]!.eliminated = true;
		}
	}

	for (let slotIndex = 0; slotIndex < side.active.length; slotIndex += 1) {
		if (side.active[slotIndex] !== null) continue;

		let teamIndex = side.slotTeams[slotIndex]!;
		let team = side.teams[teamIndex]!;
		if (team.eliminated) continue;

		let choices = getAvailableReplacementChoices(state, sideIndex, teamIndex, isCombatantFainted);
		if (choices.length === 0) continue;

		requests.push({ side: sideIndex, slot: slotIndex, team: teamIndex, choices });
	}

	return requests;
}

/** Returns the available non-fainted bench choices for one team. */
export function getAvailableReplacementChoices(
	state: BattleState,
	sideIndex: number,
	teamIndex: number,
	isCombatantFainted: (combatant: CombatantState) => boolean,
): number[] {
	let side = state.sides[sideIndex]!;
	let choices: number[] = [];

	for (let [creatureIndex, combatant] of side.teams[teamIndex]!.creatures.entries()) {
		if (isCombatantFainted(combatant)) continue;
		if (isCreatureCurrentlyActive(side, teamIndex, creatureIndex)) continue;
		choices.push(creatureIndex);
	}

	return choices;
}

/** Validates and applies replacement commands against the current pending requests. */
export function applyReplacementCommands(
	context: RosterSystemContext,
	pendingReplacementRequests: ReplacementSelection[],
	commands: ReplacementInput,
) {
	if (commands.length !== pendingReplacementRequests.length) {
		throw new RangeError(
			"Replacement command count must match the number of replacement requests.",
		);
	}

	for (let [index, request] of pendingReplacementRequests.entries()) {
		let command = commands[index];
		if (!command || (command.type !== "replace" && command.type !== "leave-battle")) {
			throw new TypeError(
				"Replacement input must contain only replacement or leave-battle commands.",
			);
		}

		if (command.target.side !== request.side || command.target.slot !== request.slot) {
			throw new RangeError("Replacement command target does not match the requested slot.");
		}

		if (command.type === "leave-battle") {
			context.forfeitSide(request.side);
			continue;
		}

		applyReplacementCommand(context, request, command);
	}
}

/** Computes which side, if any, still has remaining contenders. */
export function getWinnerSide(
	state: BattleState,
	isCombatantFainted: (combatant: CombatantState) => boolean,
): number | null {
	let side0Alive = sideHasRemainingContenders(state, 0, isCombatantFainted);
	let side1Alive = sideHasRemainingContenders(state, 1, isCombatantFainted);

	if (side0Alive === side1Alive) return null;
	return side0Alive ? 0 : 1;
}

/** Applies one validated replacement choice for a specific empty slot request. */
function applyReplacementCommand(
	context: RosterSystemContext,
	request: ReplacementSelection,
	command: ReplacementCommand,
) {
	if (request.choices.includes(command.creature) === false) {
		throw new RangeError("Replacement command selected a creature that is not available.");
	}

	context.activateReplacement(request.side, request.slot, request.team, command.creature);
}

/** Returns whether a side still has any active or bench contender left. */
function sideHasRemainingContenders(
	state: BattleState,
	sideIndex: number,
	isCombatantFainted: (combatant: CombatantState) => boolean,
): boolean {
	let side = state.sides[sideIndex]!;

	for (let teamIndex = 0; teamIndex < side.teams.length; teamIndex += 1) {
		if (side.teams[teamIndex]!.eliminated) continue;
		if (teamHasRemainingPresence(state, sideIndex, teamIndex, isCombatantFainted)) return true;
	}

	return false;
}

/** Returns whether one team still has any active slot or bench creature remaining. */
function teamHasRemainingPresence(
	state: BattleState,
	sideIndex: number,
	teamIndex: number,
	isCombatantFainted: (combatant: CombatantState) => boolean,
): boolean {
	let side = state.sides[sideIndex]!;

	for (let active of side.active) {
		if (active?.teamIndex === teamIndex) return true;
	}

	for (let [creatureIndex, combatant] of side.teams[teamIndex]!.creatures.entries()) {
		if (isCreatureCurrentlyActive(side, teamIndex, creatureIndex)) continue;
		if (isCombatantFainted(combatant)) continue;
		return true;
	}

	return false;
}

/** Returns whether one specific creature index already occupies an active slot. */
function isCreatureCurrentlyActive(
	side: BattleState["sides"][number],
	teamIndex: number,
	creatureIndex: number,
): boolean {
	return side.active.some(
		(active) => active?.teamIndex === teamIndex && active.creatureIndex === creatureIndex,
	);
}
