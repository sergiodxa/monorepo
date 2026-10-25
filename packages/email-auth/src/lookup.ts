/**
 * The DNS reads every policy here is discovered through: TXT strings at a name, with a
 * missing name and an empty answer folded into "nothing published" and every other DNS
 * failure kept as the `DoHError` that explains it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DoH, DoHError } from "@sdxc/doh";
import type { Result } from "@sdxc/result";

import { NameNotFoundError, resolve } from "@sdxc/doh";
import { isFailure, success } from "@sdxc/result";

/** How every lookup in this package reaches DNS; each option is passed to `@sdxc/doh`. */
export interface LookupOptions {
	/** @default CLOUDFLARE */
	resolver?: DoH.Resolver;
	signal?: AbortSignal;
	/**
	 * Milliseconds each query may take.
	 *
	 * @default 5000
	 */
	timeoutMs?: number;
}

/** What one query found: the records, or `exists: false` when the name is NXDOMAIN. */
export interface LookupAnswer<Type extends DoH.RecordType> {
	records: DoH.RecordFor<Type>[];
	/** `false` for NXDOMAIN; a name with no records of the type still exists. */
	exists: boolean;
}

/**
 * Resolves `name`'s records of `type`, reading NXDOMAIN as an empty answer at a name that
 * does not exist, so a policy that was never published is a value and only a resolver
 * that could not answer is a failure.
 *
 * @param name - The name to query.
 * @param type - The record type.
 * @param options - Resolver, signal and timeout.
 * @returns The records, or the DNS failure that left the answer unknown.
 * @template Type - The record type, which types the records returned.
 */
export async function lookup<Type extends DoH.RecordType>(
	name: string,
	type: Type,
	options: LookupOptions = {},
): Promise<Result<LookupAnswer<Type>, DoHError>> {
	let answer = await resolve(name, type, dohOptions(options));
	if (isFailure(answer)) {
		if (answer.error instanceof NameNotFoundError) return success({ records: [], exists: false });
		return answer;
	}
	return success({ records: answer.data.records, exists: true });
}

/**
 * The TXT records at `name`, each as the concatenation of its character-strings, which is
 * how DMARC, SPF, MTA-STS, TLS-RPT and DKIM all read a record split across strings.
 *
 * @param name - The name to query.
 * @param options - Resolver, signal and timeout.
 * @returns The record texts, empty when nothing is published.
 */
export async function lookupTxt(
	name: string,
	options: LookupOptions = {},
): Promise<Result<string[], DoHError>> {
	let answer = await lookup(name, "TXT", options);
	if (isFailure(answer)) return answer;
	return success(answer.data.records.map((record) => record.text));
}

/** The options `resolve` takes, with only the keys the caller set. */
function dohOptions(options: LookupOptions): DoH.ResolveOptions {
	let resolved: DoH.ResolveOptions = {};
	if (options.resolver) resolved.resolver = options.resolver;
	if (options.signal) resolved.signal = options.signal;
	if (options.timeoutMs !== undefined) resolved.timeoutMs = options.timeoutMs;
	return resolved;
}

/**
 * Lowercases a domain and drops one trailing dot, the form every name in this package is
 * compared and reported in.
 */
export function normalizeDomain(domain: string): string {
	let lower = domain.trim().toLowerCase();
	return lower.endsWith(".") ? lower.slice(0, -1) : lower;
}
