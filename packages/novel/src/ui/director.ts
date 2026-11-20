/**
 * Sequences a play for the player: each frame applies its stage and awaits the transitions,
 * then starts the voice and the reveal, then waits for a click, auto mode or skip, and replies.
 * The reader's modes live in the behavior models it coordinates; drawing is the parts'.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";

import type { SceneDeclaration } from "../declarations.js";
import type { NovelError } from "../errors.js";
import type { Ending, GameState, ReplayScope, Reply, StopFrame } from "../frames.js";
import type { Novel, Play, StartOptions } from "../novel.js";
import type { Persistent } from "../persistent.js";

import type { AutoBehavior } from "./behaviors/auto.js";
import type { BacklogBehavior, BacklogEntry } from "./behaviors/backlog.js";
import type { RevealBehavior } from "./behaviors/reveal.js";
import type { SkipBehavior } from "./behaviors/skip.js";
import type { NovelSettings } from "./settings.js";
import type { RunningTransition } from "./transitions.js";

import { AudioMixer } from "./audio.js";
import { SKIP_STEP_MS } from "./behaviors/skip.js";
import { Prefetcher } from "./prefetch.js";
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
	/** Called as soon as `frame`, `phase` or `ending` takes a new value, before the next render. */
	changed(what: "frame" | "phase" | "ending"): void;
	/** How many jumps ahead to prefetch on entering a scene, or `false` to prefetch nothing. */
	prefetch(): number | false;
}

/** The behaviors a director sequences a play through, each usable on its own. */
export interface DirectorBehaviors {
	reveal: RevealBehavior;
	auto: AutoBehavior;
	skip: SkipBehavior;
	backlog: BacklogBehavior;
}

/**
 * Runs one play at a time over the reader's behaviors: it moves each frame through its phases
 * and lets the reveal, auto, skip and backlog models hold the rest, reacting to their changes.
 */
export class Director {
	error: NovelError | undefined;
	/** Ends this frame's transitions at once. */
	instant = false;
	/** True when an error stopped the play before its first stop, which {@link Director.retry} retries. */
	stalled = false;
	/** True while the play is a replay, which never saves. */
	replaying = false;
	readonly reveal: RevealBehavior;
	readonly auto: AutoBehavior;
	readonly skip: SkipBehavior;
	readonly backlog: BacklogBehavior;
	#frame: StopFrame | undefined;
	#phase: Phase = "idle";
	#ending: Ending | undefined;
	/** The play a replay interrupted, resumed with its backlog when the replay ends. */
	#resume: { state: GameState; backlog: readonly BacklogEntry[] } | undefined;
	#host: DirectorHost;
	#play: Play | undefined;
	#sequence = 0;
	#running: RunningTransition | undefined;
	#timer: ReturnType<typeof setTimeout> | undefined;
	#mixer: AudioMixer | undefined;
	#voice: Promise<void> = Promise.resolve();
	#speech: Promise<void> = Promise.resolve();
	#prefetcher: Prefetcher;
	/** The scene prefetched for last, so a scene's reach is read once per entry. */
	#prefetched: string | undefined;
	#listening = new AbortController();

