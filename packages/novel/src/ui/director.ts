/**
 * Sequences a play for the player: each frame applies its stage and awaits the transitions,
 * then starts the voice and the typewriter, then waits for a click, auto mode or skip, and
 * replies. It holds the state the player renders and leaves drawing to the component.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";

import type { NovelError } from "../errors.js";
import type { Ending, GameState, Reply, StopFrame } from "../frames.js";
import type { Novel, Play, StartOptions } from "../novel.js";

import type { BacklogEntry } from "./backlog.js";
import type { NovelSettings } from "./settings.js";
import type { RunningTransition } from "./transitions.js";

import { AudioMixer } from "./audio.js";
import { resolveSource } from "./source.js";
import {
	decodeImages,
	finishAnimations,
	prefersReducedMotion,
	sceneryTransition,
	settle,
	stageImages,
	transitionStage,
} from "./transitions.js";

/** Where a frame is in its sequence. */
export type Phase = "idle" | "staging" | "typing" | "waiting" | "replying";

/** Milliseconds skip mode shows each line for. */
const SKIP_STEP_MS = 40;

/** Milliseconds auto mode adds per character of an unvoiced line. */
const AUTO_PER_CHARACTER_MS = 25;

/** Lines the backlog keeps. */
const BACKLOG_SIZE = 200;

/** What the director needs from the component that draws it. */
export interface DirectorHost {
	novel(): Novel;
	/** Renders the current state and resolves once it is committed. */
	render(): Promise<void>;
	/** The stage element, whose animations a frame waits for. */
	stage(): Element | null;
	locale(): string;
	/** The text the textbox shows, for auto mode's length and self-voicing. */
	text(): string;
	settings(): NovelSettings;
	onEnding(ending: Ending): void;
}

/** Runs one play at a time and the reader's modes over it. */
export class Director {
	frame: StopFrame | undefined;
	error: NovelError | undefined;
	ending: Ending | undefined;
	phase: Phase = "idle";
	/** Shows the rest of the line at once. */
	complete = false;
	/** Ends this frame's transitions at once. */
	instant = false;
	auto = false;
	/** Skip switched on from the menu or its key, as opposed to held with Control. */
	skipToggled = false;
	skipHeld = false;
	backlog: BacklogEntry[] = [];
	/** True when an error stopped the play before its first stop, which {@link Director.retry} retries. */
	stalled = false;
	#host: DirectorHost;
	#play: Play | undefined;
	#sequence = 0;
	#running: RunningTransition | undefined;
	#timer: ReturnType<typeof setTimeout> | undefined;
	#mixer: AudioMixer | undefined;
	#voice: Promise<void> = Promise.resolve();
	#speech: Promise<void> = Promise.resolve();

	/**
	 * Creates a director drawing through `host`; nothing plays until {@link Director.begin}.
	 *
	 * @param host - The component's callbacks.
	 */
	constructor(host: DirectorHost) {
		this.#host = host;
	}

	/** The mixer, created on first use in the browser. */
	get mixer(): AudioMixer {
		this.#mixer ??= new AudioMixer(this.#host.settings().volume);
		return this.#mixer;
	}

	/** True while skip is toggled on or Control is held. */
	get skipping(): boolean {
		return this.skipToggled || this.skipHeld;
	}

	/** The play as JSON at the current stop, or `undefined` before it starts. */
	get state(): GameState | undefined {
		return this.#play?.state;
	}

	/**
	 * Saves the play through `play.save()`, which emits the novel's `save` event.
	 *
	 * @param slot - The slot name the event and the returned state carry.
	 * @returns The play as JSON, or `undefined` before the play starts.
	 */
	save(slot: string): GameState | undefined {
		return this.#play?.save(slot);
	}

	/**
	 * Resumes a saved play, carrying the current play's persistent data over so read lines and
	 * chosen options stay marked.
	 *
	 * @param state - The saved `GameState`.
	 */
	async load(state: GameState): Promise<void> {
		let persistent = this.#play?.persistent;
		await this.begin(persistent === undefined ? { from: state } : { from: state, persistent });
	}

	/**
	 * Starts a play: new, from a scene, or from a save. A refused save shows its error and keeps
	 * nothing of the previous play.
	 *
	 * @param options - Where the play starts.
	 */
	async begin(options: StartOptions = {}): Promise<void> {
		this.#cancel();
		this.#mixer?.stopVoice();
		let started = this.#host.novel().start(options);
		if (isFailure(started)) {
			this.error = started.error;
			await this.#host.render();
			return;
		}
		this.#play = started.data;
		this.backlog = [];
		this.ending = undefined;
		this.error = undefined;
		await this.#step(undefined);
	}

