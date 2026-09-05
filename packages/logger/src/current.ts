/**
 * The log bound to the running invocation, kept in `AsyncLocalStorage` so whatever runs
 * inside the invocation — a service, a package, a job — can enrich the record without
 * being handed it. Outside an invocation there is no current log.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { AsyncLocalStorage } from "node:async_hooks";

import type { Log } from "./log.js";

const STORAGE = new AsyncLocalStorage<Log>();

/**
 * The log of the invocation this call runs inside, or `undefined` outside one, so an
 * enrichment call site is written `currentLog()?.inc("cache.miss")` and costs nothing
 * where no log is open.
 *
 * @example currentLog()?.set({ team: { id: team.id } });
 */
export function currentLog(): Log | undefined {
	return STORAGE.getStore();
}

/**
 * Runs `fn` with `log` as the current log, restoring whatever was current before once it
 * returns. Nested binding is what gives each job in a batch its own log while the batch's
 * stays current around them.
 *
 * @param log The log to make current.
 * @param fn The work that reads it through {@link currentLog}.
 */
export function bindLog<T>(log: Log, fn: () => T): T {
	return STORAGE.run(log, fn);
}
