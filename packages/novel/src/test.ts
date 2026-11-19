/**
 * The `@sdxc/novel/test` entry: `createTestPlay()`, a play driven by the reply a test names, and
 * `check()` and `explore()`, which read and walk the whole story. A reply that does not fit the
 * current frame fails the test with the engine's own error.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { StandardSchemaV1 } from "@standard-schema/spec";

import { isFailure } from "@sdxc/result";

import type { SceneDeclaration } from "./declarations.js";
import type { NovelEventName, NovelEvents } from "./events.js";
import type { ExploreStep } from "./explore.js";
import type { Ending, Frame, GameState, InteractionFrame, StopFrame } from "./frames.js";
import type { Novel, Play, StartOptions } from "./novel.js";
import type { Persistent } from "./persistent.js";
import type { NovelState, SchemaInput } from "./types.js";

import { INTERNALS } from "./novel.js";

export type { CheckProblem, CheckReport } from "./check.js";
export type {
	ExploredDeadEnd,
	ExploredEnding,
	ExploredError,
	ExploredInteraction,
	ExploreOptions,
	ExplorePath,
	ExploreReport,
	ExploreStep,
	InteractionAnswers,
} from "./explore.js";

export { check } from "./check.js";
export { explore } from "./explore.js";

/** One thing the player saw or did, in the order it happened. */
export type TranscriptEntry =
	| { type: "line"; speakers: string[]; key: string; values: Record<string, unknown> | undefined }
	| { type: "choice"; option: string }
	| { type: "custom"; interaction: string; output: unknown };

/** An event the play emitted, as the test play logs it. */
export type TestEvent = {
	[Name in NovelEventName]: { type: Name; payload: NovelEvents[Name] };
}[NovelEventName];

/** The output a custom frame's `complete()` accepts, across every declared interaction. */
type CompleteOutput = StopFrame extends infer Each
	? Each extends InteractionFrame<string, StandardSchemaV1, infer Output>
		? SchemaInput<Output>
		: never
	: never;

/** A play a test drives by naming each reply. */
export interface TestPlay {
	/** The generator underneath, for a test that needs `rollback()` or raw frames. */
	readonly play: Play;
	/** The current frame, or `undefined` before the first stop and after the ending. */
	readonly frame: StopFrame | undefined;
	/** How the play finished, once it has. */
	readonly ending: Ending | undefined;
	/** The story state at the current stop. */
	readonly state: NovelState;
	/** The whole play as JSON, as a save would store it. */
	readonly game: GameState;
	/** The scene the play stands in. */
	readonly scene: SceneDeclaration;
	/** Every line shown, option taken and interaction completed so far. */
	readonly transcript: readonly TranscriptEntry[];
	/** Every event the play emitted, in order; the novel's own listeners receive them too. */
	readonly events: readonly TestEvent[];
	/** Persistent data as the play has updated it. */
	readonly persistent: Persistent;
	/** Emits `save` for `slot` and answers the saved state. */
	save(slot: string): GameState;
	/**
	 * Replays a path `explore()` reported: advances to each menu or interaction and answers it,
	 * then advances to the next menu or interaction, or to the end.
	 */
	follow(steps: readonly ExploreStep[]): Promise<StopFrame | undefined>;
	/** Starts the play, or answers the current line or pause; resolves to the next frame. */
	advance(): Promise<StopFrame | undefined>;
	/** Advances through lines and pauses until a frame of `type`, which it resolves to. */
	advanceUntil<Type extends StopFrame["type"]>(
		type: Type,
	): Promise<Extract<StopFrame, { type: Type }>>;
	/** Takes an option on the current menu. */
	choose(option: string): Promise<StopFrame | undefined>;
	/** Completes the current interaction with its output. */
	complete(output: CompleteOutput): Promise<StopFrame | undefined>;
}

