/**
 * `explore()`: plays every combination of choices from a starting point, branching from a save at
 * each menu and interaction, so a test covers the whole story. A stop already reached with the
 * same state on an equal or shorter path is skipped, which ends loops and question hubs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Seed } from "@sdxc/random";

import type { CheckProblem } from "./check.js";
import type { SceneDeclaration } from "./declarations.js";
import type { NovelErrorCode } from "./errors.js";
import type { CustomFrame, Ending, Frame, GameState, StopFrame } from "./frames.js";
import type {
	MessageCatalog,
	Novel,
	NovelInternals,
	Play,
	PlaySink,
	StartOptions,
} from "./novel.js";
import type { DeepPartial, NovelState } from "./types.js";

import { check } from "./check.js";
import { hasMessage, INTERNALS } from "./novel.js";

/** Choices and interactions one path takes before it ends. */
const DEFAULT_MAX_DEPTH = 100;

/** Paths explored before the walk stops. */
const DEFAULT_MAX_PATHS = 1000;

/** Lines and pauses one path may pass between two choices before it counts as too deep. */
const MAX_STOPS_BETWEEN_CHOICES = 10_000;

/**
 * One reply a path takes: an option on a menu, an interaction's output, or the scene a pick with
 * more than one candidate took, listed after the reply whose run reached the pick.
 */
export type ExploreStep =
	| { type: "choice"; option: string }
	| { type: "custom"; interaction: string; output: unknown }
	| { type: "pick"; scene: string };

/** A path from the starting point: replay it with `createTestPlay(novel, { seed }).follow(steps)`. */
export interface ExplorePath {
	/** The seed the play was started with. */
	seed: Seed;
	steps: ExploreStep[];
}

/** An ending, with the shortest path found to it. */
export interface ExploredEnding extends ExplorePath {
	/** The ending's key, or `null` for a story that ran out without one. */
	key: string | null;
	scene: string;
}

/** A menu that offered no option, with the shortest path found to it. */
export interface ExploredDeadEnd extends ExplorePath {
	/** The menu as `<scene>:<anchor>`. */
	menu: string;
}

/** An interaction `explore` had no outputs to try for, with the shortest path found to it. */
export interface ExploredInteraction extends ExplorePath {
	scene: string;
	interaction: string;
}

/** A stop the play could not pass: a jump with no module, refused output, an endless loop. */
export interface ExploredError extends ExplorePath {
	code: NovelErrorCode;
	message: string;
}

/**
 * The outputs to try for each interaction, from its input and the state at the stop; an
 * interaction without an entry is reported as unexplored.
 */
export type InteractionAnswers = {
	[Frame in CustomFrame as Frame["interaction"]]?: (
		input: Frame["input"],
		state: Readonly<NovelState>,
	) => readonly Parameters<Frame["complete"]>[0][];
};

/** Where exploration starts, what it answers interactions with, and how far it goes. */
export interface ExploreOptions {
	/** The scene to start in, instead of the novel's initial one. */
	scene?: SceneDeclaration;
	/** The starting state; missing fields take their schema defaults. */
	state?: DeepPartial<NovelState>;
	/** The persistent data every path starts with. */
	persistent?: unknown;
	/**
	 * The seeds to explore from, one whole walk each, so draws in callbacks take several values.
	 *
	 * @default ["explore"]
	 */
	seeds?: readonly Seed[];
	interactions?: InteractionAnswers;
	/**
	 * Choices and interactions a path takes before it stops.
	 *
	 * @default 100
	 */
	maxDepth?: number;
	/**
	 * Paths explored, across every seed, before the walk stops.
	 *
	 * @default 1000
	 */
	maxPaths?: number;
	/**
	 * The catalogs to find missing messages in, by locale.
	 *
	 * @default the novel's `messages`
	 */
	messages?: Readonly<Record<string, MessageCatalog>>;
}

/** What `explore()` found. */
export interface ExploreReport {
	/** Every ending reached, by key, with the shortest path found to it. */
	endings: ExploredEnding[];
	deadEndMenus: ExploredDeadEnd[];
	unexplored: ExploredInteraction[];
	errors: ExploredError[];
	/** Declared scenes no explored path entered. */
	unreachableScenes: string[];
	/** Message keys a shown frame used that a catalog lacks, by locale. */
	missingMessages: Record<string, string[]>;
	/** Asset ids, and characters as `cast.<id>`, that scenes use and the novel does not declare. */
	missingAssets: string[];
	/** Which caps stopped the walk; a capped report may miss endings. */
	capped: { paths: boolean; depth: boolean };
	/** How many paths ended: at an ending, an error or an unexplored interaction. */
	paths: number;
	/** What `check()` reports for the same novel. */
	problems: CheckProblem[];
}

