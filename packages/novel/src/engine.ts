/**
 * The engine behind a play: it runs a scene's directives to the next stop, turns that stop into
 * a frame, applies the replies frames build, and keeps the stops it passed for rollback. Every
 * transition works on a copy, so a refused reply or a failed jump leaves the play where it was.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { StandardSchemaV1 } from "@standard-schema/spec";

import { restoreRandom } from "@sdxc/random";
import { failure, isFailure, success } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v4";

import type { Path, SceneIndex } from "./anchors.js";
import type {
	AssetDeclaration,
	AssetSource,
	ChapterInfo,
	CharacterDeclaration,
	InteractionDeclaration,
	SceneDeclaration,
} from "./declarations.js";
import type { ChooseDirective, Directive, PickDirective, StoredCallback } from "./directives.js";
import type { ChoiceEvent, Emit, LineEvent, NotifyEvent } from "./events.js";
import type {
	Ending,
	Frame,
	FrameOption,
	GameState,
	ReplayScope,
	Reply,
	StopFrame,
	StoryPosition,
} from "./frames.js";
import type { Persistent } from "./persistent.js";
import type {
	Audio,
	CharacterTransition,
	Fraction,
	FrameStage,
	Position,
	Stage,
	StageCharacter,
	StageScenery,
} from "./stage.js";
import type { NovelPersistent, NovelState, PlayTools, StateRecord } from "./types.js";

import { directiveAt, enterOption, menuAnchor, nextPath, optionOf } from "./anchors.js";
import { NovelError } from "./errors.js";
import { copyKeepingFiles } from "./files.js";
import { REPLY } from "./frames.js";
import { recordKey } from "./persistent.js";
import { getPath, setPath, validate } from "./state.js";

/** The tools a callback receives, as the engine builds them over its own persistent record. */
type Tools = PlayTools<Persistent>;

/** Directives a play may run between two stops before it is reported as an endless loop. */
const MAX_STEPS = 10_000;

/** Refusals that are story problems rather than a caller's mistake, which `error` reports. */
const STORY_ERRORS = new Set(["unmapped-scene", "load-failed", "endless-loop"]);

/** Matches an anchor counted from the key before it, `<key>+<n>`. */
const COUNTED_ANCHOR = /^(.*)\+\d+$/;

/** What the engine reads from its novel: declarations by name and loaded scenes. */
export interface NovelRuntime {
	/** Loads a mapped scene once, indexing its anchors. */
	load(scene: string): Promise<Result<SceneIndex, NovelError>>;
	/** A scene already loaded, for reading anchors without waiting. */
	loaded(scene: string): SceneIndex | undefined;
	scene(name: string): SceneDeclaration | undefined;
	position(position: Position): Fraction;
	voice(speaker: string, key: string): AssetSource | null;
	/** Reports whether the novel lacks an asset or a character a scene uses. */
	missing(declaration: AssetDeclaration | CharacterDeclaration): boolean;
	/** The schema of an extension's lasting slice, or `undefined` when it keeps none. */
	lasting(extension: string): StandardSchemaV1 | undefined;
	/** The locales whose catalog lacks a message key. */
	untranslated(key: string): string[];
	/** Sends an event to the novel's listeners, bound to this play. */
	emit: Emit;
	/**
	 * Settles a pick with more than one candidate: answers the scene to take among `candidates`,
	 * given the one the play drew. Tools use it to follow every candidate; a play without it
	 * takes the drawn one.
	 */
	pick?(candidates: readonly string[], drawn: string): string;
	/** How many earlier stops `rollback()` can return to. */
	readonly rollback: number;
	/** The novel's version, which `GameState` carries. */
	readonly version: number;
}

/** Where a play continues: a scene, and a path in it or an anchor to resolve once it loads. */
export interface Cursor {
	scene: string;
	path: Path | null;
	/** The anchor to resolve when `path` is `null`; `null` starts the scene from its top. */
	anchor: string | null;
	/** Continues with the directive after the anchored one, as a return from a call does. */
	after: boolean;
}

/** Everything a play changes, as plain data a stop's snapshot copies. */
export interface Live {
	cursor: Cursor;
	stack: Cursor[];
	stage: Stage;
	audio: Audio;
	state: StateRecord;
	random: GameState["random"];
	taken: string[];
}

/** A stop the play reached: the play as it stood before the stop was evaluated, and its frame. */
interface Stop {
	snapshot: Live;
	frame: StopFrame;
}

/** What one transition answered: a frame to yield, or the end of the play. */
export type Outcome = { kind: "frame"; frame: Frame } | { kind: "end"; ending: Ending };

/**
 * Something a run did that outlives it: recorded while the run works on its copy, and applied to
 * persistent data and emitted only once the run reaches its stop, so a refused run leaves none.
 */
