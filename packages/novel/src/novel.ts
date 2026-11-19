/**
 * `createNovel()`: the novel object an app builds once from its declarations and state schema,
 * maps every scene onto its module, and starts plays from. A play is an async generator of
 * frames, with the current `GameState` and `rollback()` beside it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Seed } from "@sdxc/random";
import type { Result } from "@sdxc/result";
import type { StandardSchemaV1 } from "@standard-schema/spec";

import { createRandom, systemSeed } from "@sdxc/random";
import { failure, isFailure, success } from "@sdxc/result";

import type { SceneIndex } from "./anchors.js";
import type {
	AssetDeclaration,
	AssetSource,
	CharacterDeclaration,
	SceneDeclaration,
} from "./declarations.js";
import type { SceneModule } from "./directives.js";
import type { Cursor, Live, NovelRuntime } from "./engine.js";
import type { Ending, Frame, GameState, Reply, StopFrame } from "./frames.js";
import type { Lazy } from "./lazy.js";
import type { Audio, Fraction, Position, PositionAlias, Stage } from "./stage.js";
import type { SavedGame } from "./state.js";
import type { DeepPartial, NovelState, StateRecord } from "./types.js";

import { indexScene } from "./anchors.js";
import {
	collect,
	isAssetDeclaration,
	isCharacterDeclaration,
	isSceneDeclaration,
} from "./declarations.js";
import { drawCharacter, PlayEngine } from "./engine.js";
import { NovelError } from "./errors.js";
import { isLazy } from "./lazy.js";
import { DEFAULT_POSITIONS, emptyStage, silence } from "./stage.js";
import { SAVED_GAME_SCHEMA, validate } from "./state.js";

/** Stops `rollback()` returns through unless a novel sets its own depth. */
const DEFAULT_ROLLBACK = 100;

/** Matches a position written as a column, `n/d`. */
const FRACTION = /^\d+\/\d+$/;

/** A line's speaker and key, which a novel's `voice` option finds the voice file by. */
export interface VoiceLine {
	/** The id of the line's first speaker. */
	speaker: string;
	key: string;
}

/** The story options a novel is built from; presentation settings belong to the player. */
export interface NovelOptions {
	/** The `scenes()` map, which names the scenes a save can stand in. */
	scenes: object;
	/** The `cast()` map, which a loaded save redraws characters from. */
	cast?: object;
	/** The `assets()` map, which a loaded save re-reads file URLs from. */
	assets?: object;
	/** The `interactions()` map. */
	interactions?: object;
	/** The schema of the story state; it types every callback and validates loaded saves. */
	state: StandardSchemaV1<unknown, NovelState>;
	/** The scene a new play starts in. */
	initial: SceneDeclaration;
	/**
	 * How many earlier stops `rollback()` can return to; `0` turns rollback off.
	 *
	 * @default 100
	 */
	rollback?: number;
	/** Redefines where `left`, `center` and `right` stand. */
	positions?: Partial<Record<PositionAlias, Fraction>>;
	/** Finds the voice file for a spoken line, or answers `undefined` when it has none. */
	voice?: (line: VoiceLine) => AssetSource | undefined;
}

/** How a play starts: new, from a scene, or from a save. */
export interface StartOptions {
	/** A `GameState` read back from storage; it is validated before the play resumes from it. */
	from?: unknown;
	/** The scene a new play starts in, instead of the novel's initial one. */
	scene?: SceneDeclaration;
	/** The state a new play starts from; every missing field takes its schema default. */
	state?: DeepPartial<NovelState>;
	/** The seed of a new play's random stream, so a test replays the same draws. */
	seed?: Seed;
}

/**
 * A playthrough: an async generator that yields a frame per stop, takes the reply a frame
 * built, and returns the ending.
 */
export interface Play extends AsyncGenerator<Frame, Ending, Reply | undefined> {
	/** The play as JSON at the current stop, ready to save. */
	readonly state: GameState;
	/**
	 * Returns to the stop before the current one, restoring its state, stage and random draws;
	 * the next reply answers the frame it returns.
	 *
	 * @returns The earlier stop's frame, or `null` when there is none left to return to.
	 */
	rollback(): Promise<StopFrame | null>;
}

/**
 * A novel: its declarations, the module mapped onto each scene, and the plays started from it.
 * It holds no player state, so one instance serves every play.
 */
export class Novel {
	#options: NovelOptions;
	#modules = new Map<string, () => Promise<Result<SceneIndex, NovelError>>>();
	#indexes = new Map<string, SceneIndex>();
	#scenes: Map<string, SceneDeclaration>;
	#characters: Map<string, CharacterDeclaration>;
	#assets: Map<string, AssetDeclaration>;

