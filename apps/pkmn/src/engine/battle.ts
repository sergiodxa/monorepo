import type { GameData } from "../domain/game-data";
import type {
	BattleStatStage,
	FieldEffectType,
	Move,
	MoveEffect,
	SideEffectType,
} from "../domain/move";

import { Class } from "../domain/move";
import { Stat } from "../domain/stat";
import { Effectiveness, Type } from "../domain/type";

import { createFieldEffectState, createSideEffectState } from "./battle-state";
import { CombatantState } from "./combatant-state";
import { Creature, State } from "./creature";
import { Effects } from "./effects";
import { getCreatureLevel, getCreatureSpecies, getCreatureStat } from "./mechanics";

const CRITICAL_HIT_CHANCE = 1 / 24;

interface TurnAction {
	user: CombatantState;
	userPosition: BattlePosition;
	command: TurnCommand;
	moveId: string | null;
	move: Move | null;
	priority: number;
	speed: number;
	isChargingRelease: boolean;
}

interface ReplacementSelection {
	side: number;
	slot: number;
	team: number;
	choices: number[];
}

/** Identifies one battle slot on a side. */
export interface BattlePosition {
	side: number;
	slot: number;
}

/** Selects a move for one active combatant. */
export interface FightCommand {
	type: "fight";
	move: 0 | 1 | 2 | 3;
	target: BattlePosition;
}

/** Switches one active combatant with a bench creature from the same team. */
export interface SwitchCommand {
	type: "switch";
	target: BattlePosition;
	creature: number;
}

/** Chooses a replacement creature for one empty slot. */
export interface ReplacementCommand {
	type: "replace";
	target: BattlePosition;
	creature: number;
}

/** Leaves the battle instead of filling a requested replacement slot. */
export interface LeaveReplacementCommand {
	type: "leave-battle";
	target: BattlePosition;
}

/** Attempts to leave the battle with one active combatant. */
export interface LeaveTurnCommand {
	type: "leave-battle";
}

type ReplacementInput = Array<ReplacementCommand | LeaveReplacementCommand>;

type BattleInput = TurnCommand[] | ReplacementInput;

/** A command submitted for one active combatant during a turn. */
export type TurnCommand = FightCommand | LeaveTurnCommand | SwitchCommand;

export namespace BattleEvent {
	/** Requests commands for every active combatant that can act this turn. */
	export interface TurnCommandsRequestedEvent {
		type: "request-turn-commands";
		requests: BattlePosition[];
	}

	/** Requests replacement choices for slots left empty after a turn. */
	export interface ReplacementsRequestedEvent {
		type: "request-replacements";
		requests: ReplacementSelection[];
	}

	/** Marks the beginning of the battle session. */
	export interface BattleStarted {
		type: "battle-started";
	}

	/** Marks the beginning of a new turn. */
	export interface TurnStarted {
		type: "turn-started";
		turn: number;
	}

	/** Reports one move being used against a target slot. */
	export interface MoveUsed {
		type: "move-used";
		user: BattlePosition;
		moveId: string;
		target: BattlePosition;
	}

	/** Reports a non-neutral type matchup. */
	export interface EffectivenessEvent {
		type: "effectiveness";
		target: BattlePosition;
		effectiveness: Effectiveness;
	}

	/** Reports a critical hit. */
	export interface CriticalHitEvent {
		type: "critical-hit";
		target: BattlePosition;
	}

	/** Reports HP loss after damage resolves. */
	export interface DamageDealtEvent {
		type: "damage-dealt";
		target: BattlePosition;
		damage: number;
		remainingHP: number;
	}

	/** Reports a move failing to connect. */
	export interface MoveMissedEvent {
		type: "move-missed";
		user: BattlePosition;
		target: BattlePosition;
	}

	/** Reports a major status applied by a move effect. */
	export interface StatusAppliedEvent {
		type: "status-applied";
		target: BattlePosition;
		status: State;
	}

	/** Reports volatile battle-only effects applied to one combatant. */
	export interface VolatileAppliedEvent {
		type: "volatile-applied";
		target: BattlePosition;
		effect:
			| "attract"
			| "confusion"
			| "disable"
			| "encore"
			| "flinch"
			| "identify"
			| "partial-trap"
			| "protect"
			| "recharge"
			| "seed"
			| "taunt"
			| "trap";
	}

	/** Reports a combat stat stage changing during battle. */
	export interface StatStageChangedEvent {
		type: "stat-stage-changed";
		target: BattlePosition;
		stat: BattleStatStage;
		stages: number;
		value: number;
	}

	/** Reports side-wide effects such as Reflect or Tailwind. */
	export interface SideEffectAppliedEvent {
		type: "side-effect-applied";
		side: number;
		effect: SideEffectType;
		turns?: number;
		layers?: number;
	}

	/** Reports one active creature being replaced by a bench creature. */
	export interface CreatureSwitchedEvent {
		type: "creature-switched";
		target: BattlePosition;
		creature: number;
	}

	/** Reports a submitted move failing before normal resolution. */
	export interface MoveFailedEvent {
		type: "move-failed";
		user: BattlePosition;
		reason: "attract" | "disabled" | "encored" | "recharge" | "taunt";
	}

	/** Reports side-entry hazards damaging or debuffing a switched-in creature. */
	export interface HazardTriggeredEvent {
		type: "hazard-triggered";
		target: BattlePosition;
		effect: "spikes" | "toxic-spikes" | "stealth-rock" | "sticky-web";
	}

	/** Reports shared field effects such as Trick Room. */
	export interface FieldEffectAppliedEvent {
		type: "field-effect-applied";
		effect: FieldEffectType;
		turns: number;
	}

	/** Reports an active creature fainting in its slot. */
	export interface CreatureFaintedEvent {
		type: "creature-fainted";
		target: BattlePosition;
	}

	/** Marks the end of the current turn. */
	export interface TurnEndedEvent {
		type: "turn-ended";
		turn: number;
	}

	/** Marks the end of the battle session. */
	export interface BattleFinishedEvent {
		type: "battle-finished";
		winnerSide: number | null;
	}
}

