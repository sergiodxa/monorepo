/**
 * Deterministic replay harness for the game engine boundary. It records a seed plus an ordered command sequence and replays them against a freshly built engine so an entire session can be reproduced byte-for-byte.
 *
 * The harness stays engine-agnostic on purpose: callers supply a `buildEngine(seed)` factory that owns how the seed becomes an RNG source and how the initial world is assembled, while this module only threads commands through `dispatch` and captures the resulting event stream and final snapshot. That makes it usable both as a debugging aid and as a regression guard on engine determinism.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Command } from "./commands";
import type { Engine } from "./engine";
import type { GameEvent } from "./events";

/** A serializable session: the seed used to boot the engine plus the ordered commands to replay. */
export interface Recording {
	/** Seed handed to `buildEngine` so the RNG-driven session is reproducible. */
	seed: number;
	/** Ordered engine commands dispatched one after another during replay. */
	commands: Command[];
}

/** Factory that boots a fresh engine for a given seed, owning world assembly and RNG wiring. */
export type BuildEngine = (seed: number) => Engine;

/** The observable outcome of replaying a recording: every emitted event and the final snapshot. */
export interface ReplayResult {
	/** Flat, ordered stream of every event produced across all dispatched commands. */
	events: GameEvent[];
	/** Persistent world snapshot captured after the last command was applied. */
	snapshot: ReturnType<Engine["snapshot"]>;
}

/**
 * Replays a recording against a freshly built engine, returning the collected
 * events and final snapshot. A fresh engine per call keeps replays from
 * sharing mutable state.
 */
export function replaySession(recording: Recording, buildEngine: BuildEngine): ReplayResult {
	let engine = buildEngine(recording.seed);
	let events: GameEvent[] = [];
	for (let command of recording.commands) {
		events.push(...engine.dispatch(command));
	}
	return { events, snapshot: engine.snapshot() };
}

/** Structural equality check used to compare two replay outcomes without pulling in a dependency. */
function deepEqual(left: unknown, right: unknown): boolean {
	if (Object.is(left, right)) return true;
	if (typeof left !== "object" || typeof right !== "object" || left === null || right === null) {
		return false;
	}

	if (Array.isArray(left) !== Array.isArray(right)) return false;

	if (Array.isArray(left) && Array.isArray(right)) {
		if (left.length !== right.length) return false;
		for (let index = 0; index < left.length; index += 1) {
			if (!deepEqual(left[index], right[index])) return false;
		}
		return true;
	}

	let leftRecord = left as Record<string, unknown>;
	let rightRecord = right as Record<string, unknown>;
	let leftKeys = Object.keys(leftRecord);
	let rightKeys = Object.keys(rightRecord);
	if (leftKeys.length !== rightKeys.length) return false;
	for (let key of leftKeys) {
		if (!Object.prototype.hasOwnProperty.call(rightRecord, key)) return false;
		if (!deepEqual(leftRecord[key], rightRecord[key])) return false;
	}
	return true;
}

/** Reports whether two replay outcomes are identical in both event stream and final snapshot. */
export function replaysAreEqual(left: ReplayResult, right: ReplayResult): boolean {
	return deepEqual(left.events, right.events) && deepEqual(left.snapshot, right.snapshot);
}

/**
 * Replays a recording twice and throws when the two runs diverge, guarding
 * engine determinism for callers. Returns both runs so callers can inspect
 * them further after the assertion passes.
 */
export function assertDeterministicReplay(
	recording: Recording,
	buildEngine: BuildEngine,
): [ReplayResult, ReplayResult] {
	let first = replaySession(recording, buildEngine);
	let second = replaySession(recording, buildEngine);
	if (!replaysAreEqual(first, second)) {
		throw new Error(
			`Replay diverged for seed ${recording.seed}: two runs of the same recording produced different events or snapshots.`,
		);
	}
	return [first, second];
}