	/**
	 * Creates a director drawing through `host`; nothing plays until {@link Director.begin}.
	 *
	 * @param host - The component's callbacks.
	 * @param behaviors - The models it drives; each one's own changes reach the play.
	 */
	constructor(host: DirectorHost, behaviors: DirectorBehaviors) {
		this.#host = host;
		this.reveal = behaviors.reveal;
		this.auto = behaviors.auto;
		this.skip = behaviors.skip;
		this.backlog = behaviors.backlog;
		this.#prefetcher = new Prefetcher({ novel: () => host.novel(), mixer: () => this.mixer });
		let signal = this.#listening.signal;
		this.reveal.addEventListener("change", () => this.#revealChanged(), { signal });
		this.auto.addEventListener("change", () => this.#autoChanged(), { signal });
		this.skip.addEventListener("change", () => this.#skipChanged(), { signal });
	}

	/** The stop the play shows, or `undefined` before its first one. */
	get frame(): StopFrame | undefined {
		return this.#frame;
	}

	set frame(frame: StopFrame | undefined) {
		if (frame === this.#frame) return;
		this.#frame = frame;
		this.#host.changed("frame");
	}

	get phase(): Phase {
		return this.#phase;
	}

	set phase(phase: Phase) {
		if (phase === this.#phase) return;
		this.#phase = phase;
		this.#host.changed("phase");
	}

	/** How the play finished, once it has; a new play clears it. */
	get ending(): Ending | undefined {
		return this.#ending;
	}

	set ending(ending: Ending | undefined) {
		if (ending === this.#ending) return;
		this.#ending = ending;
		this.#host.changed("ending");
	}

	/** The prefetcher warming the scenes within reach, for a test to read what it started. */
	get prefetcher(): Prefetcher {
		return this.#prefetcher;
	}

	/** The mixer, created on first use in the browser. */
	get mixer(): AudioMixer {
		this.#mixer ??= new AudioMixer(this.#host.settings().volume);
		return this.#mixer;
	}

	/** True while skip is toggled on or held. */
	get skipping(): boolean {
		return this.skip.active;
	}

	/** The running play, which a novel listener compares against to hear only this player's play. */
	get play(): Play | undefined {
		return this.#play;
	}

	/** The play as JSON at the current stop, or `undefined` before it starts. */
	get state(): GameState | undefined {
		return this.#play?.state;
	}

	/** Persistent data as the current play has updated it, or `undefined` before a play starts. */
	get persistent(): Persistent | undefined {
		return this.#play?.persistent;
	}

	/**
	 * Saves the play through `play.save()`, which emits the novel's `save` event.
	 *
	 * @param slot - The slot name the event and the returned state carry.
	 * @returns The play as JSON, or `undefined` before the play starts and during a replay.
	 */
	save(slot: string): GameState | undefined {
		if (this.replaying) return undefined;
		return this.#play?.save(slot);
	}

	/**
	 * Replays a scene, or plays its chapter, as a replay that records only the lines it shows.
	 * The play it interrupts is kept and resumes at the same stop when the replay ends.
	 *
	 * @param scene - The scene to start in.
	 * @param scope - Ends the replay on leaving the scene, or its chapter.
	 */
	async replay(scene: SceneDeclaration, scope: ReplayScope): Promise<void> {
		let play = this.#play;
		if (
			play !== undefined &&
			!this.replaying &&
			this.ending === undefined &&
			this.frame !== undefined
		) {
			this.#resume = { state: play.state, backlog: this.backlog.entries };
		}
		let persistent = play?.persistent;
		await this.begin(
			persistent === undefined ? { scene, replay: scope } : { scene, replay: scope, persistent },
		);
	}

	/**
	 * Ends a replay: resumes the play it interrupted with the lines the replay recorded, or,
	 * when it interrupted none, finishes like the end of a play.
	 */
	async endReplay(): Promise<void> {
		if (!this.replaying) return;
		let resume = this.#resume;
		if (resume === undefined) {
			this.#cancel();
			this.#mixer?.stopVoice();
			this.replaying = false;
			this.ending = { key: null, scene: this.frame?.scene ?? "" };
			this.phase = "idle";
			this.reveal.clear();
			await this.#host.render();
			this.#host.onEnding(this.ending);
			return;
		}
		let persistent = this.#play?.persistent;
		await this.begin(
			persistent === undefined ? { from: resume.state } : { from: resume.state, persistent },
			resume.backlog,
		);
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
	 * nothing of the previous play. A play started without `replay` forgets any interrupted play.
	 *
	 * @param options - Where the play starts.
	 * @param backlog - The lines the backlog starts with.
	 */
	async begin(options: StartOptions = {}, backlog: readonly BacklogEntry[] = []): Promise<void> {
		if (options.replay === undefined) this.#resume = undefined;
		this.#cancel();
		this.#mixer?.stopVoice();
		let started = this.#host.novel().start(options);
		if (isFailure(started)) {
			this.error = started.error;
			await this.#host.render();
			return;
		}
		this.#play = started.data;
		this.replaying = options.replay !== undefined;
		this.backlog.replace(backlog);
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
			this.reveal.finish();
			void this.#host.render();
			return;
		}
		if (this.phase !== "waiting") return;
		if (frame.type === "line" || frame.type === "pause") this.reply(frame.advance());
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
		if (this.frame?.type === "line") this.backlog.leave(this.frame);
		this.error = undefined;
		this.ending = undefined;
		await this.#present(previous, true);
	}

	/** Stops every timer, voice and sound when the player leaves the page. */
	dispose(): void {
		this.#cancel();
		this.#sequence++;
		this.#listening.abort();
		this.#mixer?.dispose();
		this.#prefetcher.dispose();
		if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
	}

	/** Moves a typing line to waiting once the reveal reports the whole line visible. */
	#revealChanged(): void {
		if (this.reveal.status !== "revealed") return;
		if (this.frame?.type !== "line" || this.phase !== "typing") return;
		if (this.reveal.line !== this.frame.id) return;
		this.phase = "waiting";
		void this.#host.render();
		this.#schedule();
	}

	/** Starts or drops the pending auto wait as auto mode turns on or off. */
	#autoChanged(): void {
		void this.#host.render();
		if (this.auto.enabled) this.#schedule();
		else this.#cancel();
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
			if (this.replaying && this.#resume !== undefined) {
				await this.endReplay();
				return;
			}
			this.replaying = false;
			this.ending = result.value;
			this.phase = "idle";
			this.reveal.clear();
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
		this.instant = fast;
		if (!fast) await decodeImages(stageImages(frame.stage, locale));
		if (sequence !== this.#sequence) return;
		this.mixer.reconcile(frame.audio, locale, this.skipping || instant);
		this.#running = transitionStage(
			async () => {
				this.frame = frame;
				if (frame.type === "line") {
					this.reveal.begin(frame.id, instant || this.skipping);
					this.backlog.record(frame, locale);
				} else this.reveal.clear();
				await this.#host.render();
			},
			sceneryTransition(frame.stage),
			fast,
		);
		this.#prefetch(frame.scene, locale);
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
			this.reveal.speed = this.#host.settings().textSpeed;
			this.reveal.start();
			this.#voice =
				frame.voice === null || this.skipping
					? Promise.resolve()
					: this.mixer.playVoice(resolveSource(frame.voice, locale));
			await this.#host.render();
			this.#speak(this.#host.text(), locale);
			return;
		}
		this.phase = "waiting";
		if (frame.type !== "pause") this.skip.stop();
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

	/**
	 * Prefetches the scenes within reach of a scene the play just entered. Skip mode and a play
	 * that never leaves the scene prefetch nothing, so racing through scenes queues no work.
	 */
	#prefetch(scene: string, locale: string): void {
		let depth = this.#host.prefetch();
		if (depth === false || this.skipping || scene === this.#prefetched) return;
		this.#prefetched = scene;
		void this.#prefetcher.enter(scene, { depth, locale });
	}

	/** Advances a shown line on its own when skip or auto mode says so. */
	#schedule(): void {
		let frame = this.frame;
		if (frame?.type !== "line" || this.phase !== "waiting") return;
		clearTimeout(this.#timer);
		if (this.skip.active) {
			if (this.skip.passes(frame, this.#host.settings().skip)) {
				this.#timer = setTimeout(() => {
					if (this.frame === frame && this.phase === "waiting") this.reply(frame.advance());
				}, SKIP_STEP_MS);
				return;
			}
			this.skip.stop();
		}
		this.auto.wait(
			{
				length: this.#host.text().length,
				voiced: frame.voice !== null,
				delay: this.#host.settings().autoDelay,
				after: [this.#voice, this.#speech],
			},
			() => {
				if (this.frame === frame && this.phase === "waiting") this.reply(frame.advance());
			},
		);
	}

	/** Reacts to skip starting or stopping mid-frame. */
	#skipChanged(): void {
		void this.#host.render();
		if (!this.skip.active) return;
		if (this.phase === "staging") this.#finishTransition();
		else if (this.phase === "typing") this.reveal.finish();
		else this.#schedule();
	}

	/** Jumps the running transition and every stage animation to their end. */
	#finishTransition(): void {
		this.#running?.finish();
		let stage = this.#host.stage();
		if (stage !== null) finishAnimations(stage);
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
		this.auto.cancel();
	}
}