/** Event emitted while a battle session advances. */
export type BattleEvent =
	| BattleEvent.BattleStarted
	| BattleEvent.TurnStarted
	| BattleEvent.TurnCommandsRequestedEvent
	| BattleEvent.ReplacementsRequestedEvent
	| BattleEvent.MoveUsed
	| BattleEvent.EffectivenessEvent
	| BattleEvent.CriticalHitEvent
	| BattleEvent.DamageDealtEvent
	| BattleEvent.MoveMissedEvent
	| BattleEvent.StatusAppliedEvent
	| BattleEvent.VolatileAppliedEvent
	| BattleEvent.StatStageChangedEvent
	| BattleEvent.SideEffectAppliedEvent
	| BattleEvent.FieldEffectAppliedEvent
	| BattleEvent.CreatureSwitchedEvent
	| BattleEvent.MoveFailedEvent
	| BattleEvent.HazardTriggeredEvent
	| BattleEvent.CreatureFaintedEvent
	| BattleEvent.TurnEndedEvent
	| BattleEvent.BattleFinishedEvent;

/** One active slot backed by a creature from a specific team. */
export interface BattleActiveSlotState {
	teamIndex: number;
	creatureIndex: number;
	combatant: CombatantState;
}

/** Runtime state for one team on a side. */
export interface BattleTeamState {
	creatures: CombatantState[];
	eliminated: boolean;
}

/** Runtime state for one side of the battle. */
export interface BattleSideState {
	canLeaveBattle: boolean;
	slotTeams: number[];
	teams: BattleTeamState[];
	active: Array<BattleActiveSlotState | null>;
	effects: ReturnType<typeof createSideEffectState>;
}

/** Mutable battle state that callers can inspect between generator steps. */
export interface BattleState {
	turn: number;
	phase: "idle" | "awaiting-turn-input" | "awaiting-replacement" | "resolving-turn" | "finished";
	winnerSide: number | null;
	slots: 1 | 2 | 3;
	sides: [BattleSideState, BattleSideState];
	field: ReturnType<typeof createFieldEffectState>;
}

/** Long-lived battle session that yields events and accepts turn or replacement input. */
export type BattleSession = Generator<BattleEvent, BattleEvent, BattleInput>;

/** Generator that resolves one submitted turn into ordered battle events. */
export type BattleTurnSession = Generator<BattleEvent, void, void>;

export namespace Battle {
	/** One side's submitted teams. */
	export interface SideArguments {
		canLeaveBattle?: boolean;
		teams: Creature[][];
	}

	/** Battle setup describing format and both sides. */
	export interface Arguments {
		gameData: GameData;
		sides: [SideArguments, SideArguments];
		slots?: 1 | 2 | 3;
		random?(): number;
	}
}

/** Resolves battle turns for one format and requests replacements between turns when needed. */
export class Battle {
	readonly state: BattleState;

	private readonly gameData: GameData;
	private readonly random: () => number;
	private pendingReplacementRequests: ReplacementSelection[] = [];

	/**
	 * @param args - Battle setup, loaded content, and optional RNG override
	 */
	constructor(args: Battle.Arguments) {
		let slots = args.slots ?? 1;

		this.gameData = args.gameData;
		this.random = args.random ?? Math.random;
		this.state = {
			turn: 0,
			phase: "idle",
			winnerSide: null,
			slots,
			field: createFieldEffectState(),
			sides: [
				this.createSideState(args.sides[0], slots),
				this.createSideState(args.sides[1], slots),
			],
		};

		this.reconcileSideState(0);
		this.reconcileSideState(1);
		this.updateWinnerSide();
	}

	/** Returns the first fainted creature currently tracked by the battle state, if any. */
	get fainted() {
		for (let side of this.state.sides) {
			for (let team of side.teams) {
				for (let combatant of team.creatures) {
					if (this.isCombatantFainted(combatant)) return combatant.creature;
				}
			}
		}

		return null;
	}

	/**
	 * Starts a battle session that yields events, turn requests, and replacement requests.
	 *
	 * @yields Battle lifecycle events in the order they should be rendered by the caller.
	 * @returns The finishing battle event when the session completes.
	 */
	*start(): BattleSession {
		yield { type: "battle-started" };

		if (this.state.winnerSide !== null) {
			let event = this.finishBattle(this.state.winnerSide);
			yield event;
			return event;
		}

		while (this.state.phase !== "finished") {
			if (this.pendingReplacementRequests.length > 0) {
				this.state.phase = "awaiting-replacement";
				let replacementCommands = yield {
					type: "request-replacements",
					requests: this.pendingReplacementRequests.map((request) => ({
						side: request.side,
						slot: request.slot,
						team: request.team,
						choices: [...request.choices],
					})),
				};

				if (this.isReplacementCommands(replacementCommands) === false) {
					throw new TypeError(
						"Replacement input must be an array of replacement or leave-battle commands.",
					);
				}

				this.applyReplacementCommands(replacementCommands);
				this.pendingReplacementRequests = [];
				this.reconcileSideState(0);
				this.reconcileSideState(1);
				this.updateWinnerSide();

				if (this.state.winnerSide !== null) {
					let event = this.finishBattle(this.state.winnerSide);
					yield event;
					return event;
				}
			}

			this.state.turn += 1;
			this.state.phase = "awaiting-turn-input";
			yield { type: "turn-started", turn: this.state.turn };

			let turnRequests = this.getTurnCommandRequests();
			let turnCommands = yield {
				type: "request-turn-commands",
				requests: turnRequests,
			};

			if (this.isTurnCommands(turnCommands) === false) {
				throw new TypeError("Turn input must be an array of turn commands.");
			}

			this.state.phase = "resolving-turn";

			for (let event of this.resolveTurn(turnRequests, turnCommands)) {
				yield event;
			}

			for (let event of this.reconcileAfterTurn()) {
				yield event;
			}
			yield { type: "turn-ended", turn: this.state.turn };

			if (this.state.winnerSide !== null) {
				let event = this.finishBattle(this.state.winnerSide);
				yield event;
				return event;
			}
		}

		return { type: "battle-finished", winnerSide: this.state.winnerSide };
	}

	private createSideState(side: Battle.SideArguments, slots: 1 | 2 | 3): BattleSideState {
		this.assertValidSide(side, slots);

		let slotTeams =
			side.teams.length === 1 ? Array.from({ length: slots }, () => 0) : [0, 1, 2].slice(0, slots);
		let teams = side.teams.map((team) => ({
			creatures: team.map((creature) => new CombatantState(creature)),
			eliminated: false,
		}));
		let active = Array.from({ length: slots }, () => null as BattleActiveSlotState | null);

		for (let slotIndex = 0; slotIndex < slots; slotIndex += 1) {
			let teamIndex = slotTeams[slotIndex]!;
			let creatureIndex = this.getFirstAvailableCreatureIndex(teams, active, teamIndex);
			if (creatureIndex === null) continue;

			active[slotIndex] = {
				teamIndex,
				creatureIndex,
				combatant: teams[teamIndex]!.creatures[creatureIndex]!,
			};
		}

		return {
			canLeaveBattle: side.canLeaveBattle ?? false,
			slotTeams,
			teams,
			active,
			effects: createSideEffectState(),
		};
	}