type Effect =
	| { type: "scene"; scene: string }
	| { type: "chapter"; chapter: ChapterInfo; scene: string }
	| { type: "unlock"; kind: "image" | "music"; id: string }
	| { type: "line"; line: LineEvent }
	| { type: "notify"; notify: NotifyEvent }
	| { type: "remember"; extension: string; value: unknown }
	| { type: "choice"; choice: ChoiceEvent }
	| { type: "ending"; ending: Ending }
	| { type: "error"; error: NovelError };

/** What running directives reached: a stop, or the end of the play. */
type Reached =
	| { kind: "stop"; stop: Stop; work: Live }
	| { kind: "end"; ending: Ending; work: Live };

/**
 * One playthrough's engine. It owns the current stop and the history `rollback()` walks; the
 * play's generator and its `state` getter read it.
 */
export class PlayEngine {
	#runtime: NovelRuntime;
	#live: Live;
	#history: Stop[] = [];
	#current: Stop | null = null;
	#ended = false;
	#id = generateUUID();
	#frames = 0;
	#sounds = 0;
	#persistent: Persistent;
	/** The effects of the run in progress, applied when it reaches a stop. */
	#pending: Effect[] = [];
	/** The scene the last settled run ended in, which a chapter change is measured from. */
	#scene: string | null = null;
	/** Errors already reported, so a problem met on every pass is reported once per play. */
	#reported = new Set<string>();
	#playTime: number;
	#startedAt = Date.now();
	/** The bound of a replay, with the scene and chapter it started in; `null` for a normal play. */
	#replay: { scope: ReplayScope; scene: string; chapter: string | undefined } | null;

	/**
	 * @param runtime - The novel's declarations and scenes.
	 * @param live - Where the play starts.
	 * @param playTime - Milliseconds already played, carried over from a save.
	 * @param persistent - What earlier playthroughs left; the engine updates it in place.
	 * @param replay - Plays as a replay bounded by this scope, recording only the lines it shows.
	 */
	constructor(
		runtime: NovelRuntime,
		live: Live,
		playTime: number,
		persistent: Persistent,
		replay?: ReplayScope,
	) {
		this.#runtime = runtime;
		this.#live = live;
		this.#playTime = playTime;
		this.#persistent = persistent;
		let scene = live.cursor.scene;
		this.#replay =
			replay === undefined
				? null
				: { scope: replay, scene, chapter: runtime.scene(scene)?.chapter?.name };
	}