	/**
	 * Creates the novel; {@link createNovel} is the usual way to call it.
	 *
	 * @param options - The declarations, state schema and story options.
	 */
	constructor(options: NovelOptions) {
		this.#options = options;
		this.#scenes = byKey(collect(options.scenes, isSceneDeclaration), (scene) => scene.name);
		this.#characters = byKey(
			collect(options.cast ?? {}, isCharacterDeclaration),
			(entry) => entry.id,
		);
		this.#assets = byKey(collect(options.assets ?? {}, isAssetDeclaration), (asset) => asset.id);
	}

	/** Every mapped scene, in the order it was mapped. */
	get mapped(): SceneDeclaration[] {
		return [...this.#modules.keys()].map((name) => this.#scenes.get(name) as SceneDeclaration);
	}

	/**
	 * Maps a scene onto its module, held directly or loaded through `lazy()` the first time a
	 * play reaches it.
	 *
	 * @param scene - The declared scene.
	 * @param module - What `createScene()` returned for it, or the module that default-exports it.
	 * @throws When the scene is already mapped.
	 * @example novel.map(scenes.prologue.opening, lazy(() => import("~/novel/scenes/prologue/opening")));
	 */
	map<Declaration extends SceneDeclaration>(
		scene: Declaration,
		module: SceneModule<Declaration> | Lazy<SceneModule<Declaration>>,
	): void {
		if (this.#modules.has(scene.name)) throw new Error(`Scene "${scene.name}" is already mapped`);
		let pending: Promise<Result<SceneIndex, NovelError>> | undefined;
		this.#modules.set(scene.name, () => {
			pending ??= this.#import(scene.name, module);
			return pending;
		});
	}

	/**
	 * Starts a play: a new one, from a given scene and state, or from a save.
	 *
	 * @param options - Where the play starts; see {@link StartOptions}.
	 * @returns The play, or an `invalid-state` error for a save or state the schemas refuse and an
	 * `unmapped-scene` error for a scene with no module.
	 * @example let play = novel.start({ from: JSON.parse(localStorage.getItem("save:1") ?? "null") });
	 */
	start(options: StartOptions = {}): Result<Play, NovelError> {
		let live = options.from === undefined ? this.#fresh(options) : this.#restore(options.from);
		if (isFailure(live)) return live;
		if (!this.#modules.has(live.data.live.cursor.scene)) {
			return failure(
				new NovelError("unmapped-scene", `Scene "${live.data.live.cursor.scene}" has no module.`),
			);
		}
		let engine = new PlayEngine(this.#runtime(), live.data.live, live.data.playTime);
		return success(createPlay(engine));
	}

	/** A new play's starting point. */
	#fresh(options: StartOptions): Result<{ live: Live; playTime: number }, NovelError> {
		let state = validate(this.#options.state, options.state ?? {});
		if (isFailure(state)) {
			return failure(
				new NovelError("invalid-state", `The starting state is invalid: ${state.error.message}`),
			);
		}
		let scene = (options.scene ?? this.#options.initial).name;
		let live: Live = {
			cursor: { scene, path: null, anchor: null, after: false },
			stack: [],
			stage: emptyStage(),
			audio: silence(),
			state: state.data as StateRecord,
			random: createRandom(options.seed ?? systemSeed()).state(),
			taken: [],
		};
		return success({ live, playTime: 0 });
	}

	/** A saved play's starting point, after checking it against the schemas and declarations. */
	#restore(from: unknown): Result<{ live: Live; playTime: number }, NovelError> {
		let saved = validate(SAVED_GAME_SCHEMA, from);
		if (isFailure(saved)) {
			return failure(
				new NovelError("invalid-state", `The save is invalid: ${saved.error.message}`),
			);
		}
		let game = saved.data;
		let unknown = [game.position, ...game.stack].find((entry) => !this.#scenes.has(entry.scene));
		if (unknown !== undefined) {
			return failure(
				new NovelError("invalid-state", `The save stands in unknown scene "${unknown.scene}".`),
			);
		}
		let state = validate(this.#options.state, game.state);
		if (isFailure(state)) {
			return failure(
				new NovelError("invalid-state", `The saved state is invalid: ${state.error.message}`),
			);
		}
		let live: Live = {
			cursor: anchored(game.position, false),
			stack: game.stack.map((entry) => anchored(entry, true)),
			stage: this.#stage(game.stage),
			audio: this.#audio(game.audio),
			state: state.data as StateRecord,
			random: game.random,
			taken: game.taken,
		};
		return success({ live, playTime: game.meta.playTime });
	}

	/** Redraws a saved stage from the current declarations, dropping what no longer exists. */
	#stage(saved: SavedGame["stage"]): Stage {
		let scenery = (entry: SavedGame["stage"]["background"]) => {
			let asset = entry === null ? undefined : this.#assets.get(entry.id);
			if (entry === null || asset === undefined) return null;
			return entry.transition === undefined
				? { id: asset.id, src: asset.src }
				: { id: asset.id, src: asset.src, transition: entry.transition };
		};
		let characters = saved.characters.flatMap((entry) => {
			let declared = this.#characters.get(entry.id);
			if (declared === undefined) return [];
			let { at, ...rest } = entry;
			return [drawCharacter(declared, { ...rest, at: this.#position(at as Position), images: [] })];
		});
		return { background: scenery(saved.background), image: scenery(saved.image), characters };
	}

	/** Re-reads saved audio from the current declarations, dropping what no longer exists. */
	#audio(saved: SavedGame["audio"]): Audio {
		let track = <Entry extends { id: string }>(entry: Entry) => {
			let asset = this.#assets.get(entry.id);
			return asset === undefined ? [] : [{ ...entry, src: asset.src }];
		};
		let sounds = saved.sounds.flatMap((entry) => {
			let asset = this.#assets.get(entry.id);
			if (asset === undefined) return [];
			let sound = { ...entry, src: asset.src };
			return [asset.caption === undefined ? sound : { ...sound, caption: asset.caption }];
		});
		return {
			music: saved.music === null ? null : (track(saved.music)[0] ?? null),
			ambience: saved.ambience.flatMap(track),
			sounds,
			voice: null,
		};
	}

	/** Resolves a position alias to its column. */
	#position(position: Position): Fraction {
		if (FRACTION.test(position)) return position as Fraction;
		let alias = position as PositionAlias;
		return this.#options.positions?.[alias] ?? DEFAULT_POSITIONS[alias] ?? DEFAULT_POSITIONS.center;
	}

	/** Imports a scene's module, checks it plays the scene it was mapped to, and indexes it. */
	async #import(
		name: string,
		module: SceneModule | Lazy<SceneModule>,
	): Promise<Result<SceneIndex, NovelError>> {
		let loaded: SceneModule;
		try {
			loaded = isLazy(module) ? (await module.load()).default : module;
		} catch (error) {
			return failure(
				new NovelError("load-failed", `Scene "${name}" failed to load.`, { cause: error }),
			);
		}
		if (loaded.scene.name !== name) {
			return failure(
				new NovelError(
					"load-failed",
					`Scene "${name}" was mapped to the module of "${loaded.scene.name}".`,
				),
			);
		}
		let index = indexScene(loaded);
		this.#indexes.set(name, index);
		return success(index);
	}

	/** What a play's engine reads from this novel. */
	#runtime(): NovelRuntime {
		return {
			rollback: this.#options.rollback ?? DEFAULT_ROLLBACK,
			load: async (scene) => {
				let load = this.#modules.get(scene);
				if (load === undefined) {
					return failure(new NovelError("unmapped-scene", `Scene "${scene}" has no module.`));
				}
				return load();
			},
			loaded: (scene) => this.#indexes.get(scene),
			scene: (name) => this.#scenes.get(name),
			position: (position) => this.#position(position),
			voice: (speaker, key) => this.#options.voice?.({ speaker, key }) ?? null,
		};
	}
}