	private assertValidSide(side: Battle.SideArguments, slots: 1 | 2 | 3) {
		if (side.teams.length !== 1 && side.teams.length !== slots) {
			throw new RangeError(
				`A side in ${slots}v${slots} must provide either 1 team or ${slots} teams.`,
			);
		}

		for (let team of side.teams) {
			if (team.length < 1 || team.length > 6) {
				throw new RangeError("Each battle team must contain between 1 and 6 creatures.");
			}
		}
	}

	private *resolveTurn(requests: BattlePosition[], commands: TurnCommand[]): BattleTurnSession {
		for (let action of this.getTurnActions(requests, commands)) {
			if (action.command.type === "leave-battle") {
				this.forfeitSide(action.userPosition.side);
				return;
			}

			if (action.command.type === "switch") {
				for (let event of this.resolveSwitch(action)) yield event;
				continue;
			}

			if (this.isCombatantActive(action.userPosition, action.user) === false) continue;
			if (!action.move || !action.moveId) continue;

			let target = this.getActiveCombatant(action.command.target);
			if (target === null) continue;
			if (this.canMoveHitTarget(action.move, target.combatant) === false) continue;
			for (let event of this.resolveMove(
				action.user,
				action.userPosition,
				action.command,
				action.command.target,
				target.combatant,
				action.move,
				action.moveId,
				action.isChargingRelease,
			)) {
				yield event;
			}
		}
	}

	private getTurnActions(requests: BattlePosition[], commands: TurnCommand[]): TurnAction[] {
		if (requests.length !== commands.length) {
			throw new RangeError("Turn command count must match the number of requested active slots.");
		}

		let actions: TurnAction[] = [];

		for (let [index, request] of requests.entries()) {
			let command = commands[index];
			if (!command) continue;

			let active = this.getActiveCombatant(request);
			if (active === null) continue;

			if (command.type === "leave-battle") {
				if (this.canCombatantLeaveBattle(request, active.combatant) === false) continue;

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
				if (this.canSwitchCombatant(request, active, command.creature) === false) continue;

				actions.push({
					user: active.combatant,
					userPosition: request,
					command,
					moveId: null,
					move: null,
					priority: 6,
					speed: this.getCombatantSpeed(request, active.combatant),
					isChargingRelease: false,
				});
				continue;
			}

			if (command.type !== "fight") continue;

			if (
				active.combatant.volatile.encoreTurns > 0 &&
				active.combatant.volatile.encoredMoveSlot !== null
			) {
				command = {
					...command,
					move: active.combatant.volatile.encoredMoveSlot,
				};
			}

			let moveId = active.combatant.creature.moveset[command.move];
			if (!moveId) continue;
			let chargingMoveId = active.combatant.volatile.chargingMoveId;
			if (chargingMoveId !== null) moveId = chargingMoveId;

			let move = this.gameData.moves.get(moveId);
			if (!move) throw new ReferenceError(`Move ${moveId} not found in game data.`);

			actions.push({
				user: active.combatant,
				userPosition: request,
				command,
				moveId,
				move,
				priority: this.getMovePriority(move),
				speed: this.getCombatantSpeed(request, active.combatant),
				isChargingRelease: chargingMoveId !== null,
			});
		}

		actions.sort((left, right) => {
			if (left.priority !== right.priority) return right.priority - left.priority;
			if (left.speed !== right.speed) {
				if (this.state.field.trickRoomTurns > 0) return left.speed - right.speed;
				return right.speed - left.speed;
			}
			if (left.userPosition.side !== right.userPosition.side) {
				return left.userPosition.side - right.userPosition.side;
			}

			return left.userPosition.slot - right.userPosition.slot;
		});

		return actions;
	}

	private *resolveSwitch(action: TurnAction) {
		if (action.command.type !== "switch") return;
		let active = this.getActiveCombatant(action.userPosition);
		if (active === null) return;
		let side = this.state.sides[action.userPosition.side]!;
		let replacement = side.teams[active.teamIndex]!.creatures[action.command.creature];
		if (!replacement) return;

		this.resetSwitchVolatiles(active.combatant);
		side.active[action.userPosition.slot] = {
			teamIndex: active.teamIndex,
			creatureIndex: action.command.creature,
			combatant: replacement,
		};

		yield {
			type: "creature-switched",
			target: action.userPosition,
			creature: action.command.creature,
		} as BattleEvent.CreatureSwitchedEvent;

		for (let event of this.applySwitchInHazards(action.userPosition, replacement)) {
			yield event;
		}

		if (this.isCombatantFainted(replacement)) {
			this.clearActiveCombatant(action.userPosition);
			yield {
				type: "creature-fainted",
				target: action.userPosition,
			} as BattleEvent.CreatureFaintedEvent;
		}
	}