/**
 * Starts a play for a test: from the novel's initial scene, or from `scene` with `state` and a
 * fixed `seed` so every draw replays.
 *
 * @param novel - The novel, with its scenes mapped.
 * @param options - Where the play starts; see `StartOptions`.
 * @returns The play, started lazily on the first call.
 * @throws When the novel refuses to start, so the test fails at once.
 * @example let play = createTestPlay(novel, { seed: "mika", scene: scenes.spring.cafe.meeting });
 */
export function createTestPlay(novel: Novel, options: StartOptions = {}): TestPlay {
	let events: TestEvent[] = [];
	let started = novel[INTERNALS]().start(options, {
		emit(name, payload) {
			events.push({ type: name, payload } as TestEvent);
		},
	});
	if (isFailure(started)) throw started.error;
	let play = started.data;
	let frame: StopFrame | undefined;
	let ending: Ending | undefined;
	let begun = false;
	let transcript: TranscriptEntry[] = [];

	/** Sends a reply (none to start) and records the frame or ending it leads to. */
	async function send(reply: Parameters<Play["next"]>[0]): Promise<StopFrame | undefined> {
		begun = true;
		let step = await play.next(reply);
		if (step.done) {
			ending = step.value;
			frame = undefined;
			return undefined;
		}
		let next: Frame = step.value;
		if (next.type === "error") throw next.error;
		frame = next;
		if (next.type === "line") {
			transcript.push({
				type: "line",
				speakers: next.speakers.map((speaker) => speaker.id),
				key: next.key,
				values: next.values,
			});
		}
		return frame;
	}

	/** The current frame when it has the expected type, failing the test otherwise. */
	function expectFrame<Type extends StopFrame["type"]>(
		type: Type,
	): Extract<StopFrame, { type: Type }> {
		if (frame?.type !== type) {
			throw new Error(`Expected a ${type} frame, but the play is at ${frame?.type ?? "no frame"}.`);
		}
		return frame as Extract<StopFrame, { type: Type }>;
	}

	/** Advances through lines and pauses until a menu, an interaction or the end. */
	async function settle(): Promise<StopFrame | undefined> {
		if (!begun) await send(undefined);
		while (frame?.type === "line" || frame?.type === "pause") await send(frame.advance());
		return frame;
	}

	let testPlay: TestPlay = {
		play,
		get frame() {
			return frame;
		},
		get ending() {
			return ending;
		},
		get state() {
			return play.state.state;
		},
		get game() {
			return play.state;
		},
		get scene() {
			let name = play.state.position.scene;
			return novel.mapped.find((entry) => entry.name === name) as SceneDeclaration;
		},
		get transcript() {
			return transcript;
		},
		get events() {
			return events;
		},
		get persistent() {
			return play.persistent;
		},
		save(slot) {
			return play.save(slot);
		},
		async follow(steps) {
			for (let step of steps) {
				await settle();
				if (step.type === "choice") await testPlay.choose(step.option);
				else await testPlay.complete(step.output as CompleteOutput);
			}
			return settle();
		},
		async advance() {
			if (!begun) return send(undefined);
			let current = frame;
			if (current?.type !== "line" && current?.type !== "pause") {
				throw new Error(
					`Expected a line or pause frame, but the play is at ${current?.type ?? "no frame"}.`,
				);
			}
			return send(current.advance());
		},
		async advanceUntil(type) {
			if (!begun) await send(undefined);
			while (frame?.type !== type) {
				if (frame === undefined) throw new Error(`The play ended before a ${type} frame.`);
				await testPlay.advance();
			}
			return frame as Extract<StopFrame, { type: typeof type }>;
		},
		async choose(option) {
			let menu = expectFrame("choice");
			transcript.push({ type: "choice", option });
			return send(menu.choose(option));
		},
		async complete(output) {
			let current = expectFrame("custom");
			transcript.push({ type: "custom", interaction: current.interaction, output });
			return send(current.complete(output as never));
		},
	};
	return testPlay;
}