	/** Persistent data as this play has updated it. */
	get persistent(): Persistent {
		return structuredClone(this.#persistent);
	}

	/**
	 * Emits `save` with the play as it stands, for the app to store under `slot`.
	 *
	 * @param slot - The save slot's name.
	 * @returns The saved state.
	 */
	save(slot: string): GameState {
		let state = this.state;
		this.#runtime.emit("save", { slot, state: structuredClone(state) });
		return state;
	}

	/**
	 * The stage as the play last left it: the current stop's, or once the play has ended, the
	 * one its last directives built, with the characters that left on the way in `exits`.
	 */
	get stage(): FrameStage {
		let shown = this.#current?.frame.stage;
		return shown === undefined ? frameStage(this.#live.stage, new Set()) : copyKeepingFiles(shown);
	}

	/** The play as JSON, at the current stop as it stood before the stop was shown. */
	get state(): GameState {
		let live = this.#current?.snapshot ?? this.#live;
		let scene = this.#runtime.scene(live.cursor.scene);
		let { exits: _exits, ...stage } = live.stage;
		return structuredClone({
			version: this.#runtime.version,
			position: this.#anchor(live.cursor),
			stack: live.stack.map((entry) => this.#anchor(entry)),
			stage,
			audio: live.audio,
			state: live.state as NovelState,
			random: live.random,
			taken: live.taken,
			meta: {
				scene: scene?.title ?? live.cursor.scene,
				savedAt: new Date().toISOString(),
				playTime: this.#playTime + (Date.now() - this.#startedAt),
			},
		});
	}

	/**
	 * Runs to the first stop, or answers a reply to the current one.
	 *
	 * @param reply - What the UI answered; ignored before the first stop.
	 * @returns The next frame, an error frame for a refused reply, or the ending.
	 */
	async step(reply: Reply | undefined): Promise<Outcome> {
		if (this.#current === null) return this.#reach(copyKeepingFiles(this.#live), []);
		let work = this.#answer(this.#current, reply);
		if (isFailure(work)) return this.#refuse(work.error);
		let body = reply?.[REPLY];
		let effects: Effect[] =
			body?.kind === "choose"
				? [{ type: "choice", choice: { scene: this.#current.frame.scene, option: body.option } }]
				: [];
		return this.#reach(work.data, effects);
	}

	/**
	 * Returns to the stop before the current one, with its state, stage and draws.
	 *
	 * @returns That stop's frame, or `null` when there is no earlier stop to return to.
	 */
	async rollback(): Promise<StopFrame | null> {
		if (this.#ended || this.#history.length < 2) return null;
		this.#history.pop();
		let previous = this.#history.pop() as Stop;
		let outcome = await this.#reach(copyKeepingFiles(previous.snapshot), []);
		return outcome.kind === "frame" && outcome.frame.type !== "error" ? outcome.frame : null;
	}

	/**
	 * Runs `work` to its next stop and makes that stop current, or reports why it could not.
	 * The run's effects, after `effects`, are applied and emitted once the stop is current.
	 */
	async #reach(work: Live, effects: Effect[]): Promise<Outcome> {
		this.#pending = effects;
		let reached = await this.#run(work);
		if (isFailure(reached)) {
			this.#pending = [];
			if (STORY_ERRORS.has(reached.error.code)) this.#runtime.emit("error", reached.error);
			return this.#refuse(reached.error);
		}
		this.#scene = reached.data.work.cursor.scene;
		if (reached.data.kind === "end") {
			this.#ended = true;
			this.#live = reached.data.work;
			this.#current = null;
			this.#pending.push({ type: "ending", ending: reached.data.ending });
			this.#settle();
			return { kind: "end", ending: reached.data.ending };
		}
		let { stop, work: after } = reached.data;
		this.#live = after;
		this.#current = stop;
		this.#history.push(stop);
		if (this.#history.length > this.#runtime.rollback + 1) this.#history.shift();
		this.#settle();
		return { kind: "frame", frame: stop.frame };
	}

	/** An error frame carrying the current stop to retry. */
	#refuse(error: NovelError): Outcome {
		return { kind: "frame", frame: { type: "error", error, frame: this.#current?.frame ?? null } };
	}

	/**
	 * Applies the settled run's effects to persistent data and emits them in the order they
	 * happened, then emits `persist` once when anything was recorded for the first time.
	 */
	#settle(): void {
		let effects = this.#pending;
		this.#pending = [];
		let changed = false;
		for (let effect of effects) {
			if (effect.type === "error") this.#report(effect.error);
			else changed = this.#record(effect) || changed;
		}
		if (changed)
			this.#runtime.emit("persist", structuredClone(this.#persistent) as NovelPersistent);
	}

	/** Records one effect in persistent data and emits its event; answers whether data changed. */
	#record(effect: Exclude<Effect, { type: "error" }>): boolean {
		let persistent = this.#persistent;
		if (this.#replay !== null && effect.type !== "scene" && effect.type !== "line") return false;
		switch (effect.type) {
			case "scene":
				this.#runtime.emit("scene", { scene: effect.scene });
				return false;
			case "chapter": {
				let added = addOnce(persistent.chapters, effect.chapter.name);
				this.#runtime.emit("chapter", { chapter: effect.chapter, scene: effect.scene });
				return added;
			}
			case "unlock": {
				let list = effect.kind === "image" ? persistent.unlocked.images : persistent.unlocked.music;
				let added = addOnce(list, effect.id);
				if (added) this.#runtime.emit("unlock", { kind: effect.kind, id: effect.id });
				return added;
			}
			case "line": {
				let id = recordKey(effect.line.scene, effect.line.key);
				let values = structuredClone(effect.line.values ?? {}) as Persistent["seen"][string];
				let before = persistent.seen[id];
				persistent.seen[id] = values;
				this.#runtime.emit("line", effect.line);
				return before === undefined || JSON.stringify(before) !== JSON.stringify(values);
			}
			case "notify":
				this.#runtime.emit("notify", effect.notify);
				return false;
			case "remember": {
				let slices = persistent as unknown as Record<string, unknown>;
				let before = JSON.stringify(slices[effect.extension]);
				slices[effect.extension] = structuredClone(effect.value);
				return before !== JSON.stringify(effect.value);
			}
			case "choice": {
				let added = addOnce(
					persistent.chosen,
					recordKey(effect.choice.scene, effect.choice.option),
				);
				this.#runtime.emit("choice", effect.choice);
				return added;
			}
			case "ending": {
				let added = effect.ending.key !== null && addOnce(persistent.endings, effect.ending.key);
				this.#runtime.emit("ending", { ...effect.ending });
				return added;
			}
		}
	}

	/** Emits a story problem once per play, however often the play passes it. */
	#report(error: NovelError): void {
		let id = `${error.code}:${error.subject ?? ""}:${error.locale ?? ""}`;
		if (this.#reported.has(id)) return;
		this.#reported.add(id);
		this.#runtime.emit("error", error);
	}

	/** Queues a story problem the play continues past. */
	#problem(error: NovelError): void {
		this.#pending.push({ type: "error", error });
	}

	/** Queues a `missing-asset` problem when the novel does not declare what a directive uses. */
	#declared(declaration: AssetDeclaration | CharacterDeclaration): void {
		if (!this.#runtime.missing(declaration)) return;
		let subject = "kind" in declaration ? declaration.id : `cast.${declaration.id}`;
		this.#problem(
			new NovelError("missing-asset", `"${subject}" is not declared by the novel.`, { subject }),
		);
	}

	/** Queues a `missing-message` problem for every locale whose catalog lacks a key. */
	#translated(keys: Iterable<string | undefined>): void {
		for (let key of keys) {
			if (key === undefined) continue;
			for (let locale of this.#runtime.untranslated(key)) {
				this.#problem(
					new NovelError("missing-message", `The "${locale}" catalog has no "${key}" message.`, {
						subject: key,
						locale,
					}),
				);
			}
		}
	}

	/** Applies a reply to a copy of the play, after checking it answers the current stop. */
	#answer(current: Stop, reply: Reply | undefined): Result<Live, NovelError> {
		let body = typeof reply === "object" && reply !== null ? reply[REPLY] : undefined;
		if (body === undefined) {
			return failure(new NovelError("invalid-reply", "Answer a frame with one of its methods."));
		}
		if (body.frame !== current.frame.id) {
			return failure(new NovelError("stale-reply", `Frame ${body.frame} is no longer current.`));
		}
		let work = copyKeepingFiles(this.#live);
		let path = work.cursor.path as Path;
		let frame = current.frame;
		if (body.kind === "advance") {
			work.cursor.path = nextPath(path);
			return success(work);
		}
		if (body.kind === "choose" && frame.type === "choice") {
			let option = frame.options.find((entry) => entry.id === body.option);
			if (option === undefined || option.disabled) {
				return failure(
					new NovelError("unavailable-option", `Option "${body.option}" is not available.`),
				);
			}
			let id = `${work.cursor.scene}:${option.id}`;
			work.taken = [...work.taken.filter((entry) => entry !== id), id];
			work.cursor.path = enterOption(path, option.id);
			return success(work);
		}
		if (body.kind === "complete" && frame.type === "custom") {
			return this.#complete(work, body.output);
		}
		return failure(
			new NovelError("invalid-reply", `A ${frame.type} frame takes no ${body.kind} reply.`),
		);
	}

	/** Validates an interaction's output and stores it where the scene asked. */
	#complete(work: Live, output: unknown): Result<Live, NovelError> {
		let path = work.cursor.path as Path;
		let index = this.#runtime.loaded(work.cursor.scene) as SceneIndex;
		let directive = directiveAt(index.module.directives, path);
		if (directive?.type !== "custom") {
			return failure(new NovelError("invalid-reply", "The current stop is not an interaction."));
		}
		let parsed = validate(directive.interaction.output, output);
		if (isFailure(parsed)) {
			return failure(
				new NovelError(
					"invalid-output",
					`The "${directive.interaction.name}" interaction answered output its schema refused: ${parsed.error.message}`,
				),
			);
		}
		if (directive.into !== undefined) setPath(work.state, directive.into, parsed.data);
		work.cursor.path = nextPath(path);
		return success(work);
	}

	/** Runs directives from the cursor until one stops for the player or the play ends. */
	async #run(work: Live): Promise<Result<Reached, NovelError>> {
		let random = restoreRandom(work.random);
		let tools: Tools = { random, persistent: { ...this.#persistent } };
		let from = this.#scene;
		for (let steps = 0; steps < MAX_STEPS; steps++) {
			let index = await this.#resolve(work.cursor, from);
			if (isFailure(index)) return index;
			from = work.cursor.scene;
			let path = work.cursor.path as Path;
			let directive = directiveAt(index.data.module.directives, path);
			if (directive === undefined) {
				let ended = this.#leave(work, index.data, path);
				if (ended === null) continue;
				work.random = random.state();
				return success({ kind: "end", ending: ended, work });
			}
			if (isStop(directive)) {
				work.random = random.state();
				let snapshot = copyKeepingFiles(work);
				let frame = this.#frame(directive, work, tools);
				if (frame === null) {
					work.cursor.path = nextPath(path);
					continue;
				}
				work.random = random.state();
				clearOneShots(work);
				return success({ kind: "stop", stop: { snapshot, frame }, work });
			}
			let ended = this.#apply(directive, work, tools);
			if (ended !== null) {
				work.random = random.state();
				return success({ kind: "end", ending: ended, work });
			}
		}
		return failure(
			new NovelError(
				"endless-loop",
				`Scene "${work.cursor.scene}" ran ${MAX_STEPS} directives without a stop.`,
			),
		);
	}

	/**
	 * Loads the cursor's scene and resolves its anchor to a path. A counted anchor
	 * (`<key>+<n>`) that no longer exists resumes at `<key>` itself, and any other missing anchor
	 * at the scene's start. A scene entered from its top queues `scene`, and `chapter` when it
	 * belongs to another chapter than `from`.
	 */
	async #resolve(cursor: Cursor, from: string | null): Promise<Result<SceneIndex, NovelError>> {
		let index = await this.#runtime.load(cursor.scene);
		if (isFailure(index) || cursor.path !== null) return index;
		if (cursor.anchor === null) {
			cursor.path = [0];
			this.#entered(cursor.scene, from);
			return index;
		}
		let anchored = index.data.paths.get(cursor.anchor);
		if (anchored !== undefined) {
			cursor.path = cursor.after ? nextPath(anchored) : anchored;
			return index;
		}
		let base = COUNTED_ANCHOR.exec(cursor.anchor)?.[1];
		cursor.path = (base === undefined ? undefined : index.data.paths.get(base)) ?? [0];
		return index;
	}

	/** Queues the events of a scene started from its top. */
	#entered(scene: string, from: string | null): void {
		this.#pending.push({ type: "scene", scene });
		let chapter = this.#runtime.scene(scene)?.chapter;
		let previous = from === null ? undefined : this.#runtime.scene(from)?.chapter;
		if (chapter !== undefined && chapter.name !== previous?.name) {
			this.#pending.push({ type: "chapter", chapter, scene });
		}
	}

	/** Moves the cursor out of a list that ran out, answering the ending when the story did. */
	#leave(work: Live, index: SceneIndex, path: Path): Ending | null {
		if (path.length === 1) return this.#return(work);
		let parent = path.slice(0, -2);
		let owner = directiveAt(index.module.directives, parent);
		if (owner?.type === "choose" && owner.repeat) {
			let option = optionOf(owner, path.at(-2) as string);
			if (option !== undefined && !option.done) {
				work.cursor.path = parent;
				return null;
			}
		}
		work.cursor.path = nextPath(parent);
		return null;
	}

	/** Returns from a called scene, or ends the play when nothing called this one. */
	#return(work: Live): Ending | null {
		let caller = work.stack.pop();
		if (caller === undefined) return { key: null, scene: work.cursor.scene };
		work.cursor =
			caller.path === null
				? { ...caller, after: true }
				: { ...caller, path: nextPath(caller.path), anchor: null, after: false };
		return null;
	}

