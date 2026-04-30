import type { GameData } from "../content/game-data";
import type { Move } from "../domain/move";

import { Class, Effect } from "../domain/move";
import { Stat } from "../domain/stat";
import { Effectiveness } from "../domain/type";

import { type CombatantState, createCombatantState } from "./combatant-state";
import { Creature, State } from "./creature";
import { getCreatureLevel, getCreatureSpecies, getCreatureStat } from "./mechanics";

const CRITICAL_HIT_CHANCE = 1 / 24;

type Fight = { type: "fight"; move: 1 | 2 | 3 | 4; target: "self" | "opponent" };
type TurnCommand = Fight; // | Switch | Item | Run

export namespace Battle {
	export interface Arguments {
		gameData: GameData;
		creatures: [Creature, Creature];
		random?: () => number;
	}
}

export class Battle {
	private readonly combatants: [CombatantState, CombatantState];
	private readonly gameData: GameData;
	private readonly random: () => number;

	constructor(args: Battle.Arguments) {
		this.gameData = args.gameData;
		this.random = args.random ?? Math.random;
		this.combatants = [
			createCombatantState(args.creatures[0]),
			createCombatantState(args.creatures[1]),
		];
	}

	get creatures(): [Creature, Creature] {
		return [this.combatants[0].creature, this.combatants[1].creature];
	}

	get attacker() {
		return this.combatants[0]!;
	}

	get defender() {
		return this.combatants[1]!;
	}

	get fainted() {
		return this.creatures.find(
			(creature) => creature.status.damage >= getCreatureStat(this.gameData, creature, Stat.HP),
		);
	}

	turn(_command: [TurnCommand, TurnCommand]) {}

	attack(moveIndex: number) {
		let attacker = this.attacker.creature;
		let defender = this.defender.creature;
		let move = attacker.moveset[moveIndex];
		if (!move) throw new Error("No move in this slot");

		let moveData = this.canAttack(moveIndex);
		if (!moveData) return;

		let damage = this.calculateDamage(moveData);

		if (moveData.effect === Effect.BURN_SIDE_EFFECT1) {
			if (defender.status.state === null && this.random() < 0.1) {
				defender.status.state = State.Burned;
			}
		}

		let defenderHP = getCreatureStat(this.gameData, defender, Stat.HP);
		if (defender.status.damage + damage >= defenderHP) {
			defender.status.damage = defenderHP;
		} else {
			defender.status.damage += damage;
		}

		return damage;
	}

	private canAttack(moveIndex: number): Move | false {
		let attacker = this.attacker.creature;
		let move = attacker.moveset[moveIndex];
		if (!move) {
			return false;
		}

		let moveData = this.gameData.moves.get(move);
		if (!moveData) {
			return false;
		}

		if ((attacker.status.pp.at(moveIndex) ?? 0) <= 0) {
			return false;
		}

		return moveData;
	}

	private calculateDamage(move: Move): number {
		let effectiveness = this.getTypeEffectiveness(move);

		let damage = this.getBaseDamage(move);

		damage = Math.floor(damage * this.getStabModified(move));

		if (effectiveness === Effectiveness.SUPER) {
			damage = Math.floor(damage * 2);
		} else if (effectiveness === Effectiveness.WEAK) {
			damage = Math.floor(damage * 0.5);
		} else if (effectiveness === Effectiveness.ZERO) {
			damage = 0;
		}

		if (this.isCriticalHit()) {
			damage = Math.floor(damage * 1.5);
		}

		damage = Math.floor(damage * this.getRandom());

		return damage;
	}

	private getTypeEffectiveness(move: Move): Effectiveness {
		let moveMatch = this.gameData.typeChart[move.type] ?? {};
		let defenderSpecies = getCreatureSpecies(this.gameData, this.defender.creature);

		return defenderSpecies.types.reduce((factor, type) => {
			let matchup = moveMatch[type];
			if (matchup !== undefined) return factor * matchup;
			return factor;
		}, Effectiveness.NORMAL);
	}

	private getBaseDamage(move: Move) {
		let attacker = this.attacker.creature;
		let defender = this.defender.creature;
		let attackStat =
			move.class === Class.Physical
				? getCreatureStat(this.gameData, attacker, 1)
				: getCreatureStat(this.gameData, attacker, 3);
		let defenseStat =
			move.class === Class.Physical
				? getCreatureStat(this.gameData, defender, 2)
				: getCreatureStat(this.gameData, defender, 4);
		let level = getCreatureLevel(this.gameData, attacker);

		return (
			Math.floor(Math.floor((((2 * level) / 5 + 2) * move.power * attackStat) / defenseStat) / 50) +
			2
		);
	}

	private getStabModified(move: Move) {
		let attackerSpecies = getCreatureSpecies(this.gameData, this.attacker.creature);
		if (attackerSpecies.types.find((type) => type === move.type)) return 1.5;
		return 1;
	}

	private isCriticalHit() {
		return this.random() < CRITICAL_HIT_CHANCE;
	}

	private getRandom() {
		return (85 + Math.floor(this.random() * 16)) / 100;
	}
}