/** The walk's running state. */
interface Walk {
	internals: NovelInternals;
	options: ExploreOptions;
	catalogs: [string, MessageCatalog][];
	maxDepth: number;
	maxPaths: number;
	visited: Map<string, number>;
	report: ExploreReport;
	scenes: Set<string>;
	missingMessages: Map<string, Set<string>>;
	missingAssets: Set<string>;
}

/**
 * Explores a novel: every enabled option of every menu, every output `interactions` answers for
 * each interaction, every candidate a pick can take, from each seed, until every path ends or a cap is hit. Every reported path
 * replays exactly in `createTestPlay`.
 *
 * @param novel - The novel, with its scenes mapped.
 * @param options - The starting point, interaction outputs, seeds, caps and catalogs.
 * @returns The endings with their shortest paths, and every problem met on the way.
 * @example let report = await explore(novel, { interactions: { fishing: () => [{ caught: 0 }, { caught: 5 }] } });
 */
export async function explore(novel: Novel, options: ExploreOptions = {}): Promise<ExploreReport> {
	let internals = novel[INTERNALS]();
	let { problems } = await check(novel);
	let walk: Walk = {
		internals,
		options,
		catalogs: Object.entries(options.messages ?? internals.options.messages ?? {}),
		maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
		maxPaths: options.maxPaths ?? DEFAULT_MAX_PATHS,
		visited: new Map(),
		report: emptyReport(problems),
		scenes: new Set(),
		missingMessages: new Map(),
		missingAssets: new Set(
			problems.flatMap((problem) => (problem.code === "missing-asset" ? [problem.asset] : [])),
		),
	};
	for (let seed of options.seeds ?? ["explore"]) {
		if (walk.report.paths >= walk.maxPaths) {
			walk.report.capped.paths = true;
			break;
		}
		walk.visited = new Map();
		let start: StartOptions = { seed, persistent: options.persistent };
		if (options.scene !== undefined) start.scene = options.scene;
		if (options.state !== undefined) start.state = options.state;
		await follow(walk, { start, run: (play) => play.next() }, { seed, steps: [] }, []);
	}
	return finish(walk);
}

/** A report with nothing found yet. */
function emptyReport(problems: CheckProblem[]): ExploreReport {
	return {
		endings: [],
		deadEndMenus: [],
		unexplored: [],
		errors: [],
		unreachableScenes: [],
		missingMessages: {},
		missingAssets: [],
		capped: { paths: false, depth: false },
		paths: 0,
		problems,
	};
}

/** The picks one play settled, and the scenes it is told to take at its next picks. */
interface Picker {
	/** Scenes to take, in order, at the next picks with more than one candidate. */
	forced: string[];
	/** The picks settled since the path last read them. */
	made: { candidates: readonly string[]; scene: string; forced: boolean }[];
}

/**
 * How a path's next run starts: the options a fresh play starts from, and the call that runs it
 * to its next stop. Starting it again with other picks forced is how a pick branches.
 */
interface Origin {
	start: StartOptions;
	/** Runs the fresh play; `null` when it no longer reaches the stop the run answered. */
	run(play: Play): Promise<IteratorResult<Frame, Ending> | null>;
}

/**
 * Routes a play's events into the report, attributing them to the path the play is on, and
 * settles its picks: a forced scene first, the drawn one otherwise.
 */
function sink(walk: Walk, path: ExplorePath, picker: Picker): PlaySink {
	return {
		quiet: true,
		pick(candidates, drawn) {
			let forced = picker.forced.shift();
			let scene = forced ?? drawn;
			picker.made.push({ candidates, scene, forced: forced !== undefined });
			return scene;
		},
		emit(name, payload) {
			if (name === "scene") enter(walk, (payload as { scene: string }).scene);
			if (name === "notify") translated(walk, [(payload as { key: string }).key]);
			if (name !== "error") return;
			let error = payload as { code: NovelErrorCode; subject?: string };
			if (error.code === "missing-asset" && error.subject !== undefined) {
				walk.missingAssets.add(error.subject);
			}
			if (error.code === "dead-end-menu" && error.subject !== undefined) {
				shortest(walk.report.deadEndMenus, (entry) => entry.menu === error.subject, {
					...copy(path),
					menu: error.subject,
				});
			}
		},
	};
}

/** Records a scene a path entered, and checks its title, chapter and arc titles against the catalogs. */
function enter(walk: Walk, scene: string): void {
	walk.scenes.add(scene);
	let declaration = walk.internals.scenes.get(scene);
	translated(walk, [
		declaration?.title,
		declaration?.chapter?.title,
		declaration?.chapter?.arc?.title,
	]);
}