	/** Runs one directive that does not stop, answering the ending when it finishes the play. */
	#apply(directive: Directive, work: Live, tools: Tools): Ending | null {
		let path = work.cursor.path as Path;
		work.cursor.path = nextPath(path);
		switch (directive.type) {
			case "when": {
				let holds = call(directive.condition, work.state, tools);
				work.cursor.path = [...path, holds ? "do" : "otherwise", 0];
				return null;
			}
			case "set": {
				let update =
					typeof directive.update === "function"
						? (directive.update as (value: unknown, state: StateRecord, tools: Tools) => unknown)(
								getPath(work.state, directive.path),
								work.state,
								tools,
							)
						: directive.update;
				setPath(work.state, directive.path, structuredClone(update));
				return null;
			}
			case "goto":
			case "call":
				return this.#jump(directive.type, directive.scene.name, work, path);
			case "pick": {
				let scene = this.#pick(directive, work.state, tools);
				return scene === null ? null : this.#jump(directive.via, scene, work, path);
			}
			case "back":
				return this.#return(work);
			case "remember":
				this.#remember(directive.extension, directive.update, work.state, tools);
				return null;
			case "notify": {
				let values =
					typeof directive.values === "function"
						? call(directive.values as StoredCallback<object>, work.state, tools)
						: directive.values;
				this.#translated([directive.key]);
				let shown =
					values === undefined ? undefined : (structuredClone(values) as Record<string, unknown>);
				this.#pending.push({
					type: "notify",
					notify: { scene: work.cursor.scene, key: directive.key, values: shown },
				});
				return null;
			}
			case "ending":
				return { key: directive.key, scene: work.cursor.scene };
			case "play":
				this.#declared(directive.asset);
				this.#play(directive.asset, { volume: directive.volume, fade: directive.fade }, work.audio);
				return null;
			case "stop":
				if (directive.channel === "music") work.audio.music = null;
				else if (directive.asset === undefined) work.audio.ambience = [];
				else
					work.audio.ambience = work.audio.ambience.filter(
						(track) => track.id !== directive.asset?.id,
					);
				return null;
			default:
				this.#stage(directive, work.stage);
				return null;
		}
	}

	/**
	 * Validates an extension's new lasting slice and makes it what the rest of the run reads; the
	 * play keeps it once the run reaches its stop. A value the schema refuses is reported and
	 * dropped, leaving the slice as it was.
	 */
	#remember(extension: string, update: unknown, state: StateRecord, tools: Tools): void {
		let slices = tools.persistent as unknown as Record<string, unknown>;
		let schema = this.#runtime.lasting(extension);
		let next =
			typeof update === "function"
				? (update as (value: unknown, state: StateRecord, tools: Tools) => unknown)(
						structuredClone(slices[extension]),
						state,
						tools,
					)
				: update;
		let parsed =
			schema === undefined
				? failure(new Error("the extension keeps no lasting data"))
				: validate(schema, structuredClone(next));
		if (isFailure(parsed)) {
			this.#problem(
				new NovelError(
					"invalid-state",
					`Extension "${extension}" remembered a value it cannot keep: ${parsed.error.message}`,
					{ subject: extension },
				),
			);
			return;
		}
		slices[extension] = parsed.data;
		this.#pending.push({ type: "remember", extension, value: parsed.data });
	}

	/**
	 * Continues in `scene`, or calls it with a return to the directive after `path`; a `goto`
	 * past a replay's bound finishes the replay.
	 */
	#jump(via: "goto" | "call", scene: string, work: Live, path: Path): Ending | null {
		if (via === "goto" && this.#outside(scene)) return { key: null, scene: work.cursor.scene };
		if (via === "call")
			work.stack.push({ scene: work.cursor.scene, path, anchor: null, after: false });
		work.cursor = { scene, path: null, anchor: null, after: false };
		return null;
	}

	/**
	 * Draws a pick's scene among the candidates that weigh more than nothing, in proportion to
	 * their weights. Any qualifying candidate costs exactly one draw, also when the runtime
	 * settles the pick itself, so the stream after a pick is the same whichever scene it took.
	 *
	 * @returns The scene's name, or `null` when no candidate qualifies.
	 */
	#pick(directive: PickDirective, state: StateRecord, tools: Tools): string | null {
		let weights = new Map<string, number>();
		for (let scene of directive.scenes) {
			let weight = weighOf(directive, scene, state, tools);
			if (weight > 0) weights.set(scene.name, (weights.get(scene.name) ?? 0) + weight);
		}
		let candidates = [...weights.keys()];
		if (candidates.length === 0) return null;
		let total = [...weights.values()].reduce((sum, weight) => sum + weight, 0);
		let point = tools.random.next() * total;
		let drawn = candidates.at(-1) as string;
		for (let [scene, weight] of weights) {
			point -= weight;
			if (point < 0) {
				drawn = scene;
				break;
			}
		}
		if (candidates.length === 1 || this.#runtime.pick === undefined) return drawn;
		let settled = this.#runtime.pick(candidates, drawn);
		return weights.has(settled) ? settled : drawn;
	}

	/** Reports whether a jump to `scene` leaves the bound of the replay this play is. */
	#outside(scene: string): boolean {
		let replay = this.#replay;
		if (replay === null) return false;
		if (replay.scope === "scene") return scene !== replay.scene;
		return this.#runtime.scene(scene)?.chapter?.name !== replay.chapter;
	}

	/** Starts a track or a sound on its channel. */
	#play(asset: AssetDeclaration, options: { volume?: number; fade?: number }, audio: Audio): void {
		let track = withDefined({ id: asset.id, src: asset.src }, options);
		if (asset.kind === "music") {
			audio.music = track;
			this.#pending.push({ type: "unlock", kind: "music", id: asset.id });
		} else if (asset.kind === "ambience") {
			audio.ambience = [...audio.ambience.filter((entry) => entry.id !== asset.id), track];
		} else {
			this.#sounds += 1;
			let sound = withDefined(
				{ id: asset.id, src: asset.src, occurrence: `${this.#id}:${this.#sounds}` },
				{ caption: asset.caption, volume: options.volume },
			);
			audio.sounds = [...audio.sounds, sound];
		}
	}

	/** Applies a staging directive to the stage. */
	#stage(directive: Directive, stage: Stage): void {
		if ("asset" in directive && directive.asset !== undefined) this.#declared(directive.asset);
		if ("character" in directive) this.#declared(directive.character);
		switch (directive.type) {
			case "show": {
				let scenery = withDefined<StageScenery>(
					{ id: directive.asset.id, src: directive.asset.src },
					{ transition: directive.transition },
				);
				if (directive.asset.kind === "background") stage.background = scenery;
				else {
					stage.image = scenery;
					this.#pending.push({ type: "unlock", kind: "image", id: directive.asset.id });
				}
				return;
			}
			case "hide":
				stage.image = null;
				return;
			case "enter": {
				let entering = withDefined<StageCharacter>(
					{ id: directive.character.id, at: this.#runtime.position(directive.at), images: [] },
					{
						expression: directive.expression,
						layers: directive.layers,
						transition: directive.transition,
					},
				);
				let placed = drawCharacter(directive.character, entering);
				stage.characters = [...stage.characters.filter((entry) => entry.id !== placed.id), placed];
				forgetExit(stage, placed.id);
				return;
			}
			case "exit":
				leave(stage, directive.character.id, directive.transition);
				return;
			case "clear":
				for (let standing of stage.characters) leave(stage, standing.id, directive.transition);
				return;
			case "express":
				stage.characters = stage.characters.map((entry) => {
					if (entry.id !== directive.character.id) return entry;
					let changed = withDefined<StageCharacter>(
						{ ...entry },
						{
							expression: directive.expression,
							layers:
								directive.layers === undefined
									? undefined
									: { ...entry.layers, ...directive.layers },
							transition: directive.transition,
						},
					);
					return drawCharacter(directive.character, changed);
				});
				return;
			case "move":
				stage.characters = stage.characters.map((entry) =>
					entry.id === directive.character.id
						? withDefined<StageCharacter>(
								{ ...entry, at: this.#runtime.position(directive.at) },
								{ transition: directive.transition },
							)
						: entry,
				);
				break;
			default:
				break;
		}
	}

	/** Builds the frame for a stop, or `null` for a menu with no option to take. */
	#frame(directive: Directive, work: Live, tools: Tools): StopFrame | null {
		this.#frames += 1;
		let id = `${this.#id}:${this.#frames}`;
		let scene = work.cursor.scene;
		let base = { id, scene, audio: copyKeepingFiles({ ...work.audio, voice: null }) };
		switch (directive.type) {
			case "say":
			case "narrate": {
				let speakers = directive.type === "say" ? directive.speakers : [];
				let values =
					typeof directive.values === "function"
						? call(directive.values as StoredCallback<object>, work.state, tools)
						: directive.values;
				let voice =
					speakers[0] === undefined ? null : this.#runtime.voice(speakers[0].id, directive.key);
				let seen = this.#persistent.seen[recordKey(scene, directive.key)] !== undefined;
				let ids = new Set(speakers.map((speaker) => speaker.id));
				let shown =
					values === undefined ? undefined : (structuredClone(values) as Record<string, unknown>);
				for (let speaker of speakers) this.#declared(speaker);
				this.#translated([
					directive.key,
					...speakers.map((speaker) => speaker.name),
					...work.audio.sounds.map((sound) => sound.caption),
				]);
				this.#pending.push({
					type: "line",
					line: {
						scene,
						key: directive.key,
						speakers: speakers.map((speaker) => speaker.id),
						values: structuredClone(shown),
					},
				});
				return {
					...base,
					type: "line",
					stage: frameStage(work.stage, ids),
					audio: copyKeepingFiles({ ...work.audio, voice }),
					speakers: speakers.map((speaker) =>
						withDefined({ id: speaker.id, name: speaker.name }, { color: speaker.color }),
					),
					key: directive.key,
					values: shown,
					voice,
					seen,
					advance: () => reply({ frame: id, kind: "advance" }),
				};
			}
			case "choose": {
				let options = this.#options(directive, work, tools);
				if (!options.some((option) => !option.disabled)) {
					let subject = recordKey(scene, menuAnchor(directive) ?? "");
					this.#problem(
						new NovelError("dead-end-menu", `The menu "${subject}" has no option to take.`, {
							subject,
						}),
					);
					return null;
				}
				this.#translated([
					directive.prompt,
					...options.flatMap((option) => [option.label, option.reason]),
					...work.audio.sounds.map((sound) => sound.caption),
				]);
				return withDefined(
					{
						...base,
						type: "choice" as const,
						stage: frameStage(work.stage, new Set()),
						options,
						choose: (option: string) => reply({ frame: id, kind: "choose", option }),
					},
					{ prompt: directive.prompt, timeout: directive.timeout, default: directive.default },
				);
			}
			case "wait":
				return {
					...base,
					type: "pause",
					stage: frameStage(work.stage, new Set()),
					duration: directive.duration,
					advance: () => reply({ frame: id, kind: "advance" }),
				};
			case "custom":
				return {
					...base,
					type: "custom",
					stage: frameStage(work.stage, new Set()),
					interaction: directive.interaction.name,
					input: parsedInput(directive.interaction, directive.input),
					complete: (output: unknown) => reply({ frame: id, kind: "complete", output }),
				} as StopFrame;
			default:
				return null;
		}
	}

	/** The options a menu offers now: hidden ones removed, locked ones marked, taken `once` ones gone. */
	#options(menu: ChooseDirective, work: Live, tools: Tools): FrameOption[] {
		let scene = work.cursor.scene;
		let offered: FrameOption[] = [];
		for (let option of menu.options) {
			let id = `${scene}:${option.key}`;
			if (option.once && work.taken.includes(id)) continue;
			let holds = option.when === undefined || call(option.when, work.state, tools);
			if (!holds && option.visibility === "hidden") continue;
			offered.push(
				withDefined(
					{
						id: option.key,
						label: option.key,
						disabled: !holds,
						chosen: this.#persistent.chosen.includes(id),
					},
					{ reason: holds ? undefined : option.reason },
				),
			);
		}
		return offered;
	}

	/** A cursor as a save stores it: its scene and the anchor of the directive it stands on. */
	#anchor(cursor: Cursor): StoryPosition {
		if (cursor.path === null) return { scene: cursor.scene, line: cursor.anchor ?? "" };
		let index = this.#runtime.loaded(cursor.scene);
		let line = index?.anchors.get(JSON.stringify(cursor.path)) ?? "";
		return { scene: cursor.scene, line };
	}
}

