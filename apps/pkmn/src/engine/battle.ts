import type { GameData } from "../domain/game-data";
import type { Move, MoveEffect } from "../domain/move";

import { Class, StatusEffectType } from "../domain/move";
import { Stat } from "../domain/stat";
import { Effectiveness } from "../domain/type";

import { createFieldEffectState, createSideEffectState } from "./battle-state";
import { CombatantState } from "./combatant-state";
import { Creature, State } from "./creature";
import { getCreatureLevel, getCreatureSpecies, getCreatureStat } from "./mechanics";

const CRITICAL_HIT_CHANCE = 1 / 24;

interface TurnAction {
	user: CombatantState;
	userPosition: BattlePosition;
	command: TurnCommand;
	moveId: string;
	move: Move;
	priority: number;
	speed: number;
}

interface ReplacementSelection {
	side: number;
	slot: number;
	team: number;
	choices: number[];
}

interface MoveEffectHandlerMap {
	none(
		user: CombatantState,
		target: CombatantState,
		effect: Extract<MoveEffect, { kind: "none" }>,
	): BattleEvent[];
	priority(
		user: CombatantState,
		target: CombatantState,
		effect: Extract<MoveEffect, { kind: "priority" }>,
	): BattleEvent[];
	trap(
		user: CombatantState,
		target: CombatantState,
		effect: Extract<MoveEffect, { kind: "trap" }>,
	): BattleEvent[];
	confuse(
		user: CombatantState,
		target: CombatantState,
		effect: Extract<MoveEffect, { kind: "confuse" }>,
	): BattleEvent[];
	protect(
		user: CombatantState,
		target: CombatantState,
		effect: Extract<MoveEffect, { kind: "protect" }>,
	): BattleEvent[];
	"modify-stat"(
		user: CombatantState,
		target: CombatantState,
		effect: Extract<MoveEffect, { kind: "modify-stat" }>,
	): BattleEvent[];
	"side-effect"(
		user: CombatantState,
		target: CombatantState,
		effect: Extract<MoveEffect, { kind: "side-effect" }>,
	): BattleEvent[];
	"field-effect"(
		user: CombatantState,
		target: CombatantState,
		effect: Extract<MoveEffect, { kind: "field-effect" }>,
	): BattleEvent[];
	"apply-status"(
		user: CombatantState,
		target: CombatantState,
		effect: Extract<MoveEffect, { kind: "apply-status" }>,
	): State[];
	"leech-seed"(
		user: CombatantState,
		target: CombatantState,
		effect: Extract<MoveEffect, { kind: "leech-seed" }>,
	): BattleEvent[];
	charge(
		user: CombatantState,
		target: CombatantState,
		effect: Extract<MoveEffect, { kind: "charge" }>,
	): BattleEvent[];
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
export type TurnCommand = FightCommand | LeaveTurnCommand;

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
		effect: "confusion" | "protect" | "trap";
	}

	/** Reports a combat stat stage changing during battle. */
	export interface StatStageChangedEvent {
		type: "stat-stage-changed";
		target: BattlePosition;
		stat: Exclude<Stat, Stat.HP>;
		stages: number;
		value: number;
	}

	/** Reports side-wide effects such as Reflect or Tailwind. */
	export interface SideEffectAppliedEvent {
		type: "side-effect-applied";
		side: number;
		effect: "reflect" | "light-screen" | "tailwind";
		turns: number;
	}

	/** Reports shared field effects such as Trick Room. */
	export interface FieldEffectAppliedEvent {
		type: "field-effect-applied";
		effect: "trick-room";
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
	| BattleEvent.StatusAppliedEvent
	| BattleEvent.VolatileAppliedEvent
	| BattleEvent.StatStageChangedEvent
	| BattleEvent.SideEffectAppliedEvent
	| BattleEvent.FieldEffectAppliedEvent
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

	private readonly effectHandlers: MoveEffectHandlerMap = {
		none: () => [],
		priority: () => [],
		trap: (_user, target) => this.applyTrapEffect(target),
		confuse: (_user, target, effect) => this.applyConfusionEffect(target, effect),
		protect: (user) => this.applyProtectEffect(user),
		"modify-stat": (user, target, effect) => this.applyStatChangeEffect(user, target, effect),
		"side-effect": (user, target, effect) => this.applySideEffect(user, target, effect),
		"field-effect": (_user, _target, effect) => this.applyFieldEffect(effect),
		"apply-status": (_user, target, effect) => this.applyStatusEffect(target, effect),
		"leech-seed": (_user, target) => this.applyLeechSeedEffect(target),
		charge: () => [],
	};

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

			this.reconcileAfterTurn();
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

			if (this.isCombatantActive(action.userPosition, action.user) === false) continue;

			let target = this.getActiveCombatant(action.command.target);
			if (target === null) continue;

			yield {
				type: "move-used",
				user: action.userPosition,
				moveId: action.moveId,
				target: action.command.target,
			};

			for (let event of this.resolveMove(
				action.user,
				action.userPosition,
				action.command.target,
				target.combatant,
				action.move,
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
					moveId: "",
					move: this.gameData.moves.get("TACKLE")!,
					priority: Number.POSITIVE_INFINITY,
					speed: Number.POSITIVE_INFINITY,
				});
				continue;
			}

			if (command.type !== "fight") continue;

			let moveId = active.combatant.creature.moveset[command.move];
			if (!moveId) continue;

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

	private *resolveMove(
		user: CombatantState,
		userPosition: BattlePosition,
		targetPosition: BattlePosition,
		target: CombatantState,
		move: Move,
	): Generator<BattleEvent, void, void> {
		let events: BattleEvent[] = [];

		if (user.volatile.confusionTurns > 0) {
			user.volatile.confusionTurns -= 1;
		}

		if (move.class !== Class.Status && move.power > 0 && target.volatile.protecting === false) {
			let effectiveness = this.getTypeEffectiveness(target, move);
			let damage = this.calculateDamage(user, target, targetPosition, move, effectiveness, events);
			let targetHP = getCreatureStat(this.gameData, target.creature, Stat.HP);
			let remainingDamage = Math.min(targetHP, target.creature.status.damage + damage);
			target.creature.status.damage = remainingDamage;

			events.push({
				type: "damage-dealt",
				target: targetPosition,
				damage,
				remainingHP: targetHP - target.creature.status.damage,
			});
		}

		for (let event of this.resolveEffect(user, userPosition, target, targetPosition, move.effect)) {
			events.push(event);
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
		effect: MoveEffect,
	): Generator<BattleEvent, void, void> {
		switch (effect.kind) {
			case "none": {
				for (let event of this.effectHandlers.none(user, target, effect)) yield event;
				return;
			}
			case "priority": {
				for (let event of this.effectHandlers.priority(user, target, effect)) yield event;
				return;
			}
			case "trap": {
				this.effectHandlers.trap(user, target, effect);
				yield { type: "volatile-applied", target: targetPosition, effect: "trap" };
				return;
			}
			case "confuse": {
				this.effectHandlers.confuse(user, target, effect);
				yield { type: "volatile-applied", target: targetPosition, effect: "confusion" };
				return;
			}
			case "protect": {
				this.effectHandlers.protect(user, target, effect);
				yield { type: "volatile-applied", target: userPosition, effect: "protect" };
				return;
			}
			case "modify-stat": {
				let resolvedTargetPosition = effect.target === "self" ? userPosition : targetPosition;
				let [event] = this.effectHandlers["modify-stat"](user, target, effect);
				if (!event || event.type !== "stat-stage-changed") return;
				yield {
					type: "stat-stage-changed",
					target: resolvedTargetPosition,
					stat: event.stat,
					stages: event.stages,
					value: event.value,
				};
				return;
			}
			case "side-effect": {
				let resolvedSide = effect.target === "self" ? userPosition.side : targetPosition.side;
				let [event] = this.effectHandlers["side-effect"](user, target, effect);
				if (!event || event.type !== "side-effect-applied") return;
				yield {
					type: "side-effect-applied",
					side: resolvedSide,
					effect: event.effect,
					turns: event.turns,
				};
				return;
			}
			case "field-effect": {
				for (let event of this.effectHandlers["field-effect"](user, target, effect)) yield event;
				return;
			}
			case "apply-status": {
				for (let status of this.applyStatusEffect(target, effect)) {
					yield { type: "status-applied", target: targetPosition, status };
				}
				return;
			}
			case "leech-seed": {
				for (let event of this.effectHandlers["leech-seed"](user, target, effect)) yield event;
				return;
			}
			case "charge": {
				for (let event of this.effectHandlers.charge(user, target, effect)) yield event;
				return;
			}
			default: {
				return;
			}
		}
	}

	private applyStatusEffect(
		target: CombatantState,
		effect: Extract<MoveEffect, { kind: "apply-status" }>,
	): State[] {
		if (target.creature.status.state !== null) return [];
		if (this.random() >= effect.chance) return [];

		let status = this.getPersistentStatus(effect.status);
		target.creature.status.state = status;

		return [status];
	}

	private applyLeechSeedEffect(target: CombatantState): BattleEvent[] {
		target.volatile.seeded = true;
		return [];
	}

	private applyTrapEffect(target: CombatantState): BattleEvent[] {
		target.volatile.trapped = true;
		return [{ type: "volatile-applied", target: { side: -1, slot: -1 }, effect: "trap" }];
	}

	private applyConfusionEffect(
		target: CombatantState,
		effect: Extract<MoveEffect, { kind: "confuse" }>,
	): BattleEvent[] {
		target.volatile.confusionTurns = effect.turns;
		return [{ type: "volatile-applied", target: { side: -1, slot: -1 }, effect: "confusion" }];
	}

	private applyProtectEffect(user: CombatantState): BattleEvent[] {
		user.volatile.protecting = true;
		return [{ type: "volatile-applied", target: { side: -1, slot: -1 }, effect: "protect" }];
	}

	private applyStatChangeEffect(
		user: CombatantState,
		target: CombatantState,
		effect: Extract<MoveEffect, { kind: "modify-stat" }>,
	): BattleEvent[] {
		let combatant = effect.target === "self" ? user : target;
		let current = combatant.statStages[effect.stat];
		let next = Math.max(-6, Math.min(6, current + effect.stages));
		combatant.statStages[effect.stat] = next;

		return [
			{
				type: "stat-stage-changed",
				target: { side: -1, slot: -1 },
				stat: effect.stat,
				stages: effect.stages,
				value: next,
			},
		];
	}

	private applySideEffect(
		user: CombatantState,
		target: CombatantState,
		effect: Extract<MoveEffect, { kind: "side-effect" }>,
	): BattleEvent[] {
		let side =
			effect.target === "self" ? this.getCombatantSide(user) : this.getCombatantSide(target);

		switch (effect.effect) {
			case "reflect": {
				this.state.sides[side]!.effects.reflectTurns = effect.turns;
				break;
			}
			case "light-screen": {
				this.state.sides[side]!.effects.lightScreenTurns = effect.turns;
				break;
			}
			case "tailwind": {
				this.state.sides[side]!.effects.tailwindTurns = effect.turns;
				break;
			}
		}

		return [{ type: "side-effect-applied", side, effect: effect.effect, turns: effect.turns }];
	}

	private applyFieldEffect(effect: Extract<MoveEffect, { kind: "field-effect" }>): BattleEvent[] {
		switch (effect.effect) {
			case "trick-room": {
				this.state.field.trickRoomTurns = effect.turns;
				break;
			}
		}

		return [{ type: "field-effect-applied", effect: effect.effect, turns: effect.turns }];
	}

	private getPersistentStatus(status: StatusEffectType): State {
		switch (status) {
			case StatusEffectType.Burn: {
				return State.Burned;
			}
			case StatusEffectType.Paralysis: {
				return State.Paralyzed;
			}
			case StatusEffectType.Poison: {
				return State.Poisoned;
			}
			case StatusEffectType.Sleep: {
				return State.Asleep;
			}
			case StatusEffectType.Freeze: {
				return State.Frozen;
			}
			default: {
				throw new RangeError(`Unsupported status effect ${String(status)}.`);
			}
		}
	}

	private reconcileAfterTurn() {
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
		return input.every((command) => command.type === "fight" || command.type === "leave-battle");
	}

	private getMovePriority(move: Move): number {
		if (move.effect.kind === "priority") return move.effect.value;
		if (move.effect.kind === "protect") return 4;
		return 0;
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

		if (this.state.sides[position.side]!.effects.tailwindTurns > 0) {
			speed *= 2;
		}

		return speed;
	}

	private getStageModifier(stage: number): number {
		if (stage >= 0) return (2 + stage) / 2;
		return 2 / (2 + Math.abs(stage));
	}

	private tickTurnEffects() {
		for (let side of this.state.sides) {
			side.effects.reflectTurns = Math.max(0, side.effects.reflectTurns - 1);
			side.effects.lightScreenTurns = Math.max(0, side.effects.lightScreenTurns - 1);
			side.effects.tailwindTurns = Math.max(0, side.effects.tailwindTurns - 1);

			for (let active of side.active) {
				if (!active) continue;
				active.combatant.volatile.flinched = false;
				active.combatant.volatile.protecting = false;
			}
		}

		this.state.field.trickRoomTurns = Math.max(0, this.state.field.trickRoomTurns - 1);
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
			damage = Math.floor(damage * 1.5);
			events.push({ type: "critical-hit", target: targetPosition });
		}

		return Math.floor(damage * ((85 + Math.floor(this.random() * 16)) / 100));
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
		let level = getCreatureLevel(this.gameData, user.creature);
		let baseDamage =
			Math.floor(Math.floor((((2 * level) / 5 + 2) * move.power * attackStat) / defenseStat) / 50) +
			2;
		let targetSide = this.getCombatantSide(target);

		if (move.class === Class.Physical && this.state.sides[targetSide]!.effects.reflectTurns > 0) {
			return Math.floor(baseDamage * 0.5);
		}

		return baseDamage;
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
