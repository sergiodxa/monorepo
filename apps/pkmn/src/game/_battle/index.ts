/**
 * Turn-based battle engine modeled as a resumable generator. It defines the battle
 * domain types (combatants, sides, events, and commands) and drives a match as a
 * `Session` generator that yields events and suspends while awaiting player commands.
 *
 * Structuring the battle as a generator keeps the pure game logic decoupled from any
 * particular renderer or input source: callers step the session, react to each event,
 * and feed commands back in, so the same engine can back a UI, tests, or an AI player.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CreatureId } from "../world/ids";

export namespace Battle {
	export interface Combatant {
		creatureId: CreatureId;
		effects: [];
	}

	export interface Side {
		active: Combatant;
		bench: Array<Combatant>;
		effects: [];
	}

	export interface Input {
		sides: [Side, Side];
	}

	/** Mutable battle state that callers can inspect between generator steps. */
	export interface State {
		turn: number;
		phase: "idle" | "awaiting-turn-input" | "awaiting-replacement" | "resolving-turn" | "finished";
		winnerSide: number | null;
		slots: 1 | 2 | 3;
		sides: [Side, Side];
	}

	/** Identifies one battle slot on a side. */
	export interface Position {
		side: number;
		slot: number;
	}

	export namespace Event {
		export interface BattleStarted {
			type: "battle-started";
		}

		export interface BattleEnded {
			type: "battle-ended";
			winner: Side;
		}

		export interface RequestCommands {
			type: "request-commands";
			requests: Position[];
		}

		export interface DamageApplied {
			type: "damage-applied";
			target: Position;
			amount: number;
		}
	}

	export namespace Command {
		export interface Fight {
			type: "fight";
			move: 0 | 1 | 2 | 3;
			target: Position;
			creature?: number;
		}

		export interface Switch {
			type: "switch";
			target: Position;
			creature: number;
		}

		export interface Escape {
			type: "escape";
		}
	}

	export type Event =
		| Event.BattleStarted
		| Event.BattleEnded
		| Event.RequestCommands
		| Event.DamageApplied;
	export type Command = Command.Fight | Command.Switch | Command.Escape;

	export type Session = Generator<Event, Event.BattleEnded, Command>;
}

export class Battle {
	static *start(input: Battle.Input): Battle.Session {
		let { sides } = input;
		let state: Battle.State = {
			turn: 0,
			phase: "idle",
			winnerSide: null,
			slots: 1,
			sides,
		};

		yield { type: "battle-started" };

		while (true) {
			state.turn++;

			let command = yield {
				type: "request-commands",
				requests: sides.map((side, sideIndex) => ({ side: sideIndex, slot: 0 })),
			};

			if (command.type === "fight") {
				console.log(
					`Side ${command.target.side} slot ${command.target.slot} is being attacked with move ${command.move}.`,
				);
				yield { type: "damage-applied", target: command.target, amount: 10 };
			}

			if (state.winnerSide !== null) {
				return { type: "battle-ended", winner: state.sides.at(state.winnerSide)! };
			}
		}
	}
}

let session = Battle.start({
	sides: [
		{ active: { creatureId: "creature1", effects: [] }, bench: [], effects: [] },
		{ active: { creatureId: "creature2", effects: [] }, bench: [], effects: [] },
	],
});

await render(session, session.next().value);

async function render(session: Battle.Session, event: Battle.Event) {
	if (event.type === "battle-started") {
		renderBattleStarted();
		return render(session, session.next().value);
	}

	if (event.type === "request-commands") {
		let command = await renderRequestCommands();
		return render(session, session.next(command).value);
	}

	if (event.type === "damage-applied") {
		renderDamageApplied(event.target, event.amount);
		return render(session, session.next().value);
	}

	if (event.type === "battle-ended") {
		renderBattleEnded(event.winner);
		return;
	}
}
