import type { Move } from "../domain/move";

import { TYPE_MATCHUPS } from "../content/matchups";
import { MOVES } from "../content/moves";
import { Class, Effect } from "../domain/move";
import { Effectiveness } from "../domain/type";

import { Creature, State } from "./creature";

const CRITICAL_HIT_CHANCE = 1 / 24;

type Fight = { type: "fight"; move: 1 | 2 | 3 | 4; target: "self" | "opponent" };
type TurnCommand = Fight; // | Switch | Item | Run

export class Battle {
	constructor(public readonly creatures: [Creature, Creature]) {}

	get attacker() {
		return this.creatures[0];
	}

	get defender() {
		return this.creatures[1];
	}

	get fainted() {
		return this.creatures.find((pkmn) => pkmn.status.damage >= pkmn.hp);
	}

	turn(_command: [TurnCommand, TurnCommand]) {}

	attack(moveIndex: number) {
		let move = this.attacker.moveset[moveIndex];
		if (!move) throw new Error("No move in this slot");

		let moveData = this.canAttack(moveIndex);
		if (!moveData) return;

		console.log(`${this.attacker.name} uses ${move} on ${this.defender.name}!`);

		let damage = this.calculateDamage(moveData);
		console.log(`${this.defender.name} takes ${damage} damage!`);

		if (moveData.effect === Effect.BURN_SIDE_EFFECT1) {
			console.log(`${move} has a chance to burn the target!`);
			if (this.defender.status.state === null) {
				console.log(`${this.defender.name} is not currently affected by a status condition.`);
				if (Math.random() < 0.1) {
					console.log(`The burn effect activates!`);
					this.defender.status.state = State.Burned;
					console.log(`${this.defender.name} was burned!`);
				} else console.log(`The burn effect did not activate.`);
			} else {
				console.log(
					`${this.defender.name} is already affected by ${this.defender.status.state} and cannot be burned.`,
				);
			}
		}

		if (this.defender.status.damage + damage >= this.defender.hp) {
			console.log(`${this.defender.name} fainted!`);
			this.defender.status.damage = this.defender.hp;
		} else {
			this.defender.status.damage += damage;
		}

		return damage;
	}

	private canAttack(moveIndex: number): Move | false {
		let move = this.attacker.moveset[moveIndex];
		if (!move) {
			console.log(`No move in slot ${moveIndex + 1}`);
			return false;
		}

		let moveData = MOVES[move];
		if (!moveData) {
			console.log(`Invalid move: ${move}`);
			return false;
		}

		if ((this.attacker.status.pp.at(moveIndex) ?? 0) <= 0) {
			console.log(`${this.attacker.name} has no PP left for ${move}!`);
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
			console.log("It's super effective!");
		} else if (effectiveness === Effectiveness.WEAK) {
			damage = Math.floor(damage * 0.5);
			console.log("It's not very effective...");
		} else if (effectiveness === Effectiveness.ZERO) {
			damage = 0;
			console.log("It has no effect!");
		} else {
			console.log("It's effective.");
		}

		if (this.isCriticalHit()) {
			damage = Math.floor(damage * 1.5);
			console.log("A critical hit!");
		}

		damage = Math.floor(damage * this.getRandom());

		return damage;
	}

	private getTypeEffectiveness(move: Move): Effectiveness {
		let moveMatch = TYPE_MATCHUPS[move.type];

		return this.defender.species.types.reduce((factor, type) => {
			if (type in moveMatch) return factor * moveMatch[type];
			return factor;
		}, Effectiveness.NORMAL);
	}

	private getBaseDamage(move: Move) {
		let attackStat =
			move.class === Class.Physical ? this.attacker.attack : this.attacker.specialAttack;
		let defenseStat =
			move.class === Class.Physical ? this.defender.defense : this.defender.specialDefense;

		return (
			Math.floor(
				Math.floor((((2 * this.attacker.level) / 5 + 2) * move.power * attackStat) / defenseStat) /
					50,
			) + 2
		);
	}

	private getStabModified(move: Move) {
		if (this.attacker.species.types.find((type) => type === move.type)) return 1.5;
		return 1;
	}

	private isCriticalHit() {
		return Math.random() < CRITICAL_HIT_CHANCE;
	}

	private getRandom() {
		return (85 + Math.floor(Math.random() * 16)) / 100;
	}
}
