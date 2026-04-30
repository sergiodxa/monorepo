import type { GameData } from "../domain/game-data";
import type { Move, MoveEffect } from "../domain/move";

import { Class, StatusEffectType } from "../domain/move";
import { Stat } from "../domain/stat";
import { Effectiveness } from "../domain/type";

import { CombatantState } from "./combatant-state";
import { Creature, State } from "./creature";
import { getCreatureLevel, getCreatureSpecies, getCreatureStat } from "./mechanics";

const CRITICAL_HIT_CHANCE = 1 / 24;

type TurnCommands = [TurnCommand, TurnCommand];

interface TurnAction {
	side: number;
	command: FightCommand;
	user: CombatantState;
	target: CombatantState;
	moveId: string;
	move: Move;
	priority: number;
	speed: number;
}

type MoveEffectHandlerMap = {
	[kind in MoveEffect["kind"]]: (
		user: CombatantState,
		target: CombatantState,
		effect: Extract<MoveEffect, { kind: kind }>,
	) => BattleEvent[];
};

/** Identifies one active battle slot. */
export interface BattlePosition {
	side: number;
	slot: number;
}

/** Player or AI move selection for one active combatant. */
export interface FightCommand {
	type: "fight";
	move: 0 | 1 | 2 | 3;
	target: BattlePosition;
}

/** A command submitted for one active combatant during the input phase. */
export type TurnCommand = FightCommand;

export namespace BattleEvent {
	/** Requests turn commands for all active combatants that can act this turn. */
	export interface TurnCommandsRequestedEvent {
		type: "request-turn-commands";
		requests: [BattlePosition, BattlePosition];
	}

	export interface BattleStarted {
		type: "battle-started";
	}

	export interface TurnStarted {
		type: "turn-started";
		turn: number;
	}

	export interface MoveUsed {
		type: "move-used";
		user: BattlePosition;
		moveId: string;
		target: BattlePosition;
	}

	export interface EffectivenessEvent {
		type: "effectiveness";
		target: BattlePosition;
		effectiveness: Effectiveness;
	}

	export interface CriticalHitEvent {
		type: "critical-hit";
		target: BattlePosition;
	}

	export interface DamageDealtEvent {
		type: "damage-dealt";
		target: BattlePosition;
		damage: number;
		remainingHP: number;
	}

	export interface StatusAppliedEvent {
		type: "status-applied";
		target: BattlePosition;
		status: State;
	}

	export interface CreatureFaintedEvent {
		type: "creature-fainted";
		target: BattlePosition;
	}

	export interface TurnEndedEvent {
		type: "turn-ended";
		turn: number;
	}

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
	| BattleEvent.MoveUsed
	| BattleEvent.EffectivenessEvent
	| BattleEvent.CriticalHitEvent
	| BattleEvent.DamageDealtEvent
	| BattleEvent.StatusAppliedEvent
	| BattleEvent.CreatureFaintedEvent
	| BattleEvent.TurnEndedEvent
	| BattleEvent.BattleFinishedEvent;

/** Mutable battle state that the UI/tests can inspect between generator steps. */
export interface BattleState {
	turn: number;
	phase: "idle" | "awaiting-input" | "resolving-turn" | "finished";
	winnerSide: number | null;
	sides: [BattleSideState, BattleSideState];
}

/** Runtime state for one side of the battle. */
export interface BattleSideState {
	active: [CombatantState];
}

/** Long-lived battle session that yields events and accepts commands. */
export type BattleSession = Generator<BattleEvent, BattleEvent, TurnCommands>;

/** Generator that resolves one submitted turn into ordered battle events. */
export type BattleTurnSession = Generator<BattleEvent, void, void>;

export namespace Battle {
	export interface Arguments {
		gameData: GameData;
		creatures: [Creature, Creature];
		random?(): number;
	}
}

/** Resolves battle turns and yields structured events for the caller to render. */
export class Battle {
	readonly state: BattleState;

