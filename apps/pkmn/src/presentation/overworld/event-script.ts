/**
 * A resumable interpreter for an event page's declarative command list.
 *
 * A page's `commands` (see `map-schema`) is a list of {@link EventCommand}s that run
 * in order, and the union is recursive: `show-choices` branches into the chosen
 * label's commands and `conditional-branch` into its `then`/`else`, so the runner
 * keeps an explicit stack of command frames rather than a single cursor. Some
 * commands block — `text` waits for the dialogue to be dismissed, `show-choices`
 * for a choice, the battle commands for the fight to end, `wait` for its frames, and
 * `warp` ends the run because the map reloads underneath it — so this is a
 * pull-driven state machine, not an async function: `advance()` runs synchronous
 * commands back-to-back and parks on the first blocking one, whose host hook it
 * calls; the host later calls `resume()` (with the picked choice, for a choice) to
 * continue. This suits the fixed-timestep loop and lets a test drive a whole page by
 * calling `advance`/`resume` and asserting the host calls happen in order.
 *
 * The runner adds no franchise meaning: it forwards authored command data to the
 * host and evaluates branch conditions through the injected flag context, which the
 * scene binds to the interacting event so a `selfSwitch` condition resolves to that
 * event's namespaced flag.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Direction, EventCommand, TrainerParty } from "../render/map-schema";

/**
 * The flag context a running page evaluates `conditional-branch` conditions against.
 *
 * `isFlagOn` reads a global switch (a story flag) by name; `selfSwitchFlag` maps one
 * of the interacting event's self-switch names to the namespaced flag it is stored
 * under, so a `selfSwitch` condition reads the right per-event flag.
 */
export interface EventFlagContext {
	/** Reads whether a global switch (story flag) is currently on. */
	isFlagOn(flag: string): boolean;
	/** The namespaced flag name one of this event's self-switches is stored under. */
	selfSwitchFlag(name: string): string;
}

/**
 * The side-effect surface a running page's commands drive.
 *
 * Synchronous hooks (controlSwitch, controlSelfSwitch, giveItem, healParty,
 * facePlayer, move) apply an effect and let the run continue on the same `advance`.
 * Blocking hooks (showText, showChoices, startTrainerBattle, startWildBattle, wait,
 * warp) begin an effect the runner parks on; the host calls `resume()` once it
 * finishes — `resume(index)` for a choice, passing the picked choice's index. `warp`
 * never resumes: the map reload replaces the runner, ending the run after it.
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
	/** Reloads the map at a new position; the run ends here (no resume). */
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
 *
 * Construct with the commands, the host, and the flag context bound to the
 * interacting event, then call `advance()` to run until the page blocks or finishes.
 * While blocked, the host drives its effect and calls `resume()` to continue;
 * `advance()` is idempotent while blocked or done, so the scene can call it every
 * frame without double-running a step. Nested commands (`show-choices`,
 * `conditional-branch`) push a new frame the runner drains before returning to the
 * step after the nesting command.
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
	 * Runs commands until one blocks or the page ends.
	 *
	 * Synchronous commands run back-to-back within one call; the first blocking
	 * command begins its host effect and parks the runner. Finished frames pop so the
	 * run resumes after the command that nested them. A no-op while already blocked or
	 * done, so it is safe to call once per frame.
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
			if (this.run(command)) return; // a blocking command parked the runner
		}
		this.state = "done";
	}

	/**
	 * Resumes after a blocking step the host has finished, running the next steps.
	 *
	 * A no-op unless the runner is actually blocked, so a stray resume cannot skip a
	 * step or advance a finished page. For a parked `show-choices`, `choiceIndex`
	 * selects the branch to run; its commands are pushed as a new frame before the run
	 * continues. Other blocking commands ignore the argument.
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
	 * Runs one command; returns true when it blocks (parks the runner).
	 *
	 * Synchronous commands return false so `advance` keeps going. Nesting commands
	 * (`conditional-branch`) push the chosen branch as a frame and return false so it
	 * runs next; `show-choices` blocks so the host can present the labels and resume
	 * with a pick. Blocking commands set the state to blocked and return true; `warp`
	 * blocks too but the host is expected never to resume it, ending the run as the
	 * map reloads.
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
	 * Evaluates a branch condition against the bound flag context.
	 *
	 * A `switch` condition reads a global flag; a `selfSwitch` condition reads the
	 * interacting event's namespaced self-switch flag. Both must hold when both are
	 * present; an empty condition (neither field) always holds.
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
