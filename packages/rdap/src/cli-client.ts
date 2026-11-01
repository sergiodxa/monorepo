/**
 * What both `sdxc-rdap` commands share: one client per run over a memory cache, and the way a
 * failed lookup ends the run, so `lookup` and `expires` report a registry's refusal alike.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ExitError, UsageError } from "@sdxc/cli";
import type { Failure } from "@sdxc/result";

import { MemoryCache } from "@sdxc/cache/memory";
import { exit, usage } from "@sdxc/cli";

import type { RDAPError } from "./error.js";

import { RDAP } from "./rdap.js";

/** The request flags every command takes. */
interface ClientFlags {
	userAgent: string;
	timeout: number;
}

/**
 * A client for one run; the bootstrap file is fetched once per run and lives only in memory.
 *
 * @param flags - The parsed `--user-agent` and `--timeout`
 */
export function client(flags: ClientFlags): RDAP {
	return new RDAP({ cache: new MemoryCache(), userAgent: flags.userAgent, timeout: flags.timeout });
}

/**
 * Ends a run whose lookup failed: a name that is no domain is a usage error (exit 2), and any
 * other code exits 1 with the registry's reason, written to stdout as `{ error }` under `--json`.
 *
 * @param error - Why the lookup produced no domain
 * @param json - Whether the run prints JSON
 * @param stdout - Where the JSON report goes
 */
export function lookupFailed(
	error: RDAPError,
	json: boolean,
	stdout: (text: string) => void,
): Failure<UsageError | ExitError> {
	if (error.code === "invalid-domain") return usage(error.message);
	if (json) {
		let report = { code: error.code, message: error.message, retryable: error.retryable };
		stdout(`${JSON.stringify({ error: report }, null, 2)}\n`);
	}
	let retry = error.retryable ? " (retryable)" : "";
	return exit(1, `${error.code}: ${error.message}${retry}`);
}

/**
 * An epoch-millisecond date as the calendar day it falls on, in UTC.
 *
 * @param ms - Epoch milliseconds, or `null` when the registry published none
 */
export function day(ms: number | null): string {
	return ms === null ? "not published" : new Date(ms).toISOString().slice(0, 10);
}