	private readonly effectHandlers: MoveEffectHandlerMap = {
		none: () => [],
		priority: () => [],
		"apply-status": (_user, target, effect) => this.applyStatusEffect(target, effect),
		"leech-seed": (_user, target) => this.applyLeechSeedEffect(target),
		charge: () => [],
	};

	private readonly gameData: GameData;
	private readonly random: () => number;

	constructor(args: Battle.Arguments) {
		this.gameData = args.gameData;
		this.random = args.random ?? Math.random;
		this.state = {
			turn: 0,
			phase: "idle",
			winnerSide: null,
			sides: [
				{ active: [new CombatantState(args.creatures[0])] },
				{ active: [new CombatantState(args.creatures[1])] },
			],
		};
	}

	get fainted() {
		for (let side of this.state.sides) {
			for (let combatant of side.active) {
				if (
					combatant.creature.status.damage >=
					getCreatureStat(this.gameData, combatant.creature, Stat.HP)
				) {
					return combatant.creature;
				}
			}
		}

		return null;
	}

	/**
	 * Starts a battle session that yields events and pauses for commands every turn.
	 *
	 * @yields Battle lifecycle events, input requests, and move resolution events in display order.
	 * @returns A generator the caller can iterate to drive the battle UI/test flow
	 */
	*start(): BattleSession {
		this.state.phase = "awaiting-input";
		yield { type: "battle-started" };

		while (this.state.phase !== "finished") {
			this.state.turn += 1;
			yield { type: "turn-started", turn: this.state.turn };
			let commands = yield {
				type: "request-turn-commands",
				requests: [
					{ side: 0, slot: 0 },
					{ side: 1, slot: 0 },
				],
			};

			this.state.phase = "resolving-turn";

			for (let event of this.resolveTurn(commands)) {
				yield event;
				if (event.type === "battle-finished") return event;
			}

			yield { type: "turn-ended", turn: this.state.turn };

			this.state.phase = this.state.winnerSide === null ? "awaiting-input" : "finished";
		}

		return { type: "battle-finished", winnerSide: this.state.winnerSide };
	}

	private *resolveTurn(commands: TurnCommands): BattleTurnSession {
		for (let action of this.getTurnActions(commands)) {
			if (this.isCombatantFainted(action.user)) continue;

			yield {
				type: "move-used",
				user: { side: action.side, slot: 0 },
				moveId: action.moveId,
				target: action.command.target,
			};

			let resolution = this.resolveMove(action.user, action.target, action.move);
			for (let event of resolution.events) yield event;

			if (resolution.finished) {
				yield this.finishBattle(action.side);
				return;
			}
		}
	}

	private getTurnActions(commands: TurnCommands): TurnAction[] {
		let actions: TurnAction[] = [];

		for (let [sideIndex, command] of commands.entries()) {
			let user = this.state.sides[sideIndex]!.active[0]!;
			let target = this.state.sides[command.target.side]!.active[command.target.slot]!;
			let moveId = user.creature.moveset[command.move];
			if (command.type !== "fight" || !moveId) continue;

			let move = this.gameData.moves.get(moveId);
			if (!move) throw new ReferenceError(`Move ${moveId} not found in game data.`);

			actions.push({
				side: sideIndex,
				command,
				user,
				target,
				moveId,
				move,
				priority: this.getMovePriority(move),
				speed: getCreatureStat(this.gameData, user.creature, Stat.Speed),
			});
		}

		actions.sort((left, right) => {
			if (left.priority !== right.priority) return right.priority - left.priority;
			if (left.speed !== right.speed) return right.speed - left.speed;
			return left.side - right.side;
		});

		return actions;
	}