	private *resolveMove(
		user: CombatantState,
		userPosition: BattlePosition,
		command: FightCommand,
		targetPosition: BattlePosition,
		target: CombatantState,
		move: Move,
		moveId: string,
		isChargingRelease: boolean,
	): Generator<BattleEvent, void, void> {
		let events: BattleEvent[] = [];
		let effects = this.flattenEffects(move.effect);

		if (this.resolveBeforeMove(user, userPosition, move, command, events)) {
			for (let event of events) yield event;
			return;
		}

		events.push({
			type: "move-used",
			user: userPosition,
			moveId,
			target: targetPosition,
		});

		let chargeEffect = this.findEffect(effects, "charge");
		if (chargeEffect?.kind === "charge" && isChargingRelease === false) {
			this.applyChargeEffect(user, chargeEffect);
			user.volatile.chargingMoveId = moveId;
			for (let event of events) yield event;
			return;
		}

		if (chargeEffect?.kind === "charge") {
			user.volatile.charging = false;
			user.volatile.invulnerable = false;
			user.volatile.chargingMoveId = null;
		}

		if (this.moveCanConnect(user, target, move) === false) {
			events.push({ type: "move-missed", user: userPosition, target: targetPosition });
			for (let event of events) yield event;
			return;
		}

		if (this.moveDealsDamage(move, effects) && target.volatile.protecting === false) {
			let damageDealt = this.applyMoveDamage(
				user,
				userPosition,
				target,
				targetPosition,
				move,
				effects,
				events,
			);
			this.applyRecoilDamage(user, userPosition, effects, damageDealt, events);
		}

		for (let effect of effects) {
			for (let event of this.resolveEffect(
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

		user.volatile.lastMoveSlot = command.move;

		if (this.isCombatantFainted(user)) {
			this.clearActiveCombatant(userPosition);
			events.push({ type: "creature-fainted", target: userPosition });
		}

		if (this.isCombatantFainted(target)) {
			this.clearActiveCombatant(targetPosition);
			events.push({ type: "creature-fainted", target: targetPosition });
		}

		for (let event of events) yield event;
	}

	private *resolveEffect(
		user: CombatantState,
		userPosition: BattlePosition,
		target: CombatantState,
		targetPosition: BattlePosition,
		move: Move,
		effect: MoveEffect,
	): Generator<BattleEvent, void, void> {
		for (let event of Effects.resolve(effect, {
			user,
			userPosition,
			target,
			targetPosition,
			state: this.state,
			random: () => this.random(),
		})) {
			yield event;
		}
	}

	private applyChargeEffect(user: CombatantState, effect: Extract<MoveEffect, { kind: "charge" }>) {
		user.volatile.charging = true;
		user.volatile.invulnerable = effect.invulnerable ?? true;
	}

	private *reconcileAfterTurn(): Generator<BattleEvent, void, void> {
		for (let event of this.applyEndOfTurnEffects()) yield event;
		this.tickTurnEffects();
		this.pendingReplacementRequests = [];
		this.reconcileSideState(0);
		this.reconcileSideState(1);
		this.updateWinnerSide();
	}

	private reconcileSideState(sideIndex: number) {
		let side = this.state.sides[sideIndex]!;

		for (let teamIndex = 0; teamIndex < side.teams.length; teamIndex += 1) {
			if (this.teamHasRemainingPresence(sideIndex, teamIndex) === false) {
				side.teams[teamIndex]!.eliminated = true;
			}
		}

		for (let slotIndex = 0; slotIndex < side.active.length; slotIndex += 1) {
			if (side.active[slotIndex] !== null) continue;

			let teamIndex = side.slotTeams[slotIndex]!;
			let team = side.teams[teamIndex]!;
			if (team.eliminated) continue;

			let choices = this.getAvailableReplacementChoices(sideIndex, teamIndex);
			if (choices.length === 0) continue;

			this.pendingReplacementRequests.push({
				side: sideIndex,
				slot: slotIndex,
				team: teamIndex,
				choices,
			});
		}
	}

	private updateWinnerSide() {
		let side0Alive = this.sideHasRemainingContenders(0);
		let side1Alive = this.sideHasRemainingContenders(1);

		if (side0Alive === side1Alive) {
			this.state.winnerSide = null;
			return;
		}

		this.state.winnerSide = side0Alive ? 0 : 1;
	}

	private sideHasRemainingContenders(sideIndex: number): boolean {
		let side = this.state.sides[sideIndex]!;

		for (let teamIndex = 0; teamIndex < side.teams.length; teamIndex += 1) {
			if (side.teams[teamIndex]!.eliminated) continue;
			if (this.teamHasRemainingPresence(sideIndex, teamIndex)) return true;
		}

		return false;
	}

	private teamHasRemainingPresence(sideIndex: number, teamIndex: number): boolean {
		let side = this.state.sides[sideIndex]!;

		for (let active of side.active) {
			if (active?.teamIndex === teamIndex) return true;
		}

		for (let [creatureIndex, combatant] of side.teams[teamIndex]!.creatures.entries()) {
			if (this.isCreatureCurrentlyActive(side, teamIndex, creatureIndex)) continue;
			if (this.isCombatantFainted(combatant)) continue;
			return true;
		}

		return false;
	}

	private getAvailableReplacementChoices(sideIndex: number, teamIndex: number): number[] {
		let side = this.state.sides[sideIndex]!;
		let choices: number[] = [];

		for (let [creatureIndex, combatant] of side.teams[teamIndex]!.creatures.entries()) {
			if (this.isCombatantFainted(combatant)) continue;
			if (this.isCreatureCurrentlyActive(side, teamIndex, creatureIndex)) continue;
			choices.push(creatureIndex);
		}

		return choices;
	}

	private applyReplacementCommands(commands: ReplacementInput) {
		if (commands.length !== this.pendingReplacementRequests.length) {
			throw new RangeError(
				"Replacement command count must match the number of replacement requests.",
			);
		}

		for (let [index, request] of this.pendingReplacementRequests.entries()) {
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
				this.forfeitSide(request.side);
				continue;
			}

			if (request.choices.includes(command.creature) === false) {
				throw new RangeError("Replacement command selected a creature that is not available.");
			}

			this.activateReplacement(request.side, request.slot, request.team, command.creature);
		}
	}

	private activateReplacement(
		sideIndex: number,
		slotIndex: number,
		teamIndex: number,
		creatureIndex: number,
	) {
		let side = this.state.sides[sideIndex]!;
		let combatant = side.teams[teamIndex]!.creatures[creatureIndex]!;

		this.resetSwitchVolatiles(combatant);
		side.active[slotIndex] = {
			teamIndex,
			creatureIndex,
			combatant,
		};
	}

	private forfeitSide(sideIndex: number) {
		for (let team of this.state.sides[sideIndex]!.teams) {
			team.eliminated = true;
		}

		for (
			let slotIndex = 0;
			slotIndex < this.state.sides[sideIndex]!.active.length;
			slotIndex += 1
		) {
			this.state.sides[sideIndex]!.active[slotIndex] = null;
		}
	}

	private canCombatantLeaveBattle(position: BattlePosition, combatant: CombatantState): boolean {
		let side = this.state.sides[position.side]!;
		if (side.canLeaveBattle === false) return false;
		if (combatant.volatile.trapped) return false;
		return true;
	}

	private canSwitchCombatant(
		position: BattlePosition,
		active: BattleActiveSlotState,
		creatureIndex: number,
	): boolean {
		if (active.combatant.volatile.trapped) return false;
		let side = this.state.sides[position.side]!;
		let team = side.teams[active.teamIndex]!;
		let replacement = team.creatures[creatureIndex];
		if (!replacement) return false;
		if (creatureIndex === active.creatureIndex) return false;
		if (this.isCombatantFainted(replacement)) return false;
		if (this.isCreatureCurrentlyActive(side, active.teamIndex, creatureIndex)) return false;
		return true;
	}

	private getTurnCommandRequests(): BattlePosition[] {
		let requests: BattlePosition[] = [];

		for (let [sideIndex, side] of this.state.sides.entries()) {
			for (let [slotIndex, active] of side.active.entries()) {
				if (active === null) continue;
				requests.push({ side: sideIndex, slot: slotIndex });
			}
		}

		return requests;
	}

	private getFirstAvailableCreatureIndex(
		teams: BattleTeamState[],
		active: Array<BattleActiveSlotState | null>,
		teamIndex: number,
	): number | null {
		for (let [creatureIndex, combatant] of teams[teamIndex]!.creatures.entries()) {
			if (this.isCombatantFainted(combatant)) continue;
			if (
				active.some((slot) => slot?.teamIndex === teamIndex && slot.creatureIndex === creatureIndex)
			)
				continue;
			return creatureIndex;
		}

		return null;
	}

	private getActiveCombatant(position: BattlePosition): BattleActiveSlotState | null {
		let side = this.state.sides[position.side];
		if (!side) return null;
		return side.active[position.slot] ?? null;
	}

	private isCombatantActive(position: BattlePosition, combatant: CombatantState): boolean {
		return this.getActiveCombatant(position)?.combatant === combatant;
	}

	private clearActiveCombatant(position: BattlePosition) {
		let side = this.state.sides[position.side];
		if (!side) return;
		side.active[position.slot] = null;
	}

	private isCreatureCurrentlyActive(
		side: BattleSideState,
		teamIndex: number,
		creatureIndex: number,
	): boolean {
		return side.active.some(
			(active) => active?.teamIndex === teamIndex && active.creatureIndex === creatureIndex,
		);
	}

	private isReplacementCommands(input: BattleInput): input is ReplacementInput {
		return input.every((command) => command.type === "replace" || command.type === "leave-battle");
	}

	private isTurnCommands(input: BattleInput): input is TurnCommand[] {
		return input.every(
			(command) =>
				command.type === "fight" || command.type === "leave-battle" || command.type === "switch",
		);
	}

	private getMovePriority(move: Move): number {
		for (let effect of this.flattenEffects(move.effect)) {
			if (this.hasEffectKind(effect, "priority")) return effect.value;
			if (effect.kind === "protect") return 4;
		}
		return 0;
	}

	private canMoveHitTarget(move: Move, target: CombatantState): boolean {
		if (target.volatile.invulnerable === false) return true;
		if (move.effect.kind === "charge") return true;
		if (this.state.field.gravityTurns > 0) return true;
		if (target.volatile.identified && move.type === Type.NORMAL) return true;
		return false;
	}

	private getCombatantSide(combatant: CombatantState): number {
		for (let [sideIndex, side] of this.state.sides.entries()) {
			for (let active of side.active) {
				if (active?.combatant === combatant) return sideIndex;
			}
		}

		throw new ReferenceError("Combatant not found in active battle state.");
	}

	private getCombatantSpeed(position: BattlePosition, combatant: CombatantState): number {
		let speed = getCreatureStat(this.gameData, combatant.creature, Stat.Speed);
		speed = Math.floor(speed * this.getStageModifier(combatant.statStages[Stat.Speed]));

		if (combatant.creature.status.state === State.Paralyzed) {
			speed = Math.floor(speed * 0.5);
		}

		if (this.state.sides[position.side]!.effects.tailwindTurns > 0) {
			speed *= 2;
		}

		if (this.state.field.terrain === "electric") {
			speed = Math.floor(speed * 1.1);
		}

		return speed;
	}

	private isGrounded(combatant: CombatantState): boolean {
		if (combatant.volatile.invulnerable) return false;
		let species = getCreatureSpecies(this.gameData, combatant.creature);
		return species.types.includes(Type.FLYING) === false;
	}

	private resetSwitchVolatiles(combatant: CombatantState) {
		combatant.volatile.seeded = false;
		combatant.volatile.seededBy = null;
		combatant.volatile.trapped = false;
		combatant.volatile.confusionTurns = 0;
		combatant.volatile.invulnerable = false;
		combatant.volatile.flinched = false;
		combatant.volatile.protecting = false;
		combatant.volatile.partiallyTrappedTurns = 0;
		combatant.volatile.partialTrapSourceSide = null;
		combatant.volatile.charging = false;
		combatant.volatile.chargingMoveId = null;
		combatant.volatile.recharging = false;
		combatant.volatile.attracted = false;
		combatant.volatile.tauntedTurns = 0;
		combatant.volatile.encoreTurns = 0;
		combatant.volatile.encoredMoveSlot = null;
		combatant.volatile.disabledMoveSlot = null;
		combatant.volatile.disableTurns = 0;
	}

	private applySwitchInHazards(position: BattlePosition, combatant: CombatantState): BattleEvent[] {
		let side = this.state.sides[position.side]!;
		let effects = side.effects;
		let events: BattleEvent[] = [];
		let grounded = this.isGrounded(combatant);
		let species = getCreatureSpecies(this.gameData, combatant.creature);

		if (effects.spikesLayers > 0 && grounded) {
			let fraction =
				effects.spikesLayers === 1 ? 1 / 8 : effects.spikesLayers === 2 ? 1 / 6 : 1 / 4;
			let damage = Math.max(
				1,
				Math.floor(getCreatureStat(this.gameData, combatant.creature, Stat.HP) * fraction),
			);
			events.push({ type: "hazard-triggered", target: position, effect: "spikes" });
			this.applyDamage(combatant, position, damage, events);
		}

		if (
			effects.toxicSpikesLayers > 0 &&
			grounded &&
			combatant.creature.status.state === null &&
			species.types.includes(Type.POISON) === false &&
			species.types.includes(Type.STEEL) === false
		) {
			combatant.creature.status.state = State.Poisoned;
			events.push({ type: "hazard-triggered", target: position, effect: "toxic-spikes" });
			events.push({ type: "status-applied", target: position, status: State.Poisoned });
		}

		if (effects.stealthRock) {
			let effectiveness = this.getTypeEffectiveness(combatant, {
				type: Type.ROCK,
				class: Class.Physical,
				power: 0,
				accuracy: 0,
				pp: 0,
				effect: { kind: "none" },
			} as Move);
			let multiplier =
				effectiveness === Effectiveness.SUPER
					? 2
					: effectiveness === Effectiveness.WEAK
						? 0.5
						: effectiveness === Effectiveness.ZERO
							? 0
							: 1;
			let damage = Math.max(
				0,
				Math.floor(
					getCreatureStat(this.gameData, combatant.creature, Stat.HP) * (1 / 8) * multiplier,
				),
			);
			events.push({ type: "hazard-triggered", target: position, effect: "stealth-rock" });
			if (damage > 0) this.applyDamage(combatant, position, damage, events);
		}

		if (effects.stickyWeb && grounded) {
			let current = combatant.statStages[Stat.Speed];
			let value = Math.max(-6, Math.min(6, current - 1));
			combatant.statStages[Stat.Speed] = value;
			events.push({ type: "hazard-triggered", target: position, effect: "sticky-web" });
			events.push({
				type: "stat-stage-changed",
				target: position,
				stat: Stat.Speed,
				stages: -1,
				value,
			});
		}

		return events;
	}

	private getStageModifier(stage: number): number {
		if (stage >= 0) return (2 + stage) / 2;
		return 2 / (2 + Math.abs(stage));
	}

	private getAccuracyStageModifier(stage: number): number {
		if (stage >= 0) return (3 + stage) / 3;
		return 3 / (3 + Math.abs(stage));
	}

	private moveDealsDamage(move: Move, effects: MoveEffect[]): boolean {
		if (move.class !== Class.Status && move.power > 0) return true;
		return effects.some((effect) => effect.kind === "fixed-damage" || effect.kind === "ohko");
	}

	private tickTurnEffects() {
		for (let side of this.state.sides) {
			side.effects.reflectTurns = Math.max(0, side.effects.reflectTurns - 1);
			side.effects.lightScreenTurns = Math.max(0, side.effects.lightScreenTurns - 1);
			side.effects.tailwindTurns = Math.max(0, side.effects.tailwindTurns - 1);
			side.effects.safeguardTurns = Math.max(0, side.effects.safeguardTurns - 1);
			side.effects.mistTurns = Math.max(0, side.effects.mistTurns - 1);
			side.effects.luckyChantTurns = Math.max(0, side.effects.luckyChantTurns - 1);

			for (let active of side.active) {
				if (!active) continue;
				active.combatant.volatile.flinched = false;
				active.combatant.volatile.protecting = false;
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

		this.state.field.weatherTurns = Math.max(0, this.state.field.weatherTurns - 1);
		if (this.state.field.weatherTurns === 0) this.state.field.weather = null;
		this.state.field.terrainTurns = Math.max(0, this.state.field.terrainTurns - 1);
		if (this.state.field.terrainTurns === 0) this.state.field.terrain = null;
		this.state.field.trickRoomTurns = Math.max(0, this.state.field.trickRoomTurns - 1);
		this.state.field.gravityTurns = Math.max(0, this.state.field.gravityTurns - 1);
		this.state.field.wonderRoomTurns = Math.max(0, this.state.field.wonderRoomTurns - 1);
		this.state.field.magicRoomTurns = Math.max(0, this.state.field.magicRoomTurns - 1);
	}

	private calculateDamage(
		user: CombatantState,
		target: CombatantState,
		targetPosition: BattlePosition,
		move: Move,
		effectiveness: Effectiveness,
		events: BattleEvent[],
	): number {
		let damage = this.getBaseDamage(user, target, move);
		damage = Math.floor(damage * this.getStabModifier(user, move));

		if (effectiveness !== Effectiveness.NORMAL) {
			events.push({
				type: "effectiveness",
				target: targetPosition,
				effectiveness,
			});
		}

		if (effectiveness === Effectiveness.SUPER) damage = Math.floor(damage * 2);
		if (effectiveness === Effectiveness.WEAK) damage = Math.floor(damage * 0.5);
		if (effectiveness === Effectiveness.ZERO) damage = 0;

		if (this.random() < CRITICAL_HIT_CHANCE) {
			let targetSide = this.getCombatantSide(target);
			if (this.state.sides[targetSide]!.effects.luckyChantTurns === 0) {
				damage = Math.floor(damage * 1.5);
				events.push({ type: "critical-hit", target: targetPosition });
			}
		}

		return Math.floor(damage * ((85 + Math.floor(this.random() * 16)) / 100));
	}

	private flattenEffects(effect: MoveEffect): MoveEffect[] {
		if (effect.kind !== "compound") return [effect];

		let flattened: MoveEffect[] = [];
		for (let nested of effect.effects) {
			for (let resolved of this.flattenEffects(nested)) {
				flattened.push(resolved);
			}
		}

		return flattened;
	}

	private resolveBeforeMove(
		user: CombatantState,
		userPosition: BattlePosition,
		move: Move,
		command: FightCommand,
		events: BattleEvent[],
	): boolean {
		if (user.volatile.recharging) {
			user.volatile.recharging = false;
			events.push({ type: "move-failed", user: userPosition, reason: "recharge" });
			return true;
		}

		if (user.volatile.tauntedTurns > 0 && move.class === Class.Status) {
			events.push({ type: "move-failed", user: userPosition, reason: "taunt" });
			return true;
		}

		if (
			user.volatile.encoreTurns > 0 &&
			user.volatile.encoredMoveSlot !== null &&
			command.move !== user.volatile.encoredMoveSlot
		) {
			events.push({ type: "move-failed", user: userPosition, reason: "encored" });
			return true;
		}

		if (
			user.volatile.disabledMoveSlot !== null &&
			user.volatile.disabledMoveSlot === command.move
		) {
			events.push({ type: "move-failed", user: userPosition, reason: "disabled" });
			return true;
		}

		if (user.volatile.attracted && this.random() < 0.5) {
			events.push({ type: "move-failed", user: userPosition, reason: "attract" });
			return true;
		}

		if (user.creature.status.state === State.Asleep) return true;
		if (user.creature.status.state === State.Frozen) return true;
		if (user.volatile.flinched) return true;
		if (user.creature.status.state === State.Paralyzed && this.random() < 0.25) return true;
		return this.resolveConfusion(user, userPosition, events);
	}

	private moveCanConnect(user: CombatantState, target: CombatantState, move: Move): boolean {
		if (this.canMoveHitTarget(move, target) === false) return false;
		if (move.accuracy === 0) return true;
		if (user.statStages.accuracy === 0 && target.statStages.evasion === 0) return true;

		let chance =
			(move.accuracy / 100) *
			this.getAccuracyStageModifier(user.statStages.accuracy) *
			(1 / this.getAccuracyStageModifier(target.statStages.evasion));
		if (this.state.field.gravityTurns > 0) chance *= 5 / 3;
		if (this.state.field.weather === "fog") chance *= 0.6;
		if (chance >= 1) return true;
		return this.random() < Math.max(0, chance);
	}

	private applyMoveDamage(
		user: CombatantState,
		_userPosition: BattlePosition,
		target: CombatantState,
		targetPosition: BattlePosition,
		move: Move,
		effects: MoveEffect[],
		events: BattleEvent[],
	): number {
		let hitCount = this.getMoveHitCount(effects);
		let totalDamage = 0;

		for (let hit = 0; hit < hitCount; hit += 1) {
			let damage = this.getResolvedMoveDamage(user, target, targetPosition, move, effects, events);
			if (damage <= 0) break;

			totalDamage += this.applyAttackDamage(target, targetPosition, damage, events);
			if (this.isCombatantFainted(target)) break;
		}

		return totalDamage;
	}

	private applyRecoilDamage(
		user: CombatantState,
		userPosition: BattlePosition,
		effects: MoveEffect[],
		damageDealt: number,
		events: BattleEvent[],
	) {
		let recoil = this.findEffect(effects, "recoil");
		if (!recoil || damageDealt === 0) return;

		let damage = Math.max(1, Math.floor(damageDealt * recoil.ratio));
		this.applyDamage(user, userPosition, damage, events);
	}

	private applyEndOfTurnEffects(): BattleEvent[] {
		let events: BattleEvent[] = [];

		for (let [sideIndex, side] of this.state.sides.entries()) {
			for (let [slotIndex, active] of side.active.entries()) {
				if (!active) continue;
				let position = { side: sideIndex, slot: slotIndex };
				let combatant = active.combatant;
				let maxHP = getCreatureStat(this.gameData, combatant.creature, Stat.HP);

				switch (combatant.creature.status.state) {
					case State.Burned:
					case State.Poisoned: {
						this.applyDamage(combatant, position, Math.max(1, Math.floor(maxHP / 8)), events);
						break;
					}
				}

				if (combatant.volatile.seeded) {
					let drained = this.applyDamage(
						combatant,
						position,
						Math.max(1, Math.floor(maxHP / 8)),
						events,
					);
					this.healSeedSource(combatant.volatile.seededBy, drained, events);
				}

				if (combatant.volatile.partiallyTrappedTurns > 0) {
					combatant.volatile.partiallyTrappedTurns -= 1;
					this.applyDamage(combatant, position, Math.max(1, Math.floor(maxHP / 8)), events);
				}

				if (this.state.field.terrain === "grassy" && this.isGrounded(combatant)) {
					let previous = combatant.creature.status.damage;
					combatant.creature.status.damage = Math.max(
						0,
						previous - Math.max(1, Math.floor(maxHP / 16)),
					);
					if (previous !== combatant.creature.status.damage) {
						events.push({
							type: "damage-dealt",
							target: position,
							damage: 0,
							remainingHP: this.getRemainingHP(combatant),
						});
					}
				}

				if (this.state.field.weather === "sand") {
					let types = getCreatureSpecies(this.gameData, combatant.creature).types;
					if (
						types.includes(Type.ROCK) === false &&
						types.includes(Type.GROUND) === false &&
						types.includes(Type.STEEL) === false
					) {
						this.applyDamage(combatant, position, Math.max(1, Math.floor(maxHP / 16)), events);
					}
				}

				if (this.state.field.weather === "hail") {
					let types = getCreatureSpecies(this.gameData, combatant.creature).types;
					if (types.includes(Type.ICE) === false) {
						this.applyDamage(combatant, position, Math.max(1, Math.floor(maxHP / 16)), events);
					}
				}

				if (this.isCombatantFainted(combatant)) {
					this.clearActiveCombatant(position);
					events.push({ type: "creature-fainted", target: position });
				}
			}
		}

		return events;
	}

	private getMoveHitCount(effects: MoveEffect[]): number {
		let multiHit = this.findEffect(effects, "multi-hit");
		if (!multiHit) return 1;
		if (typeof multiHit.hits === "number") return multiHit.hits;

		let [min, max] = multiHit.hits;
		return min + Math.floor(this.random() * (max - min + 1));
	}

	private getResolvedMoveDamage(
		user: CombatantState,
		target: CombatantState,
		targetPosition: BattlePosition,
		move: Move,
		effects: MoveEffect[],
		events: BattleEvent[],
	): number {
		let ohko = this.findEffect(effects, "ohko");
		if (ohko) {
			return this.getRemainingHP(target);
		}

		let fixedDamage = this.findEffect(effects, "fixed-damage");
		if (fixedDamage) {
			return fixedDamage.value;
		}

		let effectiveness = this.getTypeEffectiveness(target, move);
		return this.calculateDamage(user, target, targetPosition, move, effectiveness, events);
	}

	private hasEffectKind<TKind extends MoveEffect["kind"]>(
		effect: MoveEffect,
		kind: TKind,
	): effect is Extract<MoveEffect, { kind: TKind }> {
		return effect.kind === kind;
	}

	private findEffect<TKind extends MoveEffect["kind"]>(
		effects: MoveEffect[],
		kind: TKind,
	): Extract<MoveEffect, { kind: TKind }> | null {
		for (let effect of effects) {
			if (this.hasEffectKind(effect, kind)) return effect;
		}

		return null;
	}

	private applyDamage(
		combatant: CombatantState,
		position: BattlePosition,
		damage: number,
		events: BattleEvent[],
	): number {
		let maxHP = getCreatureStat(this.gameData, combatant.creature, Stat.HP);
		let next = Math.min(maxHP, combatant.creature.status.damage + damage);
		let dealt = next - combatant.creature.status.damage;
		combatant.creature.status.damage = next;

		if (dealt > 0) {
			events.push({
				type: "damage-dealt",
				target: position,
				damage: dealt,
				remainingHP: maxHP - combatant.creature.status.damage,
			});
		}

		return dealt;
	}

	private applyAttackDamage(
		combatant: CombatantState,
		position: BattlePosition,
		damage: number,
		events: BattleEvent[],
	): number {
		let maxHP = getCreatureStat(this.gameData, combatant.creature, Stat.HP);
		let next = Math.min(maxHP, combatant.creature.status.damage + damage);
		let dealt = next - combatant.creature.status.damage;
		combatant.creature.status.damage = next;

		events.push({
			type: "damage-dealt",
			target: position,
			damage,
			remainingHP: maxHP - combatant.creature.status.damage,
		});

		return dealt;
	}

	private healSeedSource(sourceSide: number | null, amount: number, events: BattleEvent[]) {
		if (sourceSide === null || amount === 0) return;

		for (let [slotIndex, active] of this.state.sides[sourceSide]!.active.entries()) {
			if (!active) continue;
			let previous = active.combatant.creature.status.damage;
			active.combatant.creature.status.damage = Math.max(0, previous - amount);
			let healed = previous - active.combatant.creature.status.damage;
			if (healed === 0) continue;
			events.push({
				type: "damage-dealt",
				target: { side: sourceSide, slot: slotIndex },
				damage: 0,
				remainingHP: this.getRemainingHP(active.combatant),
			});
			return;
		}
	}

	private getRemainingHP(combatant: CombatantState): number {
		return (
			getCreatureStat(this.gameData, combatant.creature, Stat.HP) - combatant.creature.status.damage
		);
	}

	private getTypeEffectiveness(target: CombatantState, move: Move): Effectiveness {
		let moveMatch = this.gameData.typeChart[move.type] ?? {};
		let targetSpecies = getCreatureSpecies(this.gameData, target.creature);

		return targetSpecies.types.reduce((factor, type) => {
			let matchup = moveMatch[type];
			if (matchup !== undefined) return factor * matchup;
			return factor;
		}, Effectiveness.NORMAL);
	}

	private getBaseDamage(user: CombatantState, target: CombatantState, move: Move): number {
		let attackStat =
			move.class === Class.Physical
				? Math.floor(
						getCreatureStat(this.gameData, user.creature, Stat.Attack) *
							this.getStageModifier(user.statStages[Stat.Attack]),
					)
				: Math.floor(
						getCreatureStat(this.gameData, user.creature, Stat.SpecialAttack) *
							this.getStageModifier(user.statStages[Stat.SpecialAttack]),
					);
		let defenseStat =
			move.class === Class.Physical
				? Math.floor(
						getCreatureStat(this.gameData, target.creature, Stat.Defense) *
							this.getStageModifier(target.statStages[Stat.Defense]),
					)
				: Math.floor(
						getCreatureStat(this.gameData, target.creature, Stat.SpecialDefense) *
							this.getStageModifier(target.statStages[Stat.SpecialDefense]),
					);

		if (this.state.field.wonderRoomTurns > 0) {
			let swappedDefense =
				move.class === Class.Physical
					? getCreatureStat(this.gameData, target.creature, Stat.SpecialDefense)
					: getCreatureStat(this.gameData, target.creature, Stat.Defense);
			defenseStat = Math.floor(swappedDefense);
		}

		let level = getCreatureLevel(this.gameData, user.creature);
		let baseDamage =
			Math.floor(Math.floor((((2 * level) / 5 + 2) * move.power * attackStat) / defenseStat) / 50) +
			2;
		let targetSide = this.getCombatantSide(target);

		if (move.class === Class.Physical && this.state.sides[targetSide]!.effects.reflectTurns > 0) {
			return Math.floor(baseDamage * 0.5);
		}

		if (
			move.class === Class.Special &&
			this.state.sides[targetSide]!.effects.lightScreenTurns > 0
		) {
			return Math.floor(baseDamage * 0.5);
		}

		if (this.state.field.weather === "sun") {
			if (move.type === Type.FIRE) return Math.floor(baseDamage * 1.5);
			if (move.type === Type.WATER) return Math.floor(baseDamage * 0.5);
		}

		if (this.state.field.weather === "rain") {
			if (move.type === Type.WATER) return Math.floor(baseDamage * 1.5);
			if (move.type === Type.FIRE) return Math.floor(baseDamage * 0.5);
		}

		if (this.state.field.terrain === "electric" && move.type === Type.ELECTRIC) {
			return Math.floor(baseDamage * 1.3);
		}

		if (this.state.field.terrain === "grassy" && move.type === Type.GRASS) {
			return Math.floor(baseDamage * 1.3);
		}

		if (this.state.field.terrain === "psychic" && move.type === Type.PSYCHIC) {
			return Math.floor(baseDamage * 1.3);
		}

		if (this.state.field.terrain === "misty" && move.type === Type.DRAGON) {
			return Math.floor(baseDamage * 0.5);
		}

		return baseDamage;
	}

	private resolveConfusion(
		user: CombatantState,
		userPosition: BattlePosition,
		events: BattleEvent[],
	): boolean {
		if (user.volatile.confusionTurns === 0) return false;

		user.volatile.confusionTurns -= 1;
		if (this.random() >= 0.5) return false;

		let hp = getCreatureStat(this.gameData, user.creature, Stat.HP);
		let damage = Math.min(hp, user.creature.status.damage + this.getConfusionDamage(user));
		let dealt = damage - user.creature.status.damage;
		user.creature.status.damage = damage;

		events.push({
			type: "damage-dealt",
			target: userPosition,
			damage: dealt,
			remainingHP: hp - user.creature.status.damage,
		});

		if (this.isCombatantFainted(user)) {
			this.clearActiveCombatant(userPosition);
			events.push({ type: "creature-fainted", target: userPosition });
		}

		return true;
	}

	private getConfusionDamage(user: CombatantState): number {
		let attack = Math.floor(
			getCreatureStat(this.gameData, user.creature, Stat.Attack) *
				this.getStageModifier(user.statStages[Stat.Attack]),
		);
		let defense = Math.floor(
			getCreatureStat(this.gameData, user.creature, Stat.Defense) *
				this.getStageModifier(user.statStages[Stat.Defense]),
		);
		let level = getCreatureLevel(this.gameData, user.creature);

		return Math.floor(Math.floor((((2 * level) / 5 + 2) * 40 * attack) / defense) / 50) + 2;
	}

	private getStabModifier(user: CombatantState, move: Move) {
		let species = getCreatureSpecies(this.gameData, user.creature);
		if (species.types.includes(move.type)) return 1.5;
		return 1;
	}

	private isCombatantFainted(combatant: CombatantState): boolean {
		return (
			combatant.creature.status.damage >=
			getCreatureStat(this.gameData, combatant.creature, Stat.HP)
		);
	}

	private finishBattle(winnerSide: number): BattleEvent.BattleFinishedEvent {
		this.state.winnerSide = winnerSide;
		this.state.phase = "finished";
		return { type: "battle-finished", winnerSide };
	}
}
