import type { GameData } from "../domain/game-data";
import type { Move, MoveEffect } from "../domain/move";

import { Class, StatusEffectType } from "../domain/move";
import { Stat } from "../domain/stat";
import { Effectiveness } from "../domain/type";

import { CombatantState } from "./combatant-state";
import { Creature, State } from "./creature";
import { getCreatureLevel, getCreatureSpecies, getCreatureStat } from "./mechanics";

const CRITICAL_HIT_CHANCE = 1 / 24;

/** Player or AI move selection for one active combatant. */
export interface FightCommand {
	type: "fight";
	move: 0 | 1 | 2 | 3;
	target: { side: number; slot: number };
}

/** A command submitted for one active combatant during the input phase. */
export type TurnCommand = FightCommand;

/** Event emitted while a battle session advances. */
export type BattleEvent =
	| { type: "battle-started" }
	| { type: "turn-started"; turn: number }
	| {
			type: "action-required";
			requests: [{ side: number; slot: number }, { side: number; slot: number }];
	  }
	| {
			type: "move-used";
			user: { side: number; slot: number };
			moveId: string;
			target: { side: number; slot: number };
	  }
	| { type: "effectiveness"; target: { side: number; slot: number }; effectiveness: Effectiveness }
	| { type: "critical-hit"; target: { side: number; slot: number } }
	| {
			type: "damage-dealt";
			target: { side: number; slot: number };
			damage: number;
			remainingHP: number;
	  }
	| { type: "status-applied"; target: { side: number; slot: number }; status: State }
	| { type: "creature-fainted"; target: { side: number; slot: number } }
	| { type: "turn-ended"; turn: number }
	| { type: "battle-finished"; winnerSide: number | null };

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
export type BattleSession = Generator<BattleEvent, BattleEvent, [TurnCommand, TurnCommand]>;

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
				type: "action-required",
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

	private *resolveTurn(commands: [TurnCommand, TurnCommand]): Generator<BattleEvent, void, void> {
		for (let [sideIndex, command] of commands.entries()) {
			let user = this.state.sides[sideIndex]!.active[0]!;
			let target = this.state.sides[command.target.side]!.active[command.target.slot]!;
			let moveId = user.creature.moveset[command.move];
			if (command.type !== "fight" || !moveId) continue;

			let move = this.gameData.moves.get(moveId);
			if (!move) throw new ReferenceError(`Move ${moveId} not found in game data.`);

			yield {
				type: "move-used",
				user: { side: sideIndex, slot: 0 },
				moveId,
				target: command.target,
			};

			let resolution = this.resolveMove(user, target, move);
			for (let event of resolution.events) yield event;

			if (resolution.finished) {
				yield this.finishBattle(sideIndex);
				return;
			}
		}
	}

	private resolveMove(user: CombatantState, target: CombatantState, move: Move) {
		let events: BattleEvent[] = [];
		let effectiveness = this.getTypeEffectiveness(user, target, move);
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

		for (let event of this.resolveEffect(user, target, move.effect)) {
			events.push(event);
		}

		if (target.creature.status.damage >= targetHP) {
			events.push({ type: "creature-fainted", target: this.getCombatantLocation(target) });
		}

		return {
			events,
			finished: target.creature.status.damage >= targetHP,
		};
	}

	private *resolveEffect(
		_user: CombatantState,
		target: CombatantState,
		effect: MoveEffect,
	): Generator<BattleEvent, void, void> {
		switch (effect.kind) {
			case "apply-status": {
				if (effect.status === StatusEffectType.Burn && target.creature.status.state === null) {
					if (this.random() < effect.chance) {
						target.creature.status.state = State.Burned;
						yield {
							type: "status-applied",
							target: this.getCombatantLocation(target),
							status: State.Burned,
						};
					}
				}
				return;
			}
			case "leech-seed": {
				target.volatile.seeded = true;
				return;
			}
			default: {
				return;
			}
		}
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

	private getTypeEffectiveness(
		user: CombatantState,
		target: CombatantState,
		move: Move,
	): Effectiveness {
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

	private getCombatantLocation(combatant: CombatantState) {
		for (let [sideIndex, side] of this.state.sides.entries()) {
			for (let [slotIndex, active] of side.active.entries()) {
				if (active === combatant) return { side: sideIndex, slot: slotIndex };
			}
		}

		throw new ReferenceError("Combatant not found in battle state.");
	}

	private finishBattle(winnerSide: number): BattleEvent {
		this.state.winnerSide = winnerSide;
		this.state.phase = "finished";
		return { type: "battle-finished", winnerSide };
	}
}
