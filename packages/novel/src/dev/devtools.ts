/**
 * `createDevTools()`: the developer tools' connection to a novel. It follows the play through the
 * novel's events, keeps an event log, and starts edited plays (a jump with edited state, a scene
 * reloaded by hot module replacement, persistent data reset) through a callback the app's player
 * answers, so the tools need nothing from the player beyond its `start` options.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { CheckReport } from "../check.js";
import type { SceneModule } from "../directives.js";
import type { NovelEventName, NovelEvents } from "../events.js";
import type { GameState } from "../frames.js";
import type { Novel, NovelInternals, Play, StartOptions } from "../novel.js";
import type { Persistent } from "../persistent.js";
import type { DeepPartial, NovelState } from "../types.js";

import { check } from "../check.js";
import { isSceneDeclaration } from "../declarations.js";
import { NovelError } from "../errors.js";
import { INTERNALS } from "../novel.js";

import type { MissingMessage, SceneGraph } from "./graph.js";

import { missingMessages, readGraph } from "./graph.js";

/** Every event the tools log, in the order the novel declares them. */
const EVENT_NAMES: readonly NovelEventName[] = [
	"scene",
	"line",
	"choice",
	"ending",
	"unlock",
	"chapter",
	"save",
	"persist",
	"error",
];

/** Events kept in the log unless the app sets its own limit. */
const DEFAULT_LIMIT = 200;

/** One logged event. */
export type DevEvent = {
	[Name in NovelEventName]: {
		/** Counts up from 1 across the tools' lifetime, so a list keys rows by it. */
		id: number;
		type: Name;
		payload: NovelEvents[Name];
		/** `Date.now()` when the event fired. */
		at: number;
	};
}[NovelEventName];

/** How the tools connect to the app. */
export interface DevToolsOptions {
	/**
	 * Starts a new play in the app's player from these options, which replaces the running one:
	 * the app passes them as the player's `start` and remounts it. `persistent` is set whenever the
	 * tools have seen a play; otherwise the app keeps its stored data.
	 */
	restart: (options: StartOptions) => void;
	/**
	 * How many events the log keeps, dropping the oldest.
	 *
	 * @default 200
	 */
	limit?: number;
}

/** What a reload replaced, and whether the running play was restarted on its line. */
export interface ReloadResult {
	scenes: string[];
	/** True when the running play stood in, or was called from, a replaced scene. */
	restarted: boolean;
}

/** What {@link DevTools.reset} clears from persistent data. */
export interface ResetOptions {
	/** Lines read, which skip-read-text and the Memories screen use. */
	seen?: boolean;
	/** Options taken before, which menus mark. */
	chosen?: boolean;
	/** Gallery images and music room tracks. */
	unlocked?: boolean;
	endings?: boolean;
	chapters?: boolean;
}

/** Every problem the tools find without playing: `check()`'s report and missing messages. */
export interface DevProblems {
	check: CheckReport;
	messages: MissingMessage[];
}

/**
 * The developer tools' view of a novel and the play the app runs. It listens to every event of
 * the novel until {@link DevTools.dispose}, and the play it follows is the last one an event
 * fired for, or one handed to {@link DevTools.attach}.
 */
export class DevTools {
	/** The novel the tools are connected to. */
	readonly novel: Novel;
	#options: DevToolsOptions;
	#internals: NovelInternals;
	#play: Play | undefined;
	#events: DevEvent[] = [];
	#count = 0;
	#subscribers = new Set<() => void>();
	#unsubscribe: (() => void)[];

	/**
	 * Connects to a novel; {@link createDevTools} is the usual way to call it.
	 *
	 * @param novel - The novel, with its scenes mapped.
	 * @param options - How the tools start plays in the app's player.
	 */
	constructor(novel: Novel, options: DevToolsOptions) {
		this.novel = novel;
		this.#options = options;
		this.#internals = novel[INTERNALS]();
		this.#unsubscribe = EVENT_NAMES.map((name) =>
			novel.on(name, (payload, play) => this.#log(name, payload, play)),
		);
	}