/**
 * Adds a value to a list that holds each value once.
 *
 * @returns `true` when the value was new.
 */
function addOnce(list: string[], value: string): boolean {
	if (list.includes(value)) return false;
	list.push(value);
	return true;
}

/** Reports whether a directive stops the play for the player. */
function isStop(directive: Directive): boolean {
	return (
		directive.type === "say" ||
		directive.type === "narrate" ||
		directive.type === "choose" ||
		directive.type === "wait" ||
		directive.type === "custom"
	);
}

/**
 * A candidate's weight as a number: `true` is 1, and `false` or a number that is not positive
 * and finite is 0.
 */
function weighOf(
	directive: PickDirective,
	scene: PickDirective["scenes"][number],
	state: StateRecord,
	tools: Tools,
): number {
	if (directive.weight === undefined) return 1;
	let weight = directive.weight(scene, state, tools);
	if (typeof weight === "boolean") return weight ? 1 : 0;
	return Number.isFinite(weight) && weight > 0 ? weight : 0;
}

/** Calls a stored callback with the play's state. */
function call<Value>(callback: StoredCallback<Value>, state: StateRecord, tools: Tools): Value {
	return callback(state, tools);
}

/** Wraps a reply body so only the engine reads it. */
function reply(body: Reply[typeof REPLY]): Reply {
	return { [REPLY]: body };
}

