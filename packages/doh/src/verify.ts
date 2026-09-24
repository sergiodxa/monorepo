/**
 * The two DNS checks a domain-ownership flow performs: a TXT token published at a name,
 * and a CNAME pointing a name at a target. A name that does not exist yet is the ordinary
 * state of a verification in progress, so NXDOMAIN reads as "not verified".
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { DoHError } from "./errors.js";
import type { DoH } from "./types.js";

import { NameNotFoundError } from "./errors.js";
import { resolve } from "./resolve.js";

/** How many aliases `checkCname` follows before giving up, bounding a long or looping chain. */
const MAX_CNAME_HOPS = 8;

/** Folds a name for comparison: lowercased, trailing dot dropped. */
function normalizeName(name: string): string {
	let lower = name.trim().toLowerCase();
	return lower.length > 1 && lower.endsWith(".") ? lower.slice(0, -1) : lower;
}

/**
 * Whether `name` publishes a TXT record whose joined text is exactly `expected`, so a
 * token a resolver splits into several character-strings, or escapes, still matches.
 * NXDOMAIN is `success(false)`; every other lookup failure stays a failure.
 *
 * @param name - The name holding the token, such as `_verify.example.com`.
 * @param expected - The token, compared exactly.
 * @param options - Passed to `resolve`.
 * @example await verifyTxtRecord("_verify.example.com", "token_abc123") // success(true)
 */
export async function verifyTxtRecord(
	name: string,
	expected: string,
	options?: DoH.ResolveOptions,
): Promise<Result<boolean, DoHError>> {
	let answer = await resolve(name, "TXT", options);
	if (isFailure(answer)) return answer.error instanceof NameNotFoundError ? success(false) : answer;
	return success(answer.data.records.some((record) => record.text === expected));
}

/**
 * Whether `name` is a CNAME to `target`, directly or through further aliases, compared
 * case-insensitively without the trailing dot. The chain is followed one CNAME query per
 * hop, up to eight, so the check holds even when the target itself resolves to nothing.
 * NXDOMAIN at any hop is `success(false)`; every other lookup failure stays a failure.
 *
 * @param name - The name the customer points, such as `shop.example.com`.
 * @param target - The host it must alias.
 * @param options - Passed to `resolve`.
 * @example await checkCname("shop.example.com", "custom.hosting.example") // success(true)
 */
export async function checkCname(
	name: string,
	target: string,
	options?: DoH.ResolveOptions,
): Promise<Result<boolean, DoHError>> {
	let wanted = normalizeName(target);
	let current = normalizeName(name);
	let seen = new Set<string>();

	for (let hop = 0; hop < MAX_CNAME_HOPS && !seen.has(current); hop++) {
		seen.add(current);

		let answer = await resolve(current, "CNAME", options);
		if (isFailure(answer)) {
			return answer.error instanceof NameNotFoundError ? success(false) : failure(answer.error);
		}

		let targets = answer.data.records.map((record) => record.target);
		if (targets.includes(wanted)) return success(true);

		let next = targets[0];
		if (next === undefined) return success(false);
		current = next;
	}

	return success(false);
}
