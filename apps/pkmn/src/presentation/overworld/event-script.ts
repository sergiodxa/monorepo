/**
 * A sequential interpreter for an event interaction's declarative script.
 *
 * An event's `interaction.script` is a list of `ScriptCommand`s (see `map-schema`)
 * that must run in order, and some commands block: a `message` waits for the
 * player to dismiss the dialogue, a battle command waits for the battle to end,
 * and a `warp` ends the run because the map is being reloaded underneath it. This
 * module runs that list against a host interface the scene implements, keeping the
 * sequencing logic pure and testable while the host owns the actual dialogue,
 * engine dispatch, and scene pushes.
 *
 * The runner is a small pull-driven state machine rather than an async function:
 * `advance()` runs synchronous commands (set-flag, give-item, heal-party,
 * face-player, move) immediately and stops at the first blocking command, calling
 * the matching host hook and parking until the host reports completion via
 * `resume()`. This suits the fixed-timestep loop (no promises mid-frame) and lets
 * a test drive a whole script by calling `advance`/`resume` and asserting the host
 * calls happen in order. All franchise vocabulary stays out of here: the runner
 * only forwards authored command data to the host.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Direction } from "../core/direction";
import type { ScriptCommand } from "../render/map-schema";

/** Trainer battle data an event fights with, forwarded to the host verbatim. */
export interface TrainerBattleData {
	name?: string;
	party: Array<{ speciesId: string; level: number }>;
	reward?: number;
}

/** Fixed wild-creature data a `wild` event battles with. */
export interface WildBattleData {
	speciesId: string;
	level: number;
}

/**
 * The side-effect surface a running script drives.
 *
 * Synchronous hooks (setFlag, giveItem, healParty, facePlayer, move) apply an
 * effect and let the script continue on the same `advance`. Blocking hooks
 * (showMessage, startTrainerBattle, startWildBattle, warp) begin an effect the
 * runner then parks on; the host calls `resume()` once it finishes. `warp` never
 * resumes — the map reload replaces the runner — so the run ends after it.
 */
export interface ScriptHost {
	/** Shows one dialogue line and later calls `resume()` when it is dismissed. */
	showMessage(text: string): void;
	/** Adds items to the player's bag (maps to the engine's add-inventory-item). */
	giveItem(itemId: string, count: number): void;
	/** Fully restores the player's party (maps to heal-party). */
	healParty(): void;
	/** Sets a story flag to true (maps to set-flag). */
	setFlag(flag: string): void;
	/** Turns the interacting event to face the player. */
	facePlayer(): void;
	/** Steps the event along an authored route (best-effort overworld nicety). */
	move(route: Direction[]): void;
	/** Starts a trainer battle by id, then calls `resume()` when it ends. */
	startTrainerBattle(trainerId: string, data: TrainerBattleData | undefined): void;
	/** Reloads the map at a new position; the run ends here (no resume). */
	warp(toMap: string, toX: number, toY: number): void;
}

/** Whether a runner is idle between steps, parked on a blocking step, or finished. */
export type ScriptStatus = "idle" | "blocked" | "done";

/**
 * Drives one script's commands in order against a {@link ScriptHost}.
 *
 * Construct with the script, the host, and the optional trainer/wild data pulled
 * from the event's interaction, then call `advance()` to run until the script
 * blocks or finishes. While blocked, the host drives its effect and calls
 * `resume()` to continue; `advance()` is idempotent while blocked or done, so the
 * scene can call it every frame without double-running a step.
 */
export class ScriptRunner {
	/** Index of the next command to run. */
	private cursor = 0;

	/** Current run state: idle (ready to advance), blocked (waiting), or done. */
	private state: ScriptStatus = "idle";

	/**
	 * @param script - The ordered commands to run.
	 * @param host - The side-effect surface the commands drive.
	 * @param trainer - Trainer battle data for `start-trainer-battle` steps, if any.
	 * @param wild - Wild battle data for the event's `wild` battle, if any.
	 */
	constructor(
		private readonly script: readonly ScriptCommand[],
		private readonly host: ScriptHost,
		private readonly trainer?: TrainerBattleData,
		private readonly wild?: WildBattleData,
	) {}

	/** Whether the whole script has finished running. */
	get done(): boolean {
		return this.state === "done";
	}

	/** Whether the runner is parked on a blocking step awaiting `resume()`. */
	get blocked(): boolean {
		return this.state === "blocked";
	}

	/**
	 * Runs commands until one blocks or the script ends.
	 *
	 * Synchronous commands run back-to-back within one call; the first blocking
	 * command begins its host effect and parks the runner. A no-op while already
	 * blocked or done, so it is safe to call once per frame.
	 */
	advance() {
		if (this.state !== "idle") return;
		while (this.cursor < this.script.length) {
			let command = this.script[this.cursor]!;
			this.cursor += 1;
			if (this.run(command)) return; // a blocking command parked the runner
		}
		this.state = "done";
	}

	/**
	 * Resumes after a blocking step the host has finished, running the next steps.
	 *
	 * A no-op unless the runner is actually blocked, so a stray resume cannot skip
	 * a step or advance a finished script.
	 */
	resume() {
		if (this.state !== "blocked") return;
		this.state = "idle";
		this.advance();
	}

	/**
	 * Runs one command; returns true when it blocks (parks the runner).
	 *
	 * Synchronous commands return false so `advance` keeps going. Blocking commands
	 * set the state to blocked and return true; `warp` blocks too but the host is
	 * expected never to resume it, ending the run as the map reloads.
	 */
	private run(command: ScriptCommand): boolean {
		switch (command.do) {
			case "message":
				this.state = "blocked";
				this.host.showMessage(command.text);
				return true;
			case "give-item":
				this.host.giveItem(command.itemId, command.count);
				return false;
			case "heal-party":
				this.host.healParty();
				return false;
			case "set-flag":
				this.host.setFlag(command.flag);
				return false;
			case "face-player":
				this.host.facePlayer();
				return false;
			case "move":
				this.host.move([...command.route]);
				return false;
			case "start-trainer-battle":
				this.state = "blocked";
				this.host.startTrainerBattle(command.trainerId, this.trainer);
				return true;
			case "warp":
				this.state = "blocked";
				this.host.warp(command.toMap, command.toX, command.toY);
				return true;
		}
	}
}