/**
 * The interaction input as its schema parses it. A scene's input is checked by the compiler,
 * so a refusal here falls back to the input as written.
 */
function parsedInput(target: InteractionDeclaration, input: unknown): unknown {
	let parsed = validate(target.input, input);
	return isFailure(parsed) ? input : parsed.data;
}

/** Drops the facts that belong to one stop: transitions and the sounds it started. */
function clearOneShots(work: Live): void {
	let { background, image } = work.stage;
	if (background !== null) delete background.transition;
	if (image !== null) delete image.transition;
	for (let character of work.stage.characters) delete character.transition;
	delete work.stage.exits;
	work.audio.sounds = [];
}

/** The stage as a frame shows it, marking the speakers. */
function frameStage(stage: Stage, speakers: Set<string>): FrameStage {
	let shown: FrameStage = {
		background: stage.background === null ? null : { ...stage.background },
		image: stage.image === null ? null : { ...stage.image },
		characters: stage.characters.map((character) => ({
			...character,
			speaking: speakers.has(character.id),
		})),
	};
	if (stage.exits !== undefined) shown.exits = copyKeepingFiles(stage.exits);
	return shown;
}

/**
 * Takes a character off stage and records how it left, as it last stood and with the exit's
 * transition alone, so the stop's frame can animate the exit. A character not on stage leaves
 * no record.
 */