	private resolveMove(user: CombatantState, target: CombatantState, move: Move) {
		let events: BattleEvent[] = [];

		if (move.class !== Class.Status && move.power > 0) {
			let effectiveness = this.getTypeEffectiveness(target, move);
			let damage = this.calculateDamage(user, target, move, effectiveness, events);
			let targetHP = getCreatureStat(this.gameData, target.creature, Stat.HP);
			let remainingDamage = Math.min(targetHP, target.creature.status.damage + damage);
			target.creature.status.damage = remainingDamage;

			events.push({
				type: "damage-dealt",
				target: this.getCombatantLocation(target),
				damage,
				remainingHP: targetHP - target.creature.status.damage,
			});
		}

		events.push(...this.resolveEffect(user, target, move.effect));

		let targetHP = getCreatureStat(this.gameData, target.creature, Stat.HP);
		if (target.creature.status.damage >= targetHP) {
			events.push({ type: "creature-fainted", target: this.getCombatantLocation(target) });
		}

		return {
			events,
			finished: target.creature.status.damage >= targetHP,
		};
	}

	private *resolveEffect(
		user: CombatantState,
		target: CombatantState,
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
			case "apply-status": {
				for (let event of this.effectHandlers["apply-status"](user, target, effect)) yield event;
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
	): BattleEvent[] {
		if (target.creature.status.state !== null) return [];
		if (this.random() >= effect.chance) return [];

		let status = this.getPersistentStatus(effect.status);
		target.creature.status.state = status;

		return [{ type: "status-applied", target: this.getCombatantLocation(target), status }];
	}

	private applyLeechSeedEffect(target: CombatantState): BattleEvent[] {
		target.volatile.seeded = true;
		return [];
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

	private getMovePriority(move: Move): number {
		if (move.effect.kind === "priority") return move.effect.value;
		return 0;
	}

	private calculateDamage(
		user: CombatantState,
		target: CombatantState,
		move: Move,
		effectiveness: Effectiveness,
		events: BattleEvent[],
	): number {
		let damage = this.getBaseDamage(user, target, move);
		damage = Math.floor(damage * this.getStabModifier(user, move));

		if (effectiveness !== Effectiveness.NORMAL) {
			events.push({
				type: "effectiveness",
				target: this.getCombatantLocation(target),
				effectiveness,
			});
		}

		if (effectiveness === Effectiveness.SUPER) damage = Math.floor(damage * 2);
		if (effectiveness === Effectiveness.WEAK) damage = Math.floor(damage * 0.5);
		if (effectiveness === Effectiveness.ZERO) damage = 0;

		if (this.random() < CRITICAL_HIT_CHANCE) {
			damage = Math.floor(damage * 1.5);
			events.push({ type: "critical-hit", target: this.getCombatantLocation(target) });
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
				? getCreatureStat(this.gameData, user.creature, Stat.Attack)
				: getCreatureStat(this.gameData, user.creature, Stat.SpecialAttack);
		let defenseStat =
			move.class === Class.Physical
				? getCreatureStat(this.gameData, target.creature, Stat.Defense)
				: getCreatureStat(this.gameData, target.creature, Stat.SpecialDefense);
		let level = getCreatureLevel(this.gameData, user.creature);

		return (
			Math.floor(Math.floor((((2 * level) / 5 + 2) * move.power * attackStat) / defenseStat) / 50) +
			2
		);
	}

	private getStabModifier(user: CombatantState, move: Move) {
		let species = getCreatureSpecies(this.gameData, user.creature);
		if (species.types.includes(move.type)) return 1.5;
		return 1;
	}

	private getCombatantLocation(combatant: CombatantState): BattlePosition {
		for (let [sideIndex, side] of this.state.sides.entries()) {
			for (let [slotIndex, active] of side.active.entries()) {
				if (active === combatant) return { side: sideIndex, slot: slotIndex };
			}
		}

		throw new ReferenceError("Combatant not found in battle state.");
	}

	private isCombatantFainted(combatant: CombatantState): boolean {
		return (
			combatant.creature.status.damage >=
			getCreatureStat(this.gameData, combatant.creature, Stat.HP)
		);
	}

	private finishBattle(winnerSide: number): BattleEvent {
		this.state.winnerSide = winnerSide;
		this.state.phase = "finished";
		return { type: "battle-finished", winnerSide };
	}
}