/** A cursor that resolves a saved position once its scene loads. */
function anchored(position: { scene: string; line: string }, after: boolean): Cursor {
	return { scene: position.scene, path: null, anchor: position.line, after };
}

/** Indexes declarations by the key each one is named by. */
function byKey<Value>(values: Value[], key: (value: Value) => string): Map<string, Value> {
	return new Map(values.map((value) => [key(value), value]));
}

/** Wraps an engine in the generator a caller iterates, with `state` and `rollback()` beside it. */
function createPlay(engine: PlayEngine): Play {
	/**
	 * Hands each reply to the engine until the play ends.
	 *
	 * @yields Each stop's frame, or an error frame for a reply the engine refused.
	 */
	async function* run(): AsyncGenerator<Frame, Ending, Reply | undefined> {
		let outcome = await engine.step(undefined);
		while (outcome.kind === "frame") {
			let reply = yield outcome.frame;
			outcome = await engine.step(reply);
		}
		return outcome.ending;
	}

	let play = run();
	return Object.defineProperties(play, {
		state: { get: () => engine.state },
		rollback: { value: () => engine.rollback() },
	}) as Play;
}

/**
 * Creates a novel from its declarations and state schema; map every scene onto its module
 * before starting a play.
 *
 * @param options - The declarations, state schema, initial scene and story options.
 * @returns The novel.
 * @example export const novel = createNovel({ scenes, cast, assets, interactions, state: STATE, initial: scenes.prologue.opening });
 */
export function createNovel(options: NovelOptions): Novel {
	return new Novel(options);
}
