/**
 * A resumable interpreter for an event page's declarative command list.
 *
 * Nested commands (`show-choices`, `conditional-branch`) need an explicit
 * frame stack; blocking commands park the runner until the host calls
 * `resume()`, so a fixed-timestep loop drives it one step per frame.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Direction, EventCommand, TrainerParty } from "../render/map-schema";

/**
 * The flag context a running page evaluates `conditional-branch` conditions
 * against. `isFlagOn` reads a global story flag by name; `selfSwitchFlag` maps
 * a self-switch name to the namespaced flag it is stored under.
 */
export interface EventFlagContext {
	/** Reads whether a global switch (story flag) is currently on. */
	isFlagOn(flag: string): boolean;
	/** The namespaced flag name one of this event's self-switches is stored under. */
	selfSwitchFlag(name: string): string;
}

/**
 * The side-effect surface a running page's commands drive. Synchronous hooks
 * apply an effect and let the run continue on the same `advance`; blocking
 * hooks begin an effect and park the runner until the host calls `resume()`.
 */
export interface EventCommandHost {
	/** Shows one message and later calls `resume()` when it is dismissed. */
	showText(text: string): void;
	/**
	 * Presents a choice list and later calls `resume(index)` with the picked choice.
	 *
	 * @param prompt - Optional text shown above the choices.
	 * @param labels - The choice labels, in order; the resumed index picks one.
	 */
	showChoices(prompt: string | undefined, labels: string[]): void;
	/** Turns a global switch (story flag) on or off (maps to set-flag). */
	controlSwitch(flag: string, value: boolean): void;
	/** Turns one of this event's self-switches on or off by its namespaced flag. */
	controlSelfSwitch(flag: string, value: boolean): void;
	/** Adds items to the player's bag (maps to the engine's add-inventory-item). */
	giveItem(itemId: string, count: number): void;
	/** Fully restores the player's party (maps to heal-party). */
	healParty(): void;
	/** Turns the interacting event to face the player. */
	facePlayer(): void;
	/** Steps the event along an authored route (best-effort overworld nicety). */
	move(steps: Direction[]): void;
	/** Starts a non-capturable trainer battle, then calls `resume()` when it ends. */
	startTrainerBattle(trainer: TrainerParty): void;
	/** Starts a capturable wild encounter, then calls `resume()` when it ends. */
	startWildBattle(speciesId: string, level: number): void;
	/** Pauses for a number of frames, then calls `resume()` when they elapse. */
	wait(frames: number): void;
	/** Reloads the map at a new position, ending the run as part of the reload. */
	warp(map: string, x: number, y: number): void;
}

/** Whether a runner is idle between steps, parked on a blocking step, or finished. */
export type EventCommandStatus = "idle" | "blocked" | "done";

/** One list of commands being run, and how far into it the runner has reached. */
interface Frame {
	commands: readonly EventCommand[];
	cursor: number;
}

/**
 * Drives one page's commands in order against an {@link EventCommandHost}.
 * `advance()` runs until the page blocks or finishes and is idempotent while
 * blocked or done, so a scene can call it every frame without double-running.
 */
export class EventCommandRunner {
	/** The stack of command frames; the top frame is the one being drained. */
	private readonly frames: Frame[] = [];

	/** Current run state: idle (ready to advance), blocked (waiting), or done. */
	private state: EventCommandStatus = "idle";

	/** The choices offered by the parked `show-choices`, awaiting a resumed index. */
	private pendingChoices: EventCommand[][] | null = null;

	/**
	 * @param commands - The ordered commands to run.
	 * @param host - The side-effect surface the commands drive.
	 * @param flags - The flag context branch conditions are evaluated against.
	 */
	constructor(
		commands: readonly EventCommand[],
		private readonly host: EventCommandHost,
		private readonly flags: EventFlagContext,
	) {
		this.frames.push({ commands, cursor: 0 });
	}