	/** Answers the current frame with `reply` built by one of its methods. */
	reply(reply: Reply): void {
		this.#cancel();
		void this.#step(reply);
	}

	/** Asks the play for its first stop again, after an error stopped it before one. */
	retry(): void {
		this.#cancel();
		void this.#step(undefined);
	}

	/**
	 * What a click, Space or Enter does: finishes a transition, then the typewriter, then
	 * advances a line or pause; a menu and an interaction wait for their own answer.
	 */
	advance(): void {
		void this.#mixer?.resume();
		let frame = this.frame;
		if (frame === undefined) return;
		if (this.phase === "staging") {
			this.#finishTransition();
			return;
		}
		if (this.phase === "typing") {
			this.complete = true;
			void this.#host.render();
			return;
		}
		if (this.phase !== "waiting") return;
		if (frame.type === "line" || frame.type === "pause") this.reply(frame.advance());
	}

	/** Called by the textbox once the line is fully visible. */
	revealed(): void {
		if (this.frame?.type !== "line" || this.phase !== "typing") return;
		this.phase = "waiting";
		void this.#host.render();
		this.#schedule();
	}

	/** Turns auto mode on or off. */
	toggleAuto(): void {
		this.auto = !this.auto;
		void this.#host.render();
		if (this.auto) this.#schedule();
		else this.#cancel();
	}

	/** Turns skip on or off. */
	toggleSkip(): void {
		this.skipToggled = !this.skipToggled;
		this.#skipChanged();
	}

	/**
	 * Skips while Control is held.
	 *
	 * @param held - Whether Control is down.
	 */
	holdSkip(held: boolean): void {
		if (this.skipHeld === held) return;
		this.skipHeld = held;
		this.#skipChanged();
	}