/**
 * Starts a play from `origin` with `forced` picks and plays it until the path ends or branches.
 * At a menu or an interaction the play is saved, and each option or output continues in a play
 * resumed from that save; every candidate a run's picks did not take continues in a play started
 * again from the run's origin with that candidate forced.
 */
async function follow(
	walk: Walk,
	origin: Origin,
	path: ExplorePath,
	forced: readonly string[],
): Promise<void> {
	let picker: Picker = { forced: [...forced], made: [] };
	let started = walk.internals.start(origin.start, sink(walk, path, picker));
	if (started.status === "failure") {
		let { error } = started;
		end(walk, () => fail(walk, path, error.code, error.message));
		return;
	}
	let play = started.data;
	let forks: Fork[] = [];
	let step = await origin.run(play);
	if (step === null) return;
	forks.push(...picked(origin, path, picker));
	let stops = 0;
	while (!step.done) {
		let frame: Frame = step.value;
		if (frame.type === "error") {
			let { error } = frame;
			end(walk, () => fail(walk, path, error.code, error.message));
			break;
		}
		translated(walk, frameKeys(frame));
		if (frame.type === "line" || frame.type === "pause") {
			stops += 1;
			if (stops > MAX_STOPS_BETWEEN_CHOICES) {
				walk.report.capped.depth = true;
				break;
			}
			let advanced = advancing(play, frame);
			step = await play.next(frame.advance());
			forks.push(...picked(advanced, path, picker));
			continue;
		}
		await branch(walk, play, frame, path);
		break;
	}
	if (step.done) {
		let ending = step.value;
		end(walk, () =>
			shortest(
				walk.report.endings,
				(entry) => entry.key === ending.key && entry.scene === ending.scene,
				{ ...copy(path), key: ending.key, scene: ending.scene },
			),
		);
	}
	for (let fork of forks) {
		if (walk.report.paths >= walk.maxPaths) {
			walk.report.capped.paths = true;
			return;
		}
		await follow(walk, fork.origin, fork.path, fork.forced);
	}
}

/** A candidate a run's pick did not take, to follow from the run's origin. */
interface Fork {
	origin: Origin;
	path: ExplorePath;
	forced: string[];
}

/**
 * Reads the picks the last run settled: appends each to the path as a step, and answers a fork
 * for every candidate an unforced pick left, forcing the picks before it as they were taken; the
 * fork's own run records its picks.
 */
function picked(origin: Origin, path: ExplorePath, picker: Picker): Fork[] {
	let made = picker.made;
	picker.made = [];
	let before = [...path.steps];
	let forks: Fork[] = [];
	for (let [index, pick] of made.entries()) {
		if (pick.forced) continue;
		let taken = made.slice(0, index).map((entry) => entry.scene);
		for (let scene of pick.candidates) {
			if (scene === pick.scene) continue;
			forks.push({
				origin,
				path: { seed: path.seed, steps: [...before] },
				forced: [...taken, scene],
			});
		}
	}
	path.steps.push(...made.map((entry) => pickStep(entry.scene)));
	return forks;
}

/** The step a path records for a settled pick. */
function pickStep(scene: string): ExploreStep {
	return { type: "pick", scene };
}

/** The origin of the run that advancing `frame` starts: a play resumed at it, then advanced. */
function advancing(play: Play, frame: Extract<StopFrame, { type: "line" | "pause" }>): Origin {
	return {
		start: { from: play.state, persistent: play.persistent },
		async run(resumed) {
			let first = await resumed.next();
			if (first.done || first.value.type !== frame.type) return null;
			return resumed.next((first.value as typeof frame).advance());
		},
	};
}

/** Tries every enabled option of a menu, or every output for an interaction, from a save. */
async function branch(
	walk: Walk,
	play: Play,
	frame: Exclude<StopFrame, { type: "line" | "pause" }>,
	path: ExplorePath,
): Promise<void> {
	if (path.steps.length >= walk.maxDepth) {
		walk.report.capped.depth = true;
		return;
	}
	let game = play.state;
	let key = visitKey(game);
	let depth = walk.visited.get(key);
	if (depth !== undefined && depth <= path.steps.length) return;
	walk.visited.set(key, path.steps.length);
	let steps = choices(walk, frame, game);
	if (steps.length === 0) {
		let interaction = frame.type === "custom" ? frame.interaction : "";
		end(walk, () =>
			shortest(
				walk.report.unexplored,
				(entry) => entry.scene === frame.scene && entry.interaction === interaction,
				{ ...copy(path), scene: frame.scene, interaction },
			),
		);
		return;
	}
	let persistent = play.persistent;
	for (let step of steps) {
		if (walk.report.paths >= walk.maxPaths) {
			walk.report.capped.paths = true;
			return;
		}
		let next: ExplorePath = { seed: path.seed, steps: [...path.steps, step] };
		await follow(walk, answering({ from: game, persistent }, frame, step), next, []);
	}
}