function leave(stage: Stage, id: string, transition: CharacterTransition | undefined): void {
	let leaving = stage.characters.find((entry) => entry.id === id);
	if (leaving === undefined) return;
	stage.characters = stage.characters.filter((entry) => entry.id !== id);
	let { transition: _entrance, ...stood } = leaving;
	let exit = withDefined<StageCharacter>(stood, { transition });
	stage.exits = [...(stage.exits ?? []).filter((entry) => entry.id !== id), exit];
}

/** Drops the exit of a character that came back before the stop, which then never left. */
function forgetExit(stage: Stage, id: string): void {
	if (stage.exits === undefined) return;
	let exits = stage.exits.filter((entry) => entry.id !== id);
	if (exits.length === 0) delete stage.exits;
	else stage.exits = exits;
}

/**
 * Draws a character from its declaration: the named sprite (the first one by default), or the
 * named variant of every layer (each layer's first by default), bottom to top.
 *
 * @param character - The declared character.
 * @param entry - Where it stands and what it shows.
 * @returns The entry with its images filled in.
 */
export function drawCharacter(
	character: CharacterDeclaration,
	entry: StageCharacter,
): StageCharacter {
	let image = character.image;
	if (image.kind === "sprites") {
		let names = Object.keys(image.sprites);
		let expression =
			entry.expression !== undefined && entry.expression in image.sprites
				? entry.expression
				: names[0];
		if (expression === undefined) return { ...entry, images: [] };
		return { ...entry, expression, images: [image.sprites[expression] as AssetSource] };
	}
	if (image.kind === "layers") {
		let layers: Record<string, string> = {};
		let images: AssetSource[] = [];
		for (let [layer, variants] of Object.entries(image.layers)) {
			let wanted = entry.layers?.[layer];
			let variant = wanted !== undefined && wanted in variants ? wanted : Object.keys(variants)[0];
			if (variant === undefined) continue;
			layers[layer] = variant;
			images.push(variants[variant] as AssetSource);
		}
		return { ...entry, layers, images };
	}
	return { ...entry, images: [] };
}

/**
 * Copies the fields of `optional` that are defined onto `value`, so frames and saves carry no
 * `undefined` keys.
 */
function withDefined<Value extends object>(value: Value, optional: Record<string, unknown>): Value {
	let result = { ...value } as Record<string, unknown>;
	for (let [key, field] of Object.entries(optional)) {
		if (field !== undefined) result[key] = field;
	}
	return result as Value;
}