	/** Whether the whole page has finished running. */
	get done(): boolean {
		return this.state === "done";
	}

	/** Whether the runner is parked on a blocking step awaiting `resume()`. */
	get blocked(): boolean {
		return this.state === "blocked";
	}

	/**
	 * Runs commands until one blocks or the page ends. Synchronous commands run
	 * back-to-back within one call; the first blocking command parks the runner.
	 * A no-op while already blocked or done, so it is safe to call once per frame.
	 */
	advance() {
		if (this.state !== "idle") return;
		while (this.frames.length > 0) {
			let frame = this.frames[this.frames.length - 1]!;
			if (frame.cursor >= frame.commands.length) {
				this.frames.pop();
				continue;
			}
			let command = frame.commands[frame.cursor]!;
			frame.cursor += 1;
			if (this.run(command)) return;
		}
		this.state = "done";
	}

	/**
	 * Resumes after a blocking step the host has finished, running the next steps.
	 *
	 * A no-op unless the runner is actually blocked, so a stray resume cannot skip
	 * a step or advance a finished page.
	 *
	 * @param choiceIndex - For a parked `show-choices`, selects the branch to run;
	 * ignored by other blocking commands.
	 */
	resume(choiceIndex?: number) {
		if (this.state !== "blocked") return;
		if (this.pendingChoices) {
			let branch = this.pendingChoices[choiceIndex ?? 0] ?? [];
			this.pendingChoices = null;
			this.frames.push({ commands: branch, cursor: 0 });
		}
		this.state = "idle";
		this.advance();
	}

	/**
	 * Runs one command; returns true when it blocks (parks the runner) and false
	 * when the run should keep going, including after pushing a nested frame for
	 * `conditional-branch`.
	 */
	private run(command: EventCommand): boolean {
		switch (command.kind) {
			case "text":
				this.state = "blocked";
				this.host.showText(command.text);
				return true;
			case "show-choices":
				this.state = "blocked";
				this.pendingChoices = command.choices.map((choice) => choice.commands);
				this.host.showChoices(
					command.prompt,
					command.choices.map((choice) => choice.label),
				);
				return true;
			case "conditional-branch": {
				let branch = this.conditionHolds(command.condition) ? command.then : (command.else ?? []);
				this.frames.push({ commands: branch, cursor: 0 });
				return false;
			}
			case "control-switch":
				this.host.controlSwitch(command.flag, command.value);
				return false;
			case "control-self-switch":
				this.host.controlSelfSwitch(this.flags.selfSwitchFlag(command.name), command.value);
				return false;
			case "give-item":
				this.host.giveItem(command.itemId, command.count);
				return false;
			case "heal-party":
				this.host.healParty();
				return false;
			case "face-player":
				this.host.facePlayer();
				return false;
			case "move":
				this.host.move([...command.steps]);
				return false;
			case "start-trainer-battle":
				this.state = "blocked";
				this.host.startTrainerBattle(command.trainer);
				return true;
			case "wild-encounter":
				this.state = "blocked";
				this.host.startWildBattle(command.speciesId, command.level);
				return true;
			case "wait":
				this.state = "blocked";
				this.host.wait(command.frames);
				return true;
			case "warp":
				this.state = "blocked";
				this.host.warp(command.map, command.x, command.y);
				return true;
		}
	}

	/**
	 * Evaluates a branch condition against the bound flag context: `switch` reads
	 * a global flag, `selfSwitch` reads the event's self-switch flag, both must
	 * hold together, and an empty condition always holds.
	 */
	private conditionHolds(condition: { switch?: string; selfSwitch?: string }): boolean {
		if (condition.switch && !this.flags.isFlagOn(condition.switch)) return false;
		if (
			condition.selfSwitch &&
			!this.flags.isFlagOn(this.flags.selfSwitchFlag(condition.selfSwitch))
		)
			return false;
		return true;
	}
}
