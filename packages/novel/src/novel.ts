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
import type { Emit, NovelEventName, NovelListener, NovelPlugin } from "./events.js";
import type { Ending, Frame, GameState, Reply, StopFrame } from "./frames.js";
import type { Lazy } from "./lazy.js";
import type { NovelLink, ReachedScene, ReachOptions } from "./links.js";
import type { Persistent } from "./persistent.js";
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
import { Listeners } from "./events.js";
import { isLazy } from "./lazy.js";
import { reach, toLinks } from "./links.js";
import { readPersistent } from "./persistent.js";
import { DEFAULT_POSITIONS, emptyStage, silence } from "./stage.js";
import { SAVED_GAME_SCHEMA, validate } from "./state.js";

/** Stops `rollback()` returns through unless a novel sets its own depth. */
const DEFAULT_ROLLBACK = 100;

/** Matches a position written as a column, `n/d`. */
const FRACTION = /^\d+\/\d+$/;

/**
 * Reaches what `check()` and `explore()` read from a novel: its declarations, its scene
 * modules, and plays whose events go to the tool instead of the app's listeners.
 */
export const INTERNALS = Symbol.for("@sdxc/novel.internals");

/**
 * A line's speaker, key and locale, which a novel's `voice` option finds the voice file by.
 * With `locales`, the novel asks once per locale and the frame carries a map of locale to URL.
 */
export interface VoiceLine {
	/** The id of the line's first speaker. */
	speaker: string;
	key: string;
	/** The locale asked for; absent when the novel declares no locales. */
	locale?: string;
}

/** A JSON object, as a save is handed to a migration. */
export interface SavedObject {
	[key: string]: unknown;
}

/**
 * Upgrades a save from the version it is keyed by to the next one. It receives a copy of the
 * save, and the novel sets the new `version` on what it answers.
 */
export type Migration = (game: SavedObject) => Result<SavedObject, Error>;

/** A message catalog: keys nested by dot, each ending in a MessageFormat string. */
export interface MessageCatalog {
	readonly [key: string]: string | MessageCatalog;
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
	/**
	 * The version a save is stamped with. Raise it with a `migrate` step when saved state
	 * changes shape in a way schema defaults cannot fill.
	 *
	 * @default 1
	 */
	version?: number;
	/** Upgrades a save step by step, keyed by the version each step upgrades from. */
	migrate?: Readonly<Record<number, Migration>>;
	/**
	 * The app's catalogs by locale. A shown key a catalog lacks is reported on `error`, and the
	 * frame still carries the key for the UI to show in its place.
	 */
	messages?: Readonly<Record<string, MessageCatalog>>;
	/**
	 * The locales `voice` is asked for, one call each.
	 *
	 * @default the locales of `messages`
	 */
	locales?: readonly string[];
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
	/**
	 * `Persistent` data read back from storage. It is validated, and a value the schema refuses,
	 * or none, starts the play from empty data.
	 */
	persistent?: unknown;
}

/** Where a tool sends a play's events, and whether the app's listeners still receive them. */
export interface PlaySink {
	emit: Emit;
	/** Keeps the play's events from the novel's own listeners. */
	quiet?: boolean;
}

/** What `check()` and `explore()` read from a novel. */
export interface NovelInternals {
	readonly options: NovelOptions;
	readonly scenes: ReadonlyMap<string, SceneDeclaration>;
	readonly assets: ReadonlyMap<string, AssetDeclaration>;
	readonly characters: ReadonlyMap<string, CharacterDeclaration>;
	/** The names of the mapped scenes. */
	readonly mapped: readonly string[];
	load(scene: string): Promise<Result<SceneIndex, NovelError>>;
	position(position: Position): Fraction;
	/** Reports whether the novel lacks an asset or a character a scene uses. */
	missing(declaration: AssetDeclaration | CharacterDeclaration): boolean;
	/** The voice file of a spoken line, from the novel's `voice` option. */
	voice(speaker: string, key: string): AssetSource | null;
	/**
	 * Maps an already mapped scene onto a new module, so plays started afterwards play the edited
	 * scene; a play already running keeps the module it loaded.
	 */
	replace(scene: string, module: SceneModule): void;
	start(options: StartOptions, sink: PlaySink): Result<Play, NovelError>;
}