	/** The play the tools follow, or `undefined` before any play fired an event. */
	get play(): Play | undefined {
		return this.#play;
	}

	/** The followed play as JSON at its current stop. */
	get state(): GameState | undefined {
		return this.#play?.state;
	}

	/** The followed play's persistent data. */
	get persistent(): Persistent | undefined {
		return this.#play?.persistent;
	}

	/** The logged events, oldest first. */
	get events(): readonly DevEvent[] {
		return this.#events;
	}

	/** The names of the mapped scenes, in mapping order, which a jump can start in. */
	get scenes(): readonly string[] {
		return this.#internals.mapped;
	}

	/**
	 * Follows a play the app holds, such as one resumed at a menu, which fires no event until the
	 * reader chooses.
	 *
	 * @param play - The play.
	 */
	attach(play: Play): void {
		this.#play = play;
		this.#notify();
	}

	/**
	 * Calls `listener` whenever the log, the followed play or its state may have changed.
	 *
	 * @param listener - Called with no arguments, typically to render again.
	 * @returns A function that removes the listener.
	 */
	subscribe(listener: () => void): () => void {
		this.#subscribers.add(listener);
		return () => this.#subscribers.delete(listener);
	}

	/** Empties the event log. */
	clear(): void {
		this.#events = [];
		this.#notify();
	}

	/**
	 * Starts a play at the top of `scene` with `state`, after checking it against the novel's
	 * state schema and its extensions' slices, keeping the followed play's persistent data.
	 *
	 * @param scene - A mapped scene's name.
	 * @param state - The story state, as parsed from the editor; missing fields take their defaults.
	 * @returns The options handed to `restart`, or an `unmapped-scene` or `invalid-state` error.
	 * @example devtools.jump("spring.cafe.meeting", { affection: { mika: 40 } });
	 */
	jump(scene: string, state: unknown): Result<StartOptions, NovelError> {
		let declaration = this.#internals.scenes.get(scene);
		if (declaration === undefined || !this.#internals.mapped.includes(scene)) {
			return failure(
				new NovelError("unmapped-scene", `Scene "${scene}" has no module.`, { subject: scene }),
			);
		}
		let parsed = this.#internals.state(state);
		if (parsed.status === "failure") {
			return failure(
				new NovelError("invalid-state", `The state is invalid: ${parsed.error.message}`),
			);
		}
		return success(
			this.#restart({ scene: declaration, state: parsed.data as DeepPartial<NovelState> }),
		);
	}

	/**
	 * Replaces scenes with their edited modules, as hot module replacement hands them over, and
	 * restarts the followed play from its own save when it stands in a replaced scene, so it
	 * resumes on the same line (or at the scene's start when that line was removed).
	 *
	 * @param modules - Each edited module's namespace (`{ default }`), or what `createScene()`
	 * returned; `undefined` entries, which Vite passes for a module that failed, are skipped.
	 * @returns The replaced scenes, or a `load-failed` error naming an entry that is no scene module.
	 * @example import.meta.hot?.accept(["./scenes/opening.ts"], (modules) => devtools.reload(modules));
	 */
	reload(modules: readonly unknown[]): Result<ReloadResult, NovelError> {
		let scenes: SceneModule[] = [];
		for (let entry of modules) {
			if (entry === undefined) continue;
			let module = sceneModuleOf(entry);
			if (module === undefined) {
				return failure(new NovelError("load-failed", "A reloaded module is not a scene module."));
			}
			scenes.push(module);
		}
		let saved = this.#play?.state;
		for (let module of scenes) this.#internals.replace(module.scene.name, module);
		let names = scenes.map((module) => module.scene.name);
		let standing =
			saved !== undefined &&
			[saved.position, ...saved.stack].some((entry) => names.includes(entry.scene));
		if (standing) this.#restart({ from: saved });
		else this.#notify();
		return success({ scenes: names, restarted: standing });
	}