/** The origin of the run that answering `frame` with `step` starts, from a save at the frame. */
function answering(
	start: StartOptions,
	frame: Exclude<StopFrame, { type: "line" | "pause" }>,
	step: ExploreStep,
): Origin {
	return {
		start,
		async run(resumed) {
			let first = await resumed.next();
			if (first.done || first.value.type !== frame.type) return null;
			let stop = first.value;
			let reply =
				stop.type === "choice" && step.type === "choice"
					? stop.choose(step.option)
					: (stop as CustomFrame).complete((step as { output: unknown }).output as never);
			return resumed.next(reply);
		},
	};
}

/** The steps a branching stop offers: its enabled options, or the outputs to try. */
function choices(
	walk: Walk,
	frame: Exclude<StopFrame, { type: "line" | "pause" }>,
	game: GameState,
): ExploreStep[] {
	if (frame.type === "choice") {
		return frame.options
			.filter((option) => !option.disabled)
			.map((option) => ({ type: "choice", option: option.id }));
	}
	let answers = walk.options.interactions as
		| Record<string, ((input: unknown, state: NovelState) => readonly unknown[]) | undefined>
		| undefined;
	let outputs = answers?.[frame.interaction]?.(frame.input, game.state) ?? [];
	return outputs.map((output) => ({
		type: "custom",
		interaction: frame.interaction,
		output: structuredClone(output),
	}));
}

/** Identifies a stop with the state that decides what follows it. */
function visitKey(game: GameState): string {
	return JSON.stringify([
		game.position,
		game.stack,
		game.state,
		game.taken,
		game.introduced,
		game.random,
	]);
}

/** Records a finished path and counts it toward `maxPaths`. */
function end(walk: Walk, record: () => void): void {
	record();
	walk.report.paths += 1;
}

/** Records a stop the path could not pass, keeping the shortest path per error. */
function fail(walk: Walk, path: ExplorePath, code: NovelErrorCode, message: string): void {
	shortest(walk.report.errors, (entry) => entry.code === code && entry.message === message, {
		...copy(path),
		code,
		message,
	});
}

/** Keeps `entry` in `list`, replacing a matching entry only when its path is longer. */
function shortest<Entry extends ExplorePath>(
	list: Entry[],
	matches: (entry: Entry) => boolean,
	entry: Entry,
): void {
	let index = list.findIndex(matches);
	if (index === -1) list.push(entry);
	else if ((list[index] as Entry).steps.length > entry.steps.length) list[index] = entry;
}

/** A path as a report keeps it, apart from the walk that keeps extending its own. */
function copy(path: ExplorePath): ExplorePath {
	return { seed: path.seed, steps: [...path.steps] };
}

/** The message keys a frame shows: its line, speakers, prompt, options, reasons and captions. */
function frameKeys(frame: StopFrame): (string | undefined)[] {
	let captions = frame.audio.sounds.map((sound) => sound.caption);
	if (frame.type === "line") {
		return [frame.key, ...frame.speakers.map((speaker) => speaker.name), ...captions];
	}
	if (frame.type === "choice") {
		return [
			frame.prompt,
			...frame.options.flatMap((option) => [option.label, option.reason]),
			...captions,
		];
	}
	return captions;
}

/** Records every key a catalog lacks, by locale. */
function translated(walk: Walk, keys: readonly (string | undefined)[]): void {
	for (let key of keys) {
		if (key === undefined) continue;
		for (let [locale, catalog] of walk.catalogs) {
			if (hasMessage(catalog, key)) continue;
			let missing = walk.missingMessages.get(locale) ?? new Set();
			missing.add(key);
			walk.missingMessages.set(locale, missing);
		}
	}
}

/** Completes the report from what the walk collected. */
function finish(walk: Walk): ExploreReport {
	let report = walk.report;
	report.unreachableScenes = [...walk.internals.scenes.keys()].filter(
		(scene) => !walk.scenes.has(scene),
	);
	for (let [locale, keys] of walk.missingMessages) {
		report.missingMessages[locale] = [...keys].sort();
	}
	report.missingAssets = [...walk.missingAssets].sort();
	return report;
}