/**
 * A playthrough: an async generator that yields a frame per stop, takes the reply a frame
 * built, and returns the ending.
 */
export interface Play extends AsyncGenerator<Frame, Ending, Reply | undefined> {
	/** The play as JSON at the current stop, ready to save. */
	readonly state: GameState;
	/** Persistent data as this play has updated it, the same value the last `persist` carried. */
	readonly persistent: Persistent;
	/**
	 * Emits `save` with the play as it stands, for the app's listener to store under `slot`.
	 *
	 * @returns The state that was emitted.
	 */
	save(slot: string): GameState;
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
	#listeners = new Listeners();

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
		this.#bind(scene.name, module);
	}

	/**
	 * The `<link>` descriptors a page renders into its head for a play starting at `scene`:
	 * `preload` for the images and sounds the scene shows, `prefetch` for its music and voices
	 * and for every file of the scenes its jumps reach within `depth`. Lazy modules on the way are
	 * imported, and `data:` URLs are left out.
	 *
	 * @param scene - The scene the page starts in.
	 * @param options - How many jumps to follow (1 by default) and the reader's locale.
	 * @returns The descriptors, preloads first, each URL once.
	 * @example <Document links={await novel.links(scenes.prologue.opening, { depth: 1, locale })} />
	 */
	async links(scene: SceneDeclaration, options: ReachOptions = {}): Promise<NovelLink[]> {
		return toLinks(await reach(this[INTERNALS](), scene, options));
	}

	/**
	 * The scenes within `depth` jumps of `scene` and the files each one uses, for a player to
	 * prefetch while the reader is still in `scene`. Reaching a scene imports its lazy module,
	 * so the call is also the modules' prefetch.
	 *
	 * @param scene - The scene the play stands in.
	 * @param options - How many jumps to follow (1 by default) and the reader's locale.
	 * @returns Every reached scene, nearest first, with its files in document order.
	 * @example for (let next of await novel.reachable(scenes.spring.cafe.meeting, { locale })) for (let asset of next.assets) prefetch(asset.url);
	 */
	reachable(scene: SceneDeclaration, options: ReachOptions = {}): Promise<ReachedScene[]> {
		return reach(this[INTERNALS](), scene, options);
	}

	/**
	 * Listens to an event of every play this novel starts. Listeners run side effects only; one
	 * that throws or rejects is reported on `error`.
	 *
	 * @param name - The event; see `NovelEvents`.
	 * @param listener - Called with the payload and the play it fired for.
	 * @returns A function that removes the listener.
	 * @example novel.on("persist", (persistent) => localStorage.setItem("persistent", JSON.stringify(persistent)));
	 */
	on<Name extends NovelEventName>(name: Name, listener: NovelListener<Name>): () => void {
		return this.#listeners.on(name, listener);
	}

	/**
	 * Removes a listener added with {@link Novel.on}.
	 *
	 * @param name - The event.
	 * @param listener - The same function that was added.
	 */
	off<Name extends NovelEventName>(name: Name, listener: NovelListener<Name>): void {
		this.#listeners.off(name, listener);
	}

	/**
	 * Installs a plugin, which registers its listeners on this novel.
	 *
	 * @param plugin - A function of the novel.
	 * @returns The novel, so plugins chain.
	 * @example novel.use(achievements({ "endings.good": "ACH_GOOD_END" }));
	 */
	use(plugin: NovelPlugin): this {
		plugin(this);
		return this;
	}

	/**
	 * Starts a play: a new one, from a given scene and state, or from a save.
	 *
	 * @param options - Where the play starts; see {@link StartOptions}.
	 * @returns The play, or an `invalid-state` error for a save or state the schemas refuse, a
	 * `migration-failed` error for a save no migration upgrades, and an `unmapped-scene` error for
	 * a scene with no module.
	 * @example let play = novel.start({ from: JSON.parse(localStorage.getItem("save:1") ?? "null") });
	 */
	start(options: StartOptions = {}): Result<Play, NovelError> {
		return this.#start(options, undefined);
	}

	/**
	 * What `check()` and `explore()` read from the novel.
	 *
	 * @returns The declarations, the scene loader and a start that routes events to a sink.
	 */
	[INTERNALS](): NovelInternals {
		return {
			options: this.#options,
			scenes: this.#scenes,
			assets: this.#assets,
			characters: this.#characters,
			mapped: [...this.#modules.keys()],
			load: (scene) => this.#load(scene),
			position: (position) => this.#position(position),
			missing: (declaration) => this.#missing(declaration),
			voice: (speaker, key) => this.#voice(speaker, key),
			replace: (scene, module) => {
				this.#indexes.delete(scene);
				this.#bind(scene, module);
			},
			start: (options, sink) => this.#start(options, sink),
		};
	}

	/** Binds a scene to its module, imported once on the first load. */
	#bind(scene: string, module: SceneModule | Lazy<SceneModule>): void {
		let pending: Promise<Result<SceneIndex, NovelError>> | undefined;
		this.#modules.set(scene, () => {
			pending ??= this.#import(scene, module);
			return pending;
		});
	}

	/** Starts a play whose events reach `sink`, and the app's listeners unless it is quiet. */
	#start(options: StartOptions, sink: PlaySink | undefined): Result<Play, NovelError> {
		let live = options.from === undefined ? this.#fresh(options) : this.#restore(options.from);
		if (isFailure(live)) return live;
		if (!this.#modules.has(live.data.live.cursor.scene)) {
			return failure(
				new NovelError("unmapped-scene", `Scene "${live.data.live.cursor.scene}" has no module.`, {
					subject: live.data.live.cursor.scene,
				}),
			);
		}
		let play: Play | undefined;
		let emit: Emit = (name, payload) => {
			sink?.emit(name, payload);
			if (sink?.quiet !== true) this.#listeners.emit(name, payload, play as Play);
		};
		let engine = new PlayEngine(
			this.#runtime(emit),
			live.data.live,
			live.data.playTime,
			readPersistent(options.persistent),
		);
		play = createPlay(engine);
		return success(play);
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

	/** A saved play's starting point, after migrating it and checking it against the schemas. */
	#restore(from: unknown): Result<{ live: Live; playTime: number }, NovelError> {
		let migrated = this.#migrate(from);
		if (isFailure(migrated)) return migrated;
		let saved = validate(SAVED_GAME_SCHEMA, migrated.data);
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

	/**
	 * Upgrades a save to this novel's version one `migrate` step at a time. A save without a
	 * version is version 1; one newer than the novel, or one no step upgrades, is refused.
	 */
	#migrate(from: unknown): Result<unknown, NovelError> {
		if (typeof from !== "object" || from === null || Array.isArray(from)) {
			return failure(new NovelError("invalid-state", "The save is not a JSON object."));
		}
		let game = from as SavedObject;
		let version = game.version ?? 1;
		let target = this.#options.version ?? 1;
		if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
			return failure(new NovelError("invalid-state", "The save's version is not a whole number."));
		}
		if (version > target) {
			return failure(
				new NovelError(
					"migration-failed",
					`The save is from version ${version}, newer than this novel's ${target}.`,
				),
			);
		}
		while (version < target) {
			let upgraded = runMigration(this.#options.migrate?.[version], game, version);
			if (isFailure(upgraded)) return upgraded;
			version += 1;
			game = { ...upgraded.data, version };
		}
		return success(game);
	}

	/** Loads a mapped scene once, indexing its anchors. */
	#load(scene: string): Promise<Result<SceneIndex, NovelError>> {
		let load = this.#modules.get(scene);
		if (load === undefined) {
			return Promise.resolve(
				failure(
					new NovelError("unmapped-scene", `Scene "${scene}" has no module.`, { subject: scene }),
				),
			);
		}
		return load();
	}

	/** The locales `voice` is asked for. */
	#locales(): readonly string[] {
		return this.#options.locales ?? Object.keys(this.#options.messages ?? {});
	}

	/** The voice of a line: one file, or a map of locale to file when the novel has locales. */
	#voice(speaker: string, key: string): AssetSource | null {
		let voice = this.#options.voice;
		if (voice === undefined) return null;
		let locales = this.#locales();
		if (locales.length === 0) return voice({ speaker, key }) ?? null;
		let files: Record<string, string> = {};
		for (let locale of locales) {
			let found = voice({ speaker, key, locale });
			let file = typeof found === "string" ? found : found?.[locale];
			if (file !== undefined) files[locale] = file;
		}
		return Object.keys(files).length === 0 ? null : files;
	}

	/** Reports whether the novel lacks a declaration a scene uses, when it declares that kind. */
	#missing(declaration: AssetDeclaration | CharacterDeclaration): boolean {
		if ("kind" in declaration) {
			if (this.#options.assets === undefined) return false;
			let declared = this.#assets.get(declaration.id);
			return declared === undefined || isEmptySource(declared.src);
		}
		return this.#options.cast !== undefined && !this.#characters.has(declaration.id);
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

	/** What a play's engine reads from this novel, with its events sent through `emit`. */
	#runtime(emit: Emit): NovelRuntime {
		let catalogs = Object.entries(this.#options.messages ?? {});
		return {
			rollback: this.#options.rollback ?? DEFAULT_ROLLBACK,
			version: this.#options.version ?? 1,
			load: (scene) => this.#load(scene),
			loaded: (scene) => this.#indexes.get(scene),
			scene: (name) => this.#scenes.get(name),
			position: (position) => this.#position(position),
			voice: (speaker, key) => this.#voice(speaker, key),
			missing: (declaration) => this.#missing(declaration),
			untranslated: (key) =>
				catalogs.filter(([, catalog]) => !hasMessage(catalog, key)).map(([locale]) => locale),
			emit,
		};
	}
}

