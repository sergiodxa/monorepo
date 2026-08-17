/**
 * Coordinates the battle domain model and turn-resolution flow for this module.
 * It defines the battle-facing types and orchestrates how combatants, effects,
 * actions, and outcome rules are evaluated during encounters.
 *
 * The module serves as the central integration point for battle systems that
 * compute damage, resolve actions, apply ongoing effects, process replacements,
 * and advance turn state. Its purpose is to keep battle progression consistent,
 * deterministic, and isolated from any particular content set or presentation
 * layer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { GameData } from "~/game/data/game-data";
import type { ItemId, MedicineEffect } from "~/game/data/item";
import type {
	BattleStatStage,
	FieldEffectType,
	Move,
	MoveEffect,
	SideEffectType,
} from "~/game/data/move";

import { DamageClass } from "~/game/data/move";
import { Stat } from "~/game/data/stat";
import { State } from "~/game/data/status";
import { Effectiveness, Type } from "~/game/data/type";
import { applyMedicine } from "~/game/systems/medicine-system";
import { Creature } from "~/game/world/creature";

import { CombatantState } from "./combatant-state";
import { Effects } from "./effects";
import { getCreatureSpecies, getCreatureStat } from "./mechanics";
import { createFieldEffectState, createSideEffectState } from "./state";
import {
	getConfusionDamage as getConfusionDamageSystem,
	getMoveHitCount as getMoveHitCountSystem,
	getResolvedMoveDamage as getResolvedMoveDamageSystem,
} from "./systems/damage";
import {
	applyDelayedAttacks as applyDelayedAttacksSystem,
	applyEndOfTurnEffects as applyEndOfTurnEffectsSystem,
	reconcileAfterTurn as reconcileAfterTurnSystem,
	scheduleDelayedAttacks as scheduleDelayedAttacksSystem,
	tickTurnEffects as tickTurnEffectsSystem,
} from "./systems/end-of-turn";
import { resolveMissingTargetEvents, resolveMoveEvents } from "./systems/move-resolution";
import {
	applySwitchInPipeline,
	applyReplacementCommands as applyReplacementCommandsSystem,
	collectReplacementRequests,
	getBattleOutcome,
	getAvailableReplacementChoices as getAvailableReplacementChoicesSystem,
	getWinnerSide,
	resolveSwitchAction,
} from "./systems/roster";
import { getTurnActions as getOrderedTurnActions, type TurnAction } from "./systems/turn-order";

const CRITICAL_HIT_CHANCE = 1 / 24;
const HIGH_CRITICAL_HIT_CHANCE = 1 / 8;
const VERY_HIGH_CRITICAL_HIT_CHANCE = 1 / 2;

export interface ReplacementSelection {
	side: number;
	slot: number;
	team: number;
	choices: number[];
}

interface DelayedAttackState {
	kind: "future-sight";
	moveId: string;
	user: CombatantState;
	source: BattlePosition;
	target: BattlePosition;
	turnsRemaining: number;
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
	creature?: number;
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

/**
 * Uses a recovery item on one creature during a turn, consuming the acting slot's action.
 *
 * The command carries the already-resolved medicine effect so the battle layer stays
 * content-agnostic: the boundary that owns the inventory looks the item up, decrements
 * it, and submits the generic effect here. `creature` is the team-local index of the
 * target on the acting slot's team, which may be a benched or fainted teammate. A null
 * `effect` marks an item the owning boundary could not actually consume (out of stock
 * or not a medicine); it still spends the action but applies nothing.
 */
export interface UseItemTurnCommand {
	type: "use-item";
	itemId: ItemId;
	effect: MedicineEffect | null;
	creature: number;
}

export type ReplacementInput = Array<ReplacementCommand | LeaveReplacementCommand>;

type BattleInput = TurnCommand[] | ReplacementInput;

