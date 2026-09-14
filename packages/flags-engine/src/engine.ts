/**
 * The half of evaluation that holds state: an object that reads a store, parses
 * the set once, and resolves every later flag against the snapshot it kept. It
 * is what a worker holds for the life of an isolate.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@sdxc/duration";
import type { EvaluationContext, FlagValue, MaybePromise, ResolutionDetails } from "@sdxc/flags";
import type { Result } from "@sdxc/result";

import { toMs } from "@sdxc/duration";
import { isFailure, success } from "@sdxc/result";

import type { FlagParseFailure, FlagSnapshot } from "./snapshot.js";
import type { FlagStore, FlagStoreError, StoredFlagSet } from "./store/index.js";

import { evaluate as resolve, evaluateAll as resolveAll } from "./evaluate.js";
import { parseFlagSet } from "./parse.js";

/** What an engine is built from. */
export interface EngineOptions {
	/** Where definitions are read from, and the whole of what the engine knows about storage. */
	store: FlagStore;
	/**
	 * How long a loaded snapshot counts as current, which is what `stale` is
	 * measured against. Omitted, a snapshot stays current until a caller loads
	 * another one.
	 */
	maxAge?: DurationInput;
}

/**
 * Holds one definition set and resolves flags against it. A caller decides when
 * the definitions are read again — on a request, inside `waitUntil`, or from a
 * cron trigger — and `stale` is what that decision is made on.
 */
export interface Engine {
	/** The set being evaluated against, present once a load has succeeded. */
	readonly snapshot: FlagSnapshot | undefined;

	/**
	 * The definitions the held set carried and the engine refused, so a caller
	 * logs them once after a load instead of once per evaluation of the key.
	 */
	readonly failures: readonly FlagParseFailure[];

	/**
	 * Whether what the engine holds has aged past `maxAge`. It reads `true` until
	 * a load has succeeded, so a fresh engine reads as one that wants a load.
	 */
	readonly stale: boolean;

	/**
	 * Reads the store and parses the set once, keeping the snapshot for every
	 * evaluation that follows. A store that reads synchronously loads
	 * synchronously, and the answer is `await`-able either way.
	 *
	 * @returns The snapshot now held, or the reason the store could not hand its
	 * set over — a configuration failure a caller reports.
	 */
	load(): MaybePromise<Result<FlagSnapshot, FlagStoreError>>;

	/**
	 * Resolves one flag against the held snapshot, answering with the caller's own
	 * default and `PROVIDER_NOT_READY` until a load has succeeded.
	 *
	 * @param key The flag to resolve.
	 * @param defaultValue What the caller uses when nothing resolves, and the type
	 * every variant is checked against.
	 * @param context The merged context targeting reads.
	 */
	evaluate<T extends FlagValue>(
		key: string,
		defaultValue: T,
		context?: EvaluationContext,
	): ResolutionDetails<T>;

	/**
	 * Resolves every flag the held snapshot carries, for a caller with no per-flag
	 * default to fall back on. An engine before its first load answers with an
	 * empty record, which is every flag it knows of.
	 *
	 * @param context The merged context targeting reads.
	 */
	evaluateAll(context?: EvaluationContext): Record<string, ResolutionDetails<FlagValue>>;
}

/**
 * Builds an engine over a store, holding no definitions until `load` succeeds.
 *
 * @param options The store to read from, and how long a snapshot counts as current.
 * @returns An engine a caller loads, evaluates through, and reloads on its own schedule.
 *
 * @example
 * let engine = createEngine({ store: new InMemoryFlagStore(set), maxAge: "5 minutes" });
 */
export function createEngine({ store, maxAge }: EngineOptions): Engine {
	let held: FlagSnapshot | undefined;
	let lifetime = maxAge === undefined ? Number.POSITIVE_INFINITY : toMs(maxAge);

	/**
	 * Parses what a successful read handed over and keeps it, which is what makes
	 * parsing a cost per load while evaluation walks a structure already known to
	 * be well formed.
	 */
	function keep(read: Result<StoredFlagSet, FlagStoreError>): Result<FlagSnapshot, FlagStoreError> {
		if (isFailure(read)) return read;

		held = parseFlagSet(read.data);

		return success(held);
	}

	return {
		get snapshot() {
			return held;
		},

		get failures() {
			return held === undefined ? [] : [...held.failures.values()];
		},

		get stale() {
			return held === undefined || Date.now() - held.createdAt >= lifetime;
		},

		load() {
			let read = store.read();

			if (read instanceof Promise) return read.then(keep);

			return keep(read);
		},

		evaluate<T extends FlagValue>(key: string, defaultValue: T, context?: EvaluationContext) {
			if (held === undefined) return notReady(defaultValue);

			return resolve(held, key, defaultValue, context);
		},

		evaluateAll(context?: EvaluationContext) {
			if (held === undefined) return {};

			return resolveAll(held, context);
		},
	};
}

/**
 * What an evaluation gets while the engine holds no snapshot: the caller's own
 * default, under the code the specification reserves for a resolution asked for
 * before the flags arrived.
 */
function notReady<T extends FlagValue>(defaultValue: T): ResolutionDetails<T> {
	return {
		value: defaultValue,
		reason: "ERROR",
		errorCode: "PROVIDER_NOT_READY",
		errorMessage: "The engine holds no definitions until a load succeeds",
	};
}