	/**
	 * Returns to the previous stop, which the wheel, the arrow key and the gamepad do. The
	 * restored frame shows at once, without transitions or replayed sounds.
	 */
	async rollback(): Promise<void> {
		let play = this.#play;
		if (play === undefined || this.phase === "replying" || this.phase === "staging") return;
		this.#cancel();
		this.#mixer?.stopVoice();
		let before = this.phase;
		this.phase = "replying";
		let previous = await play.rollback();
		if (play !== this.#play) return;
		if (previous === null) {
			this.phase = before;
			await this.#host.render();
			return;
		}
		let current = this.frame;
		let last = this.backlog.at(-1);
		if (current?.type === "line" && last?.scene === current.scene && last.key === current.key) {
			this.backlog = this.backlog.slice(0, -1);
		}
		this.error = undefined;
		this.ending = undefined;
		await this.#present(previous, true);
	}

	/**
	 * Plays a backlog line's voice again.
	 *
	 * @param entry - The line.
	 */
	replayVoice(entry: BacklogEntry): void {
		if (entry.voice === null) return;
		void this.mixer.resume();
		void this.mixer.playVoice(entry.voice);
	}

	/** Stops every timer, voice and sound when the player leaves the page. */
	dispose(): void {
		this.#cancel();
		this.#sequence++;
		this.#mixer?.dispose();
		if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
	}

	/** Sends a reply (none to start) and presents the frame it leads to. */
	async #step(reply: Reply | undefined): Promise<void> {
		let play = this.#play;
		if (play === undefined) return;
		this.phase = "replying";
		this.#mixer?.stopVoice();
		if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
		let result = await play.next(reply);
		if (play !== this.#play) return;
		if (result.done === true) {
			this.ending = result.value;
			this.phase = "idle";
			await this.#host.render();
			this.#host.onEnding(result.value);
			return;
		}
		let frame = result.value;
		this.stalled = false;
		if (frame.type === "error") {
			this.error = frame.error;
			if (frame.frame === null) {
				this.stalled = true;
				this.phase = "idle";
				await this.#host.render();
				return;
			}
			await this.#present(frame.frame, true);
			return;
		}
		this.error = undefined;
		await this.#present(frame, false);
	}

	/** Applies a frame's stage and audio, awaits the transitions, then starts the frame's wait. */
	async #present(frame: StopFrame, instant: boolean): Promise<void> {
		let sequence = ++this.#sequence;
		let locale = this.#host.locale();
		let fast = instant || this.skipping || prefersReducedMotion();
		this.phase = "staging";
		this.complete = instant || this.skipping;
		this.instant = fast;
		if (!fast) await decodeImages(stageImages(frame.stage, locale));
		if (sequence !== this.#sequence) return;
		this.mixer.reconcile(frame.audio, locale, this.skipping || instant);
		this.#running = transitionStage(
			async () => {
				this.frame = frame;
				this.#record(frame, locale);
				await this.#host.render();
			},
			sceneryTransition(frame.stage),
			fast,
		);
		await this.#running.finished;
		let stage = this.#host.stage();
		if (stage !== null) {
			if (fast) finishAnimations(stage);
			else await settle(stage);
		}
		this.#running = undefined;
		if (sequence !== this.#sequence) return;
		await this.#start(frame, locale);
	}

	/** Starts what a settled frame does: the voice and typewriter, a pause, or a wait for an answer. */
	async #start(frame: StopFrame, locale: string): Promise<void> {
		if (frame.type === "line") {
			this.phase = "typing";
			this.#voice =
				frame.voice === null || this.skipping
					? Promise.resolve()
					: this.mixer.playVoice(resolveSource(frame.voice, locale));
			await this.#host.render();
			this.#speak(this.#host.text(), locale);
			return;
		}
		this.phase = "waiting";
		if (frame.type !== "pause") this.skipToggled = false;
		await this.#host.render();
		if (frame.type === "pause") {
			let duration = this.skipping ? 0 : frame.duration;
			this.#timer = setTimeout(() => {
				if (this.frame === frame && this.phase === "waiting") this.reply(frame.advance());
			}, duration);
			return;
		}
		if (frame.type === "choice") this.#speak(this.#host.text(), locale);
	}

	/** Advances a shown line on its own when skip or auto mode says so. */
	#schedule(): void {
		let frame = this.frame;
		if (frame?.type !== "line" || this.phase !== "waiting") return;
		clearTimeout(this.#timer);
		if (this.skipping) {
			if (this.#host.settings().skip === "all" || frame.seen) {
				this.#timer = setTimeout(() => {
					if (this.frame === frame && this.phase === "waiting") this.reply(frame.advance());
				}, SKIP_STEP_MS);
				return;
			}
			this.skipToggled = false;
			void this.#host.render();
		}
		if (!this.auto) return;
		let sequence = this.#sequence;
		let voiced = frame.voice !== null;
		void Promise.all([this.#voice, this.#speech]).then(() => {
			if (sequence !== this.#sequence || !this.auto) return;
			let delay =
				this.#host.settings().autoDelay +
				(voiced ? 0 : this.#host.text().length * AUTO_PER_CHARACTER_MS);
			this.#timer = setTimeout(() => {
				if (this.frame === frame && this.phase === "waiting" && this.auto) {
					this.reply(frame.advance());
				}
			}, delay);
		});
	}

	/** Reacts to skip starting or stopping mid-frame. */
	#skipChanged(): void {
		void this.#host.render();
		if (!this.skipping) return;
		if (this.phase === "staging") this.#finishTransition();
		else if (this.phase === "typing") {
			this.complete = true;
			void this.#host.render();
		} else this.#schedule();
	}

	/** Jumps the running transition and every stage animation to their end. */
	#finishTransition(): void {
		this.#running?.finish();
		let stage = this.#host.stage();
		if (stage !== null) finishAnimations(stage);
	}

	/** Adds a shown line to the backlog, replacing the entry of the same line after a rollback. */
	#record(frame: StopFrame, locale: string): void {
		if (frame.type !== "line") return;
		let entry: BacklogEntry = {
			id: frame.id,
			scene: frame.scene,
			key: frame.key,
			values: frame.values,
			speakers: frame.speakers,
			voice: frame.voice === null ? null : resolveSource(frame.voice, locale),
		};
		let last = this.backlog.at(-1);
		let kept =
			last?.scene === frame.scene && last.key === frame.key
				? this.backlog.slice(0, -1)
				: this.backlog;
		this.backlog = [...kept, entry].slice(-BACKLOG_SIZE);
	}

	/** Reads text aloud when self-voicing is on, settling once it has been spoken. */
	#speak(text: string, locale: string): void {
		if (!this.#host.settings().selfVoicing || typeof speechSynthesis === "undefined") {
			this.#speech = Promise.resolve();
			return;
		}
		speechSynthesis.cancel();
		let utterance = new SpeechSynthesisUtterance(text);
		utterance.lang = locale;
		this.#speech = new Promise((resolve) => {
			utterance.addEventListener("end", () => resolve(), { once: true });
			utterance.addEventListener("error", () => resolve(), { once: true });
		});
		speechSynthesis.speak(utterance);
	}

	/** Stops the pending auto, skip or pause timer. */
	#cancel(): void {
		clearTimeout(this.#timer);
		this.#timer = undefined;
	}
}