/** A command submitted for one active combatant during a turn. */
export type TurnCommand = FightCommand | LeaveTurnCommand | SwitchCommand | UseItemTurnCommand;

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
			| "aqua-ring"
			| "attract"
			| "charged-electric"
			| "confusion"
			| "curse"
			| "destiny-bond"
			| "disable"
			| "endure"
			| "encore"
			| "flinch"
			| "focus-energy"
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
		reason:
			| "attract"
			| "disabled"
			| "encored"
			| "invalid-target"
			| "recharge"
			| "requirement"
			| "taunt";
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

	/** Reports a failed attempt to leave the battle, consuming that combatant's action. */
	export interface EscapeFailedEvent {
		type: "escape-failed";
		user: BattlePosition;
	}

	/** Reports a recovery item used on one creature, with the resulting HP and status. */
	export interface ItemUsedEvent {
		type: "item-used";
		/** The slot whose action was spent using the item. */
		user: BattlePosition;
		/** The item consumed from the bag. */
		itemId: ItemId;
		/** Side and team-local index of the treated creature. */
		side: number;
		team: number;
		creature: number;
		/** HP the treated creature holds after the item resolves. */
		remainingHP: number;
		/** HP restored by the item (zero for a pure status cure). */
		healed: number;
		/** Major status after the item resolves, or null when cured or already healthy. */
		status: State | null;
		/** Whether the item revived a fainted creature. */
		revived: boolean;
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
	| BattleEvent.EscapeFailedEvent
	| BattleEvent.ItemUsedEvent
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
	pendingHealingWishCount: number;
	followMeUserSlot: number | null;
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
	delayedAttacks: DelayedAttackState[];
	/**
	 * Count of failed escape attempts so far, feeding the escape-odds formula.
	 * Optional so partial battle-state fixtures need not track it; absent reads as 0.
	 */
	escapeAttempts?: number;
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
		random?: () => number;
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
			delayedAttacks: [],
			escapeAttempts: 0,
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

		let openingOutcome = this.getResolvedBattleOutcome();
		if (openingOutcome !== undefined) {
			let event = this.finishBattle(openingOutcome);
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

				for (let event of this.applyReplacementCommands(replacementCommands)) {
					yield event;
				}
				this.pendingReplacementRequests = [];
				this.reconcileSideState(0);
				this.reconcileSideState(1);
				this.updateWinnerSide();

				let postReplacementOutcome = this.getResolvedBattleOutcome();
				if (postReplacementOutcome !== undefined) {
					let event = this.finishBattle(postReplacementOutcome);
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

			let turnOutcome = this.getResolvedBattleOutcome();
			if (turnOutcome !== undefined) {
				let event = this.finishBattle(turnOutcome);
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
			creatures: team.map((creature) => {
				let combatant = new CombatantState(creature);
				this.initializeMajorStatusState(combatant, creature.status.state);
				return combatant;
			}),
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
			pendingHealingWishCount: 0,
			followMeUserSlot: null,
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
				if (this.resolveEscapeAttempt(action.userPosition, action.user)) {
					this.forfeitSide(action.userPosition.side);
					return;
				}
				// A failed escape consumes this combatant's action; the rest of the
				// turn (the opposing side's move) still resolves.
				yield { type: "escape-failed", user: action.userPosition };
				continue;
			}

			if (action.command.type === "switch") {
				for (let event of this.resolveSwitch(action)) yield event;
				continue;
			}

			if (action.command.type === "use-item") {
				// Using an item spends this slot's action; the opposing side's move still resolves.
				for (let event of this.resolveItemUse(action.userPosition, action.command)) yield event;
				continue;
			}

			if (this.isCombatantActive(action.userPosition, action.user) === false) continue;
			if (!action.move || !action.moveId) continue;

			let resolvedTargetPosition = this.resolveFollowMeTarget(
				action.userPosition,
				action.move,
				action.command.target,
			);
			let target = this.getActiveCombatant(resolvedTargetPosition);
			if (target === null) {
				for (let event of resolveMissingTargetEvents(
					this.createMoveResolutionContext(),
					action.user,
					action.userPosition,
					action.command,
					action.move,
				)) {
					yield event;
				}
				continue;
			}
			for (let event of this.resolveMove(
				action.user,
				action.userPosition,
				action.command,
				resolvedTargetPosition,
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
		return getOrderedTurnActions(
			{
				state: this.state,
				gameData: this.gameData,
				random: () => this.random(),
				getActiveCombatant: (position) => this.getActiveCombatant(position),
				canCombatantLeaveBattle: (position, combatant) =>
					this.canCombatantLeaveBattle(position, combatant),
				canSwitchCombatant: (position, active, creatureIndex) =>
					this.canSwitchCombatant(position, active, creatureIndex),
				getCombatantSpeed: (position, combatant) => this.getCombatantSpeed(position, combatant),
				getMovePriority: (move) => this.getMovePriority(move),
			},
			requests,
			commands,
		);
	}

	private *resolveSwitch(action: TurnAction) {
		for (let event of resolveSwitchAction(this.createRosterSystemContext(), action)) {
			yield event;
		}
	}

	/**
	 * Applies a recovery item to one creature on the acting slot's side and team.
	 *
	 * The item's action is always spent, matching Gen 3 where using an item consumes
	 * the turn even if it heals nothing. The target is addressed by its team-local
	 * index so benched and fainted teammates can be treated. The medicine effect is
	 * resolved against the target's live HP and status, the persistent damage/status
	 * are updated, and an `item-used` event carries the outcome to the presentation.
	 * A no-op result (full HP, unmatched status cure, revive on a healthy target)
	 * still consumes the turn but reports no change.
	 * @yields {BattleEvent.ItemUsedEvent} The events resulting from the item use.
	 */
	private *resolveItemUse(
		userPosition: BattlePosition,
		command: UseItemTurnCommand,
	): Generator<BattleEvent.ItemUsedEvent, void, void> {
		// A null effect means the owning boundary could not consume the item; the
		// action is still spent, but nothing is applied and no event is emitted.
		if (command.effect === null) return;

		let side = this.state.sides[userPosition.side];
		let active = this.getActiveCombatant(userPosition);
		let teamIndex = active?.teamIndex ?? 0;
		let combatant = side?.teams[teamIndex]?.creatures[command.creature];
		if (!combatant) return;

		let maxHP = getCreatureStat(this.gameData, combatant.creature, Stat.HP);
		let result = applyMedicine(command.effect, {
			currentHP: maxHP - combatant.creature.status.damage,
			maxHP,
			status: combatant.creature.status.state,
		});

		combatant.creature.status.damage = maxHP - result.currentHP;
		if (result.status === null) this.clearMajorStatusState(combatant);
		else combatant.creature.status.state = result.status;

		yield {
			type: "item-used",
			user: userPosition,
			itemId: command.itemId,
			side: userPosition.side,
			team: teamIndex,
			creature: command.creature,
			remainingHP: result.currentHP,
			healed: result.healed,
			status: result.status,
			revived: result.revived,
		};
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
		for (let event of resolveMoveEvents(
			this.createMoveResolutionContext(),
			user,
			userPosition,
			command,
			targetPosition,
			target,
			move,
			moveId,
			isChargingRelease,
		)) {
			yield event;
		}
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
			gameData: this.gameData,
			user,
			userPosition,
			target,
			targetPosition,
			state: this.state,
			random: () => this.random(),
		})) {
			if (event.type === "status-applied") {
				this.initializeMajorStatusState(target, event.status);
			}
			yield event;
		}
	}

	private initializeMajorStatusState(combatant: CombatantState, status: State | null) {
		combatant.majorStatus.sleepTurns = 0;
		if (status !== State.Asleep) return;
		combatant.majorStatus.sleepTurns = this.getSleepTurnDuration();
	}

	private clearMajorStatusState(combatant: CombatantState) {
		combatant.creature.status.state = null;
		combatant.majorStatus.sleepTurns = 0;
	}

	private getSleepTurnDuration() {
		return Math.floor(this.getRandomUnit() * 3) + 1;
	}

	private getRandomUnit() {
		return Math.min(this.random(), 0.9999999999999999);
	}

	private moveThawsUser(move: Move) {
		return move.type === Type.FIRE;
	}

	private resolveSleepBeforeMove(user: CombatantState) {
		if (user.creature.status.state !== State.Asleep) return false;
		if (user.majorStatus.sleepTurns === 0) {
			this.clearMajorStatusState(user);
			return false;
		}

		user.majorStatus.sleepTurns -= 1;
		return true;
	}

	private resolveFreezeBeforeMove(user: CombatantState, move: Move) {
		if (user.creature.status.state !== State.Frozen) return false;
		if (this.moveThawsUser(move) || this.random() < 0.2) {
			this.clearMajorStatusState(user);
			return false;
		}

		return true;
	}

	private applyChargeEffect(user: CombatantState, effect: Extract<MoveEffect, { kind: "charge" }>) {
		user.volatile.charging = true;
		user.volatile.invulnerable = effect.invulnerable ?? true;
	}

	private *reconcileAfterTurn(): Generator<BattleEvent, void, void> {
		for (let event of reconcileAfterTurnSystem(
			this.createEndOfTurnContext(),
			this.pendingReplacementRequests,
		)) {
			yield event;
		}
	}

	private reconcileSideState(sideIndex: number) {
		for (let request of collectReplacementRequests(this.state, sideIndex, (combatant) =>
			this.isCombatantFainted(combatant),
		)) {
			this.pendingReplacementRequests.push(request);
		}
	}

	private updateWinnerSide() {
		this.state.winnerSide = getWinnerSide(this.state, (combatant) =>
			this.isCombatantFainted(combatant),
		);
	}

	private getResolvedBattleOutcome() {
		return getBattleOutcome(this.state, (combatant) => this.isCombatantFainted(combatant));
	}

	private getAvailableReplacementChoices(sideIndex: number, teamIndex: number): number[] {
		return getAvailableReplacementChoicesSystem(this.state, sideIndex, teamIndex, (combatant) =>
			this.isCombatantFainted(combatant),
		);
	}

	private applyReplacementCommands(commands: ReplacementInput): BattleEvent[] {
		return applyReplacementCommandsSystem(
			this.createRosterSystemContext(),
			this.pendingReplacementRequests,
			commands,
		);
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

	/**
	 * Rolls the standard escape-odds formula for one combatant leaving the battle.
	 *
	 * Compares the leaving combatant's effective Speed against the opposing active
	 * combatant's. A faster (or equal) escapee always gets away. Otherwise the odds
	 * grow with the running failed-attempt count via
	 * `F = floor(pSpd * 128 / eSpd) + 30 * attempts`: `F >= 256` always succeeds,
	 * else success needs `randomInt(0..255) < F`. Each failure bumps the attempt
	 * counter so repeated tries become more likely. With no opposing combatant the
	 * escape trivially succeeds.
	 *
	 * @returns Whether the escape succeeds; a failure has already incremented the attempt count.
	 */
	private resolveEscapeAttempt(position: BattlePosition, combatant: CombatantState): boolean {
		let opponentSide = position.side === 0 ? 1 : 0;
		let opponent = this.getOpposingActiveCombatant(opponentSide);
		if (opponent === null) return true;

		let escapeeSpeed = this.getCombatantSpeed(position, combatant);
		let opponentSpeed = this.getCombatantSpeed(opponent.position, opponent.combatant);
		if (escapeeSpeed >= opponentSpeed) return true;

		let attempts = this.state.escapeAttempts ?? 0;
		let threshold = Math.floor((escapeeSpeed * 128) / opponentSpeed) + 30 * attempts;
		if (threshold >= 256) return true;

		if (Math.floor(this.getRandomUnit() * 256) < threshold) return true;

		this.state.escapeAttempts = attempts + 1;
		return false;
	}

	/** Returns the first active combatant on one side with its position, if any. */
	private getOpposingActiveCombatant(
		sideIndex: number,
	): { position: BattlePosition; combatant: CombatantState } | null {
		let side = this.state.sides[sideIndex];
		if (!side) return null;
		for (let [slotIndex, active] of side.active.entries()) {
			if (active === null) continue;
			return { position: { side: sideIndex, slot: slotIndex }, combatant: active.combatant };
		}
		return null;
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
				command.type === "fight" ||
				command.type === "leave-battle" ||
				command.type === "switch" ||
				command.type === "use-item",
		);
	}

	private getMovePriority(move: Move): number {
		for (let effect of this.flattenEffects(move.effect)) {
			if (this.hasEffectKind(effect, "priority")) return effect.value;
			if (effect.kind === "protect") return 4;
			if (effect.kind === "endure") return 4;
		}
		return 0;
	}

	private canMoveHitTarget(move: Move, target: CombatantState): boolean {
		if (target.volatile.invulnerable === false) return true;
		if (move.effect.kind === "charge") return true;
		if (this.state.field.gravityTurns > 0) return true;
		return false;
	}

	private resolveFollowMeTarget(
		userPosition: BattlePosition,
		move: Move,
		targetPosition: BattlePosition,
	): BattlePosition {
		if (targetPosition.side === userPosition.side) return targetPosition;
		if (!this.isMoveRedirectable(move)) return targetPosition;
		let followMeUserSlot = this.state.sides[targetPosition.side]!.followMeUserSlot;
		if (followMeUserSlot === null) return targetPosition;
		let redirectedTarget =
			this.state.sides[targetPosition.side]!.active[followMeUserSlot]?.combatant;
		if (!redirectedTarget) return targetPosition;
		return { side: targetPosition.side, slot: followMeUserSlot };
	}

	private isMoveRedirectable(move: Move): boolean {
		if (move.damageClass !== DamageClass.Status) return true;
		let effects = this.flattenEffects(move.effect);
		return effects.some(
			(effect) =>
				effect.kind === "apply-status" ||
				effect.kind === "attract" ||
				effect.kind === "confuse" ||
				effect.kind === "disable" ||
				effect.kind === "encore" ||
				effect.kind === "identify" ||
				effect.kind === "leech-seed" ||
				effect.kind === "taunt" ||
				(effect.kind === "modify-stat" && effect.target === "target") ||
				(effect.kind === "side-effect" && effect.target === "target"),
		);
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

		return speed;
	}

	private isGrounded(combatant: CombatantState): boolean {
		if (this.state.field.gravityTurns > 0) return true;
		if (combatant.volatile.invulnerable) return false;
		let species = getCreatureSpecies(this.gameData, combatant.creature);
		return species.types.includes(Type.FLYING) === false;
	}

	private resetSwitchVolatiles(combatant: CombatantState) {
		this.resetStatStages(combatant);
		combatant.volatile.seeded = false;
		combatant.volatile.seededBy = null;
		combatant.volatile.trapped = false;
		combatant.volatile.confusionTurns = 0;
		combatant.volatile.invulnerable = false;
		combatant.volatile.flinched = false;
		combatant.volatile.protecting = false;
		combatant.volatile.enduring = false;
		combatant.volatile.protectionSuccessStreak = 0;
		combatant.volatile.successfulProtectionThisTurn = false;
		combatant.volatile.destinyBonded = false;
		combatant.volatile.chargedElectric = false;
		combatant.volatile.focusEnergy = false;
		combatant.volatile.criticalHitStages = 0;
		combatant.volatile.aquaRing = false;
		combatant.volatile.cursed = false;
		combatant.volatile.partiallyTrappedTurns = 0;
		combatant.volatile.partialTrapSourceSide = null;
		combatant.volatile.charging = false;
		combatant.volatile.chargingMoveId = null;
		combatant.volatile.recharging = false;
		combatant.volatile.actedThisBattle = false;
		combatant.volatile.identified = false;
		combatant.volatile.attracted = false;
		combatant.volatile.attractedBy = null;
		combatant.volatile.tauntedTurns = 0;
		combatant.volatile.encoreTurns = 0;
		combatant.volatile.encoredMoveSlot = null;
		combatant.volatile.disabledMoveSlot = null;
		combatant.volatile.disableTurns = 0;
		combatant.volatile.lastDamageThisTurn = null;
		combatant.volatile.escalatingPoisonStage =
			combatant.creature.status.poison === "escalating" ? 1 : 0;
	}

	private resetStatStages(combatant: CombatantState) {
		for (let [stat, value] of Object.entries(combatant.statStages)) {
			if (value === 0) continue;
			combatant.statStages[stat as keyof typeof combatant.statStages] = 0;
		}
	}

	private applySwitchInHazards(position: BattlePosition, combatant: CombatantState): BattleEvent[] {
		let side = this.state.sides[position.side]!;
		let effects = side.effects;
		let events: BattleEvent[] = [];
		let grounded = this.isGrounded(combatant);
		let species = getCreatureSpecies(this.gameData, combatant.creature);
		let canResolveNextHazard = () => this.isCombatantFainted(combatant) === false;

		if (effects.stealthRock && canResolveNextHazard()) {
			let effectiveness = this.getTypeEffectiveness(combatant, {
				type: Type.ROCK,
				damageClass: DamageClass.Physical,
				power: 0,
				accuracy: 0,
				pp: 0,
				effect: { kind: "none" },
			} as Move);
			let damage = Math.max(
				0,
				Math.floor(
					getCreatureStat(this.gameData, combatant.creature, Stat.HP) * (1 / 8) * effectiveness,
				),
			);
			events.push({ type: "hazard-triggered", target: position, effect: "stealth-rock" });
			if (damage > 0) this.applyDamage(combatant, position, damage, events);
		}

		if (effects.spikesLayers > 0 && grounded && canResolveNextHazard()) {
			let fraction =
				effects.spikesLayers === 1 ? 1 / 8 : effects.spikesLayers === 2 ? 1 / 6 : 1 / 4;
			let damage = Math.max(
				1,
				Math.floor(getCreatureStat(this.gameData, combatant.creature, Stat.HP) * fraction),
			);
			events.push({ type: "hazard-triggered", target: position, effect: "spikes" });
			this.applyDamage(combatant, position, damage, events);
		}

		if (effects.toxicSpikesLayers > 0 && grounded && canResolveNextHazard()) {
			if (species.types.includes(Type.POISON)) {
				effects.toxicSpikesLayers = 0;
				events.push({ type: "hazard-triggered", target: position, effect: "toxic-spikes" });
			} else if (
				Effects.canApplyMajorStatus(State.Poisoned, {
					gameData: this.gameData,
					target: combatant,
					targetPosition: position,
					state: this.state,
				})
			) {
				combatant.creature.status.state = State.Poisoned;
				combatant.creature.status.poison =
					effects.toxicSpikesLayers >= 2 ? "escalating" : "regular";
				this.initializeMajorStatusState(combatant, State.Poisoned);
				events.push({ type: "hazard-triggered", target: position, effect: "toxic-spikes" });
				events.push({ type: "status-applied", target: position, status: State.Poisoned });
			}
		}

		if (effects.stickyWeb && grounded && canResolveNextHazard()) {
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
		if (move.damageClass !== DamageClass.Status && move.power > 0) return true;
		return effects.some(
			(effect) =>
				effect.kind === "counter-last-physical-hit" ||
				effect.kind === "counter-last-special-hit" ||
				effect.kind === "counter-last-any-hit" ||
				effect.kind === "fixed-damage" ||
				effect.kind === "fixed-damage-user-hp" ||
				effect.kind === "fixed-damage-target-hp-gap" ||
				effect.kind === "double-power-on-damaged-target" ||
				effect.kind === "double-power-if-target-damaged-this-turn" ||
				effect.kind === "double-power-on-status-target" ||
				effect.kind === "power-from-target-speed" ||
				effect.kind === "power-from-user-speed" ||
				effect.kind === "power-from-user-hp" ||
				effect.kind === "power-from-weight" ||
				effect.kind === "ohko",
		);
	}

	private isEffectBlockedByProtect(effect: MoveEffect): boolean {
		switch (effect.kind) {
			case "none":
			case "priority":
			case "recoil":
			case "drain":
			case "multi-hit":
			case "fixed-damage":
			case "fixed-damage-user-hp":
			case "ohko":
			case "charge":
			case "break-protect": {
				return false;
			}
			default: {
				return true;
			}
		}
	}

	private tickTurnEffects() {
		tickTurnEffectsSystem(this.state);
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

		if (user.volatile.tauntedTurns > 0 && move.damageClass === DamageClass.Status) {
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

		if (user.volatile.attracted) {
			if (this.hasActiveAttractionSource(user) === false) {
				this.clearAttraction(user);
			} else if (this.random() < 0.5) {
				events.push({ type: "move-failed", user: userPosition, reason: "attract" });
				return true;
			}
		}

		if (this.resolveSleepBeforeMove(user)) return true;
		if (this.resolveFreezeBeforeMove(user, move)) return true;
		if (user.volatile.flinched) return true;
		if (user.creature.status.state === State.Paralyzed && this.random() < 0.25) return true;
		return this.resolveConfusion(user, userPosition, events);
	}

	private moveCanConnect(user: CombatantState, target: CombatantState, move: Move): boolean {
		if (this.canMoveHitTarget(move, target) === false) return false;
		if (move.accuracy === 0) return true;

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
		userPosition: BattlePosition,
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

			totalDamage += this.applyAttackDamage(
				target,
				targetPosition,
				damage,
				effects,
				userPosition,
				move.damageClass,
				events,
			);
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

	private applyDrainHealing(
		user: CombatantState,
		userPosition: BattlePosition,
		target: CombatantState,
		effects: MoveEffect[],
		damageDealt: number,
		events: BattleEvent[],
	) {
		let drain = this.findEffect(effects, "drain");
		if (!drain || damageDealt === 0) return;
		if (drain.requiresSleepingTarget && target.creature.status.state !== State.Asleep) return;

		let previous = user.creature.status.damage;
		user.creature.status.damage = Math.max(
			0,
			previous - Math.max(1, Math.floor(damageDealt * drain.ratio)),
		);
		let healed = previous - user.creature.status.damage;
		if (healed === 0) return;

		events.push({
			type: "damage-dealt",
			target: userPosition,
			damage: 0,
			remainingHP: this.getRemainingHP(user),
		});
	}

	private applyBellyDrum(
		user: CombatantState,
		userPosition: BattlePosition,
		effects: MoveEffect[],
		events: BattleEvent[],
	) {
		if (!this.findEffect(effects, "belly-drum")) return;
		let maxHP = getCreatureStat(this.gameData, user.creature, Stat.HP);
		let currentHP = this.getRemainingHP(user);
		if (currentHP <= Math.floor(maxHP / 2)) return;
		let cost = Math.floor(maxHP / 2);
		user.creature.status.damage += cost;
		user.statStages[Stat.Attack] = 6;
		events.push({
			type: "damage-dealt",
			target: userPosition,
			damage: cost,
			remainingHP: this.getRemainingHP(user),
		});
		events.push({
			type: "stat-stage-changed",
			target: userPosition,
			stat: Stat.Attack,
			stages: 6,
			value: 6,
		});
	}

	private applyCrashOnMiss(
		user: CombatantState,
		userPosition: BattlePosition,
		effects: MoveEffect[],
		events: BattleEvent[],
	) {
		let crash = this.findEffect(effects, "crash-on-miss");
		if (!crash) return;
		let maxHP = getCreatureStat(this.gameData, user.creature, Stat.HP);
		let damage = Math.max(1, Math.floor(maxHP * crash.ratio));
		this.applyDamage(user, userPosition, damage, events);
	}

	private resolvePreHitFailure(
		user: CombatantState,
		userPosition: BattlePosition,
		target: CombatantState,
		targetPosition: BattlePosition,
		effects: MoveEffect[],
		events: BattleEvent[],
	): boolean {
		if (this.isProtectionSuccessDeclined(user, effects)) {
			events.push({ type: "move-failed", user: userPosition, reason: "requirement" });
			user.volatile.protectionSuccessStreak = 0;
			user.volatile.successfulProtectionThisTurn = false;
			return true;
		}

		if (this.findEffect(effects, "first-turn-only") && user.volatile.actedThisBattle) {
			events.push({ type: "move-failed", user: userPosition, reason: "requirement" });
			return true;
		}

		if (
			this.findEffect(effects, "fail-if-user-damaged-this-turn") &&
			user.volatile.lastDamageThisTurn !== null
		) {
			events.push({ type: "move-failed", user: userPosition, reason: "requirement" });
			user.volatile.actedThisBattle = true;
			user.volatile.destinyBonded = false;
			return true;
		}

		if (this.findEffect(effects, "belly-drum")) {
			let maxHP = getCreatureStat(this.gameData, user.creature, Stat.HP);
			if (this.getRemainingHP(user) <= Math.floor(maxHP / 2)) {
				events.push({ type: "move-failed", user: userPosition, reason: "requirement" });
				return true;
			}
		}

		if (
			this.findEffect(effects, "fixed-damage-target-hp-gap") &&
			this.getRemainingHP(target) <= this.getRemainingHP(user)
		) {
			events.push({ type: "move-failed", user: userPosition, reason: "requirement" });
			return true;
		}

		for (let effect of effects) {
			if (
				effect.kind === "side-effect" &&
				this.sideEffectAtCap(effect, userPosition, targetPosition)
			) {
				events.push({ type: "move-failed", user: userPosition, reason: "requirement" });
				return true;
			}

			if (effect.kind === "field-effect" && this.fieldEffectAtCap(effect)) {
				events.push({ type: "move-failed", user: userPosition, reason: "requirement" });
				return true;
			}
		}

		return false;
	}

	private isProtectionSuccessDeclined(user: CombatantState, effects: MoveEffect[]): boolean {
		if (effects.some((effect) => effect.kind === "protect" || effect.kind === "endure") === false) {
			return false;
		}

		let chance = 1 / 2 ** user.volatile.protectionSuccessStreak;
		if (chance >= 1) return false;
		return this.random() >= chance;
	}

	private sideEffectAtCap(
		effect: Extract<MoveEffect, { kind: "side-effect" }>,
		userPosition: BattlePosition,
		targetPosition: BattlePosition,
	): boolean {
		let side = effect.target === "self" ? userPosition.side : targetPosition.side;
		let state = this.state.sides[side]!.effects;

		switch (effect.effect) {
			case "reflect":
				return state.reflectTurns > 0;
			case "light-screen":
				return state.lightScreenTurns > 0;
			case "tailwind":
				return state.tailwindTurns > 0;
			case "safeguard":
				return state.safeguardTurns > 0;
			case "mist":
				return state.mistTurns > 0;
			case "lucky-chant":
				return state.luckyChantTurns > 0;
			case "spikes":
				return state.spikesLayers >= 3;
			case "toxic-spikes":
				return state.toxicSpikesLayers >= 2;
			case "stealth-rock":
				return state.stealthRock;
			case "sticky-web":
				return state.stickyWeb;
		}
	}

	private fieldEffectAtCap(effect: Extract<MoveEffect, { kind: "field-effect" }>): boolean {
		if (this.isToggleRoomFieldEffect(effect.effect)) return false;

		switch (effect.effect) {
			case "trick-room":
				return this.state.field.trickRoomTurns > 0;
			case "gravity":
				return this.state.field.gravityTurns > 0;
			case "wonder-room":
				return this.state.field.wonderRoomTurns > 0;
			case "magic-room":
				return this.state.field.magicRoomTurns > 0;
			case "sun":
			case "rain":
			case "sand":
			case "hail":
			case "snow":
			case "fog":
				return this.state.field.weather === effect.effect;
			case "electric-terrain":
				return this.state.field.terrain === "electric";
			case "grassy-terrain":
				return this.state.field.terrain === "grassy";
			case "misty-terrain":
				return this.state.field.terrain === "misty";
			case "psychic-terrain":
				return this.state.field.terrain === "psychic";
		}
	}

	private isToggleRoomFieldEffect(effect: FieldEffectType): boolean {
		return effect === "trick-room" || effect === "wonder-room" || effect === "magic-room";
	}

	private applyReactiveEffectsAfterDamage(
		user: CombatantState,
		userPosition: BattlePosition,
		target: CombatantState,
		targetPosition: BattlePosition,
		effects: MoveEffect[],
		damageDealt: number,
		events: BattleEvent[],
	) {
		if (damageDealt === 0) return;
		if (this.isCombatantFainted(target)) {
			let boostOnKO = this.findEffect(effects, "boost-on-ko");
			if (boostOnKO) {
				let current = user.statStages[boostOnKO.stat];
				let value = Math.max(-6, Math.min(6, current + boostOnKO.stages));
				user.statStages[boostOnKO.stat] = value;
				events.push({
					type: "stat-stage-changed",
					target: userPosition,
					stat: boostOnKO.stat,
					stages: boostOnKO.stages,
					value,
				});
			}

			if (target.volatile.destinyBonded) {
				this.applyDamage(user, userPosition, this.getRemainingHP(user), events);
			}
		}
	}

	private resolveCurse(
		user: CombatantState,
		userPosition: BattlePosition,
		target: CombatantState,
		targetPosition: BattlePosition,
		effects: MoveEffect[],
		events: BattleEvent[],
	): boolean {
		if (!this.findEffect(effects, "curse")) return false;
		let species = getCreatureSpecies(this.gameData, user.creature);
		if (!species.types.includes(Type.GHOST)) {
			this.applyStatStageChange(user, userPosition, Stat.Attack, 1, events);
			this.applyStatStageChange(user, userPosition, Stat.Defense, 1, events);
			this.applyStatStageChange(user, userPosition, Stat.Speed, -1, events);
			return true;
		}
		let maxHP = getCreatureStat(this.gameData, user.creature, Stat.HP);
		let cost = Math.floor(maxHP / 2);
		if (this.getRemainingHP(user) <= cost) return true;
		user.creature.status.damage += cost;
		target.volatile.cursed = true;
		events.push({
			type: "damage-dealt",
			target: userPosition,
			damage: cost,
			remainingHP: this.getRemainingHP(user),
		});
		events.push({ type: "volatile-applied", target: targetPosition, effect: "curse" });
		return true;
	}

	private applyStatStageChange(
		combatant: CombatantState,
		position: BattlePosition,
		stat: BattleStatStage,
		stages: number,
		events: BattleEvent[],
	) {
		let current = combatant.statStages[stat];
		let value = Math.max(-6, Math.min(6, current + stages));
		combatant.statStages[stat] = value;
		events.push({ type: "stat-stage-changed", target: position, stat, stages, value });
	}

	private applyHealingWish(
		combatant: CombatantState,
		sideIndex: number,
		position: BattlePosition,
	): BattleEvent[] {
		let side = this.state.sides[sideIndex]!;
		if (side.pendingHealingWishCount === 0) return [];
		side.pendingHealingWishCount -= 1;
		combatant.creature.status.damage = 0;
		this.clearMajorStatusState(combatant);
		return [
			{
				type: "damage-dealt",
				target: position,
				damage: 0,
				remainingHP: this.getRemainingHP(combatant),
			},
		];
	}

	private applyHealingWishSelfKO(
		user: CombatantState,
		userPosition: BattlePosition,
		effects: MoveEffect[],
		events: BattleEvent[],
	) {
		if (!this.findEffect(effects, "healing-wish")) return;
		this.applyDamage(user, userPosition, this.getRemainingHP(user), events);
	}

	private applyForceSwitchTarget(
		targetPosition: BattlePosition,
		target: CombatantState,
		move: Move,
		effects: MoveEffect[],
		damageDealt: number,
		events: BattleEvent[],
	) {
		if (!this.findEffect(effects, "force-switch-target")) return;
		if (target.volatile.protecting) return;
		if (move.damageClass !== DamageClass.Status && damageDealt === 0) return;
		if (this.isCombatantFainted(target)) return;
		let active = this.getActiveCombatant(targetPosition);
		if (!active) return;
		let choices = this.getAvailableReplacementChoices(targetPosition.side, active.teamIndex);
		if (choices.length === 0) return;
		let index = Math.floor(this.random() * choices.length);
		let creature = choices[index]!;
		this.forceSwitchCombatant(targetPosition, active.teamIndex, creature, events);
	}

	private applySwitchSelf(
		userPosition: BattlePosition,
		command: FightCommand,
		effects: MoveEffect[],
		events: BattleEvent[],
	) {
		let switchSelf = this.findEffect(effects, "switch-self");
		if (!switchSelf) return;
		if (command.creature === undefined) return;
		let active = this.getActiveCombatant(userPosition);
		if (!active) return;
		if (!this.canSwitchCombatant(userPosition, active, command.creature)) return;
		this.switchCombatant(
			userPosition,
			active.teamIndex,
			command.creature,
			switchSelf.preserveStatStages ?? false,
			events,
		);
	}

	private forceSwitchCombatant(
		position: BattlePosition,
		teamIndex: number,
		creatureIndex: number,
		events: BattleEvent[],
	) {
		this.switchCombatant(position, teamIndex, creatureIndex, false, events);
	}

	private switchCombatant(
		position: BattlePosition,
		teamIndex: number,
		creatureIndex: number,
		preserveStatStages: boolean,
		events: BattleEvent[],
	) {
		let side = this.state.sides[position.side]!;
		let current = side.active[position.slot];
		if (!current) return;
		let previousStages = structuredClone(current.combatant.statStages);
		this.resetSwitchVolatiles(current.combatant);
		applySwitchInPipeline(
			this.createRosterSystemContext(),
			position,
			teamIndex,
			creatureIndex,
			events,
			{
				emitSwitchEvent: true,
				preserveStatStages: preserveStatStages ? previousStages : undefined,
			},
		);
	}

	private applyDelayedAttacks(): BattleEvent[] {
		return applyDelayedAttacksSystem(this.createEndOfTurnContext());
	}

	private scheduleDelayedAttacks(
		user: CombatantState,
		userPosition: BattlePosition,
		targetPosition: BattlePosition,
		moveId: string,
		effects: MoveEffect[],
	) {
		scheduleDelayedAttacksSystem(
			{
				state: this.state,
				findEffect: (resolvedEffects, kind) => this.findEffect(resolvedEffects, kind),
			},
			user,
			userPosition,
			targetPosition,
			moveId,
			effects,
		);
	}

	private applySelfDestruct(
		user: CombatantState,
		userPosition: BattlePosition,
		effects: MoveEffect[],
		events: BattleEvent[],
	) {
		if (!this.findEffect(effects, "self-destruct")) return;
		this.applyDamage(user, userPosition, this.getRemainingHP(user), events);
	}

	private applyRampageState(user: CombatantState, effects: MoveEffect[], moveSlot: 0 | 1 | 2 | 3) {
		let rampage = this.findEffect(effects, "rampage");
		if (!rampage) return;

		if (user.volatile.rampageTurns === 0) {
			user.volatile.rampageTurns = rampage.turns;
			user.volatile.rampageMoveSlot = moveSlot;
		}

		user.volatile.rampageTurns = Math.max(0, user.volatile.rampageTurns - 1);
		if (user.volatile.rampageTurns === 0) {
			user.volatile.rampageMoveSlot = null;
			user.volatile.confusionTurns = 2;
		}
	}

	private applyEndOfTurnEffects(): BattleEvent[] {
		return applyEndOfTurnEffectsSystem(this.createEndOfTurnContext());
	}

	private getMoveHitCount(effects: MoveEffect[]): number {
		return getMoveHitCountSystem(this.createDamageSystemContext(), effects);
	}

	private getResolvedMoveDamage(
		user: CombatantState,
		target: CombatantState,
		targetPosition: BattlePosition,
		move: Move,
		effects: MoveEffect[],
		events: BattleEvent[],
	): number {
		return getResolvedMoveDamageSystem(
			this.createDamageSystemContext(),
			user,
			target,
			targetPosition,
			move,
			effects,
			events,
		);
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
		effects: MoveEffect[],
		sourcePosition: BattlePosition,
		moveClass: DamageClass,
		events: BattleEvent[],
	): number {
		let maxHP = getCreatureStat(this.gameData, combatant.creature, Stat.HP);
		let floor = this.findEffect(effects, "cannot-ko") ? 1 : 0;
		let next = Math.min(maxHP - floor, combatant.creature.status.damage + damage);
		if (combatant.volatile.enduring) next = Math.min(next, maxHP - 1);
		let dealt = next - combatant.creature.status.damage;
		combatant.creature.status.damage = next;
		if (dealt > 0) {
			combatant.volatile.lastDamageThisTurn = {
				amount: dealt,
				source: sourcePosition,
				moveClass,
			};
		}

		events.push({
			type: "damage-dealt",
			target: position,
			damage: dealt,
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

	private clearAttraction(combatant: CombatantState) {
		combatant.volatile.attracted = false;
		combatant.volatile.attractedBy = null;
	}

	private hasActiveAttractionSource(combatant: CombatantState) {
		if (combatant.volatile.attractedBy === null) return false;

		for (let side of this.state.sides) {
			for (let active of side.active) {
				if (active?.combatant.creature === combatant.volatile.attractedBy) return true;
			}
		}

		return false;
	}

	private getTypeEffectiveness(target: CombatantState, move: Move): Effectiveness {
		let moveMatch = this.gameData.typeChart[move.type] ?? {};
		let targetSpecies = getCreatureSpecies(this.gameData, target.creature);

		return targetSpecies.types.reduce((factor, type) => {
			if (
				target.volatile.identified &&
				type === Type.GHOST &&
				(move.type === Type.NORMAL || move.type === Type.FIGHTING)
			) {
				return factor;
			}

			let matchup = moveMatch[type];
			if (matchup !== undefined) return factor * matchup;
			return factor;
		}, Effectiveness.NORMAL);
	}

	private getCriticalHitChance(user: CombatantState, move: Move): number {
		let stages = user.volatile.criticalHitStages + (move.criticalHitStages ?? 0);
		if (user.volatile.focusEnergy) stages += 2;

		switch (Math.min(stages, 3)) {
			case 0:
				return CRITICAL_HIT_CHANCE;
			case 1:
				return HIGH_CRITICAL_HIT_CHANCE;
			case 2:
				return VERY_HIGH_CRITICAL_HIT_CHANCE;
			default:
				return 1;
		}
	}

	private getCombatantPosition(combatant: CombatantState): BattlePosition {
		for (let [sideIndex, side] of this.state.sides.entries()) {
			for (let [slotIndex, active] of side.active.entries()) {
				if (active?.combatant === combatant) return { side: sideIndex, slot: slotIndex };
			}
		}

		throw new RangeError("Combatant is not currently active.");
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
		let damage = Math.min(
			hp,
			user.creature.status.damage +
				getConfusionDamageSystem(this.createDamageSystemContext(), user),
		);
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

	private getStabModifier(user: CombatantState, move: Move) {
		let species = getCreatureSpecies(this.gameData, user.creature);
		if (species.types.includes(move.type)) return 1.5;
		return 1;
	}

	private createRosterSystemContext() {
		return {
			state: this.state,
			getActiveCombatant: (position: BattlePosition) => this.getActiveCombatant(position),
			clearActiveCombatant: (position: BattlePosition) => this.clearActiveCombatant(position),
			isCombatantFainted: (combatant: CombatantState) => this.isCombatantFainted(combatant),
			resetSwitchVolatiles: (combatant: CombatantState) => this.resetSwitchVolatiles(combatant),
			applySwitchInHazards: (position: BattlePosition, combatant: CombatantState) =>
				this.applySwitchInHazards(position, combatant),
			applyHealingWish: (combatant: CombatantState, sideIndex: number, position: BattlePosition) =>
				this.applyHealingWish(combatant, sideIndex, position),
			forfeitSide: (sideIndex: number) => this.forfeitSide(sideIndex),
		};
	}

	private createDamageSystemContext() {
		return {
			state: this.state,
			gameData: this.gameData,
			random: () => this.random(),
			isGrounded: (combatant: CombatantState) => this.isGrounded(combatant),
			findEffect: <TKind extends MoveEffect["kind"]>(effects: MoveEffect[], kind: TKind) =>
				this.findEffect(effects, kind),
			flattenEffects: (effect: MoveEffect) => this.flattenEffects(effect),
			getRemainingHP: (combatant: CombatantState) => this.getRemainingHP(combatant),
			getTypeEffectiveness: (combatant: CombatantState, move: Move) =>
				this.getTypeEffectiveness(combatant, move),
			getCombatantSide: (combatant: CombatantState) => this.getCombatantSide(combatant),
			getCombatantPosition: (combatant: CombatantState) => this.getCombatantPosition(combatant),
			getCombatantSpeed: (position: BattlePosition, combatant: CombatantState) =>
				this.getCombatantSpeed(position, combatant),
			getStageModifier: (stage: number) => this.getStageModifier(stage),
			getCriticalHitChance: (combatant: CombatantState, move: Move) =>
				this.getCriticalHitChance(combatant, move),
			getStabModifier: (combatant: CombatantState, move: Move) =>
				this.getStabModifier(combatant, move),
		};
	}

	private createMoveResolutionContext() {
		return {
			random: () => this.random(),
			flattenEffects: (effect: MoveEffect) => this.flattenEffects(effect),
			findEffect: <TKind extends MoveEffect["kind"]>(effects: MoveEffect[], kind: TKind) =>
				this.findEffect(effects, kind),
			resolveBeforeMove: (
				user: CombatantState,
				userPosition: BattlePosition,
				move: Move,
				command: FightCommand,
				events: BattleEvent[],
			) => this.resolveBeforeMove(user, userPosition, move, command, events),
			resolveEffect: (
				user: CombatantState,
				userPosition: BattlePosition,
				target: CombatantState,
				targetPosition: BattlePosition,
				move: Move,
				effect: MoveEffect,
			) => Array.from(this.resolveEffect(user, userPosition, target, targetPosition, move, effect)),
			applyChargeEffect: (user: CombatantState, effect: Extract<MoveEffect, { kind: "charge" }>) =>
				this.applyChargeEffect(user, effect),
			resolvePreHitFailure: (
				user: CombatantState,
				userPosition: BattlePosition,
				target: CombatantState,
				targetPosition: BattlePosition,
				effects: MoveEffect[],
				events: BattleEvent[],
			) => this.resolvePreHitFailure(user, userPosition, target, targetPosition, effects, events),
			resolveCurse: (
				user: CombatantState,
				userPosition: BattlePosition,
				target: CombatantState,
				targetPosition: BattlePosition,
				effects: MoveEffect[],
				events: BattleEvent[],
			) => this.resolveCurse(user, userPosition, target, targetPosition, effects, events),
			applyBellyDrum: (
				user: CombatantState,
				userPosition: BattlePosition,
				effects: MoveEffect[],
				events: BattleEvent[],
			) => this.applyBellyDrum(user, userPosition, effects, events),
			moveCanConnect: (user: CombatantState, target: CombatantState, move: Move) =>
				this.moveCanConnect(user, target, move),
			applyCrashOnMiss: (
				user: CombatantState,
				userPosition: BattlePosition,
				effects: MoveEffect[],
				events: BattleEvent[],
			) => this.applyCrashOnMiss(user, userPosition, effects, events),
			isCombatantFainted: (combatant: CombatantState) => this.isCombatantFainted(combatant),
			clearActiveCombatant: (position: BattlePosition) => this.clearActiveCombatant(position),
			moveDealsDamage: (move: Move, effects: MoveEffect[]) => this.moveDealsDamage(move, effects),
			applyMoveDamage: (
				user: CombatantState,
				userPosition: BattlePosition,
				target: CombatantState,
				targetPosition: BattlePosition,
				move: Move,
				effects: MoveEffect[],
				events: BattleEvent[],
			) => this.applyMoveDamage(user, userPosition, target, targetPosition, move, effects, events),
			applyDrainHealing: (
				user: CombatantState,
				userPosition: BattlePosition,
				target: CombatantState,
				effects: MoveEffect[],
				damageDealt: number,
				events: BattleEvent[],
			) => this.applyDrainHealing(user, userPosition, target, effects, damageDealt, events),
			applyRecoilDamage: (
				user: CombatantState,
				userPosition: BattlePosition,
				effects: MoveEffect[],
				damageDealt: number,
				events: BattleEvent[],
			) => this.applyRecoilDamage(user, userPosition, effects, damageDealt, events),
			applySelfDestruct: (
				user: CombatantState,
				userPosition: BattlePosition,
				effects: MoveEffect[],
				events: BattleEvent[],
			) => this.applySelfDestruct(user, userPosition, effects, events),
			applyReactiveEffectsAfterDamage: (
				user: CombatantState,
				userPosition: BattlePosition,
				target: CombatantState,
				targetPosition: BattlePosition,
				effects: MoveEffect[],
				damageDealt: number,
				events: BattleEvent[],
			) =>
				this.applyReactiveEffectsAfterDamage(
					user,
					userPosition,
					target,
					targetPosition,
					effects,
					damageDealt,
					events,
				),
			isEffectBlockedByProtect: (effect: MoveEffect) => this.isEffectBlockedByProtect(effect),
			applyHealingWishSelfKO: (
				user: CombatantState,
				userPosition: BattlePosition,
				effects: MoveEffect[],
				events: BattleEvent[],
			) => this.applyHealingWishSelfKO(user, userPosition, effects, events),
			scheduleDelayedAttacks: (
				user: CombatantState,
				userPosition: BattlePosition,
				targetPosition: BattlePosition,
				moveId: string,
				effects: MoveEffect[],
			) => this.scheduleDelayedAttacks(user, userPosition, targetPosition, moveId, effects),
			applyRampageState: (user: CombatantState, effects: MoveEffect[], moveSlot: 0 | 1 | 2 | 3) =>
				this.applyRampageState(user, effects, moveSlot),
			applySwitchSelf: (
				userPosition: BattlePosition,
				command: FightCommand,
				effects: MoveEffect[],
				events: BattleEvent[],
			) => this.applySwitchSelf(userPosition, command, effects, events),
			applyForceSwitchTarget: (
				targetPosition: BattlePosition,
				target: CombatantState,
				move: Move,
				effects: MoveEffect[],
				damageDealt: number,
				events: BattleEvent[],
			) => this.applyForceSwitchTarget(targetPosition, target, move, effects, damageDealt, events),
		};
	}

	private createEndOfTurnContext() {
		return {
			state: this.state,
			gameData: this.gameData,
			random: () => this.random(),
			flattenEffects: (effect: MoveEffect) => this.flattenEffects(effect),
			findEffect: <TKind extends MoveEffect["kind"]>(effects: MoveEffect[], kind: TKind) =>
				this.findEffect(effects, kind),
			getActiveCombatant: (position: BattlePosition) => this.getActiveCombatant(position),
			clearActiveCombatant: (position: BattlePosition) => this.clearActiveCombatant(position),
			applyMoveDamage: (
				user: CombatantState,
				userPosition: BattlePosition,
				target: CombatantState,
				targetPosition: BattlePosition,
				move: Move,
				effects: MoveEffect[],
				events: BattleEvent[],
			) => this.applyMoveDamage(user, userPosition, target, targetPosition, move, effects, events),
			applyDamage: (
				combatant: CombatantState,
				position: BattlePosition,
				damage: number,
				events: BattleEvent[],
			) => this.applyDamage(combatant, position, damage, events),
			healSeedSource: (sourceSide: number | null, amount: number, events: BattleEvent[]) =>
				this.healSeedSource(sourceSide, amount, events),
			getRemainingHP: (combatant: CombatantState) => this.getRemainingHP(combatant),
			getTypeEffectiveness: (target: CombatantState, move: Move) =>
				this.getTypeEffectiveness(target, move),
			isGrounded: (combatant: CombatantState) => this.isGrounded(combatant),
			isCombatantFainted: (combatant: CombatantState) => this.isCombatantFainted(combatant),
			reconcileSideState: (sideIndex: number) => {
				let requests = [] as ReplacementSelection[];
				for (let request of collectReplacementRequests(this.state, sideIndex, (combatant) =>
					this.isCombatantFainted(combatant),
				)) {
					requests.push(request);
				}
				return requests;
			},
			updateWinnerSide: () => this.updateWinnerSide(),
		};
	}

	private isCombatantFainted(combatant: CombatantState): boolean {
		return (
			combatant.creature.status.damage >=
			getCreatureStat(this.gameData, combatant.creature, Stat.HP)
		);
	}

	private finishBattle(winnerSide: number | null): BattleEvent.BattleFinishedEvent {
		this.state.winnerSide = winnerSide;
		this.state.phase = "finished";
		return { type: "battle-finished", winnerSide };
	}
}
