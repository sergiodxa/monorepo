/**
 * Where a fact's value comes from when binding access: a value at once, or a
 * function, promise or loader resolved lazily by `access.load`. A loader also
 * learns which paths under its root the policy reads, so it loads only those.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

/** Brands a loader so a binding can tell one from a fact value. */
const FACT_LOADER = Symbol.for("@sdxc/authz.fact-loader");

/** An invocation context a loader may read from: a request's or a job's. */
export interface InvocationContext {
	get(key: object): unknown;
}

/** What a loader is told when its root loads. */
export interface FactRequest {
	/** The fact root it loads, like `flags`. */
	root: string;
	/** Every path under the root the whole policy reads, relative to it, like `reportsExport`. */
	paths: ReadonlySet<string>;
	/** The request or job the access was bound for, when an adapter bound it. */
	context?: InvocationContext;
}

/**
 * A fact source that needs to know what it loads, or the invocation it loads
 * for. A failure binds the root as unavailable, which fails only the
 * conditions reading it.
 *
 * @template T The fact's value.
 */
export interface FactLoader<T> {
	readonly [FACT_LOADER]: true;
	load(request: FactRequest): Result<T, Error> | Promise<Result<T, Error>>;
}

/**
 * Builds a fact loader, for an adapter that reads the policy's paths or the
 * invocation's context.
 *
 * @param load Loads the fact, answering a failure when it cannot.
 * @example factLoader(async ({ paths }) => success(await readSettings([...paths])))
 */
export function factLoader<T>(
	load: (request: FactRequest) => Result<T, Error> | Promise<Result<T, Error>>,
): FactLoader<T> {
	return { [FACT_LOADER]: true, load };
}

/** True for a loader built with `factLoader`. */
export function isFactLoader(value: unknown): value is FactLoader<unknown> {
	return typeof value === "object" && value !== null && FACT_LOADER in value;
}

/**
 * How `policy.for` takes a fact: the value, a promise of it, a function
 * returning either (a throw binds the root as unavailable), or a loader.
 */
export type FactSource<T> =
	| T
	| Promise<T>
	| ((request: FactRequest) => T | Promise<T>)
	| FactLoader<T>;