	/**
	 * Clears parts of persistent data and restarts the followed play from its own save with what
	 * is left, so the next `persist` stores the cleared record.
	 *
	 * @param options - What to clear; everything when empty.
	 * @returns The options handed to `restart`, or an `invalid-state` error before any play.
	 * @example devtools.reset({ seen: true, unlocked: true });
	 */
	reset(options: ResetOptions = {}): Result<StartOptions, NovelError> {
		let play = this.#play;
		if (play === undefined) {
			return failure(new NovelError("invalid-state", "No play is running to reset."));
		}
		let all = Object.values(options).every((value) => value !== true);
		let persistent = structuredClone(play.persistent);
		if (all || options.seen === true) persistent.seen = {};
		if (all || options.chosen === true) persistent.chosen = [];
		if (all || options.unlocked === true) persistent.unlocked = { images: [], music: [] };
		if (all || options.endings === true) persistent.endings = [];
		if (all || options.chapters === true) persistent.chapters = [];
		return success(this.#restart({ from: play.state, persistent }));
	}

	/**
	 * Runs `check()` and lists the message keys the novel's catalogs lack.
	 *
	 * @returns Both reports; loading them imports every lazy scene.
	 */
	async problems(): Promise<DevProblems> {
		let [report, messages] = await Promise.all([
			check(this.novel),
			missingMessages(this.#internals),
		]);
		return { check: report, messages };
	}

	/**
	 * Reads the scene graph for the flowchart.
	 *
	 * @returns Every declared scene and the jumps between them; every lazy scene is imported.
	 */
	graph(): Promise<SceneGraph> {
		return readGraph(this.#internals);
	}

	/** Stops listening to the novel and forgets every subscriber. */
	dispose(): void {
		for (let unsubscribe of this.#unsubscribe) unsubscribe();
		this.#subscribers.clear();
	}

	/**
	 * Hands options to the app's player, carrying the followed play's persistent data, and stops
	 * following the replaced play until the new one fires its first event.
	 */
	#restart(options: StartOptions): StartOptions {
		let persistent = options.persistent ?? this.#play?.persistent;
		let start = persistent === undefined ? options : { ...options, persistent };
		this.#play = undefined;
		this.#options.restart(start);
		this.#notify();
		return start;
	}

	/** Records an event and follows the play it fired for. */
	#log<Name extends NovelEventName>(name: Name, payload: NovelEvents[Name], play: Play): void {
		this.#play = play;
		this.#count += 1;
		this.#events.push({ id: this.#count, type: name, payload, at: Date.now() } as DevEvent);
		let limit = this.#options.limit ?? DEFAULT_LIMIT;
		if (this.#events.length > limit) this.#events.splice(0, this.#events.length - limit);
		this.#notify();
	}

	/** Tells every subscriber something changed. */
	#notify(): void {
		for (let subscriber of this.#subscribers) subscriber();
	}
}

/**
 * Reads a scene module from a module namespace or from the module itself.
 *
 * @param entry - What hot module replacement handed over.
 * @returns The scene module, or `undefined` for anything else.
 */
function sceneModuleOf(entry: unknown): SceneModule | undefined {
	if (typeof entry !== "object" || entry === null) return undefined;
	let candidate = "default" in entry ? (entry as { default: unknown }).default : entry;
	if (typeof candidate !== "object" || candidate === null) return undefined;
	let module = candidate as Partial<SceneModule>;
	return isSceneDeclaration(module.scene) && Array.isArray(module.directives)
		? (module as SceneModule)
		: undefined;
}

/**
 * Connects developer tools to a novel. Create it once next to the novel in development only, and
 * pass it to `NovelDevTools` and to the hot module replacement handler.
 *
 * @param novel - The novel, with its scenes mapped.
 * @param options - How the tools start plays in the app's player.
 * @returns The connection.
 * @example let devtools = createDevTools(novel, { restart: (start) => player.restart(start) });
 */
export function createDevTools(novel: Novel, options: DevToolsOptions): DevTools {
	return new DevTools(novel, options);
}