/**
 * Reports whether a catalog has a message at a dotted key, nested or written flat.
 *
 * @param catalog - One locale's messages.
 * @param key - A message key such as `opening.hello`.
 * @returns `true` when the key names a string.
 */
export function hasMessage(catalog: MessageCatalog, key: string): boolean {
	if (typeof catalog[key] === "string") return true;
	let value: string | MessageCatalog | undefined = catalog;
	for (let part of key.split(".")) {
		if (typeof value !== "object") return false;
		value = value[part];
	}
	return typeof value === "string";
}

/** Reports whether a declared file has no URL to load: an empty one, or an empty locale map. */
function isEmptySource(source: AssetSource): boolean {
	return typeof source === "string" ? source === "" : Object.keys(source).length === 0;
}

/** Runs one migration step, turning a missing step, a throw or a failure into a refusal. */
function runMigration(
	step: Migration | undefined,
	game: SavedObject,
	version: number,
): Result<SavedObject, NovelError> {
	if (step === undefined) {
		return failure(
			new NovelError("migration-failed", `No migration upgrades a version ${version} save.`),
		);
	}
	let upgraded: Result<SavedObject, Error>;
	try {
		upgraded = step(structuredClone(game));
	} catch (error) {
		upgraded = failure(error instanceof Error ? error : new Error(String(error)));
	}
	if (isFailure(upgraded)) {
		return failure(
			new NovelError(
				"migration-failed",
				`The migration from version ${version} failed: ${upgraded.error.message}`,
				{ cause: upgraded.error },
			),
		);
	}
	return success(upgraded.data);
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
		persistent: { get: () => engine.persistent },
		rollback: { value: () => engine.rollback() },
		save: { value: (slot: string) => engine.save(slot) },
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
