/**
 * Finds the CAA RRset RFC 8659 §3 applies to a name: the domain's own, or the nearest
 * ancestor's below the root, one query per label and stopping at the first non-empty
 * answer, so a domain publishing at its apex costs one or two lookups.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { DoHError } from "../errors.js";
import type { DoH } from "../types.js";

import { NameNotFoundError } from "../errors.js";
import { resolve } from "../resolve.js";

import type { CAA } from "./types.js";

/** A climb that ended on a failing query, with the name that failed and the names asked so far. */
export interface ClimbFailure {
	name: string;
	queried: string[];
	error: DoHError;
}

/**
 * Finds the RRset a CA reads for `domain`. NODATA and NXDOMAIN move the climb to the
 * parent; any other failure ends it, since a CA would not issue past it. Aliases are the
 * resolver's: records reached through a CNAME are the target's, and `chain` says so.
 *
 * @param domain - The name, a leading `*.` allowed; an internationalized name must already be punycode.
 * @param options - Passed to every `resolve` in the climb.
 * @returns The relevant RRset, empty with `name: null` when no ancestor publishes one.
 * @example await findRelevantCaa("shop.example.com") // success({ name: "example.com", records: [...], queried: ["shop.example.com", "example.com"], ... })
 */
export async function findRelevantCaa(
	domain: string,
	options?: DoH.ResolveOptions,
): Promise<Result<CAA.RelevantSet, DoHError>> {
	let climbed = await climbCaa(domain, options);
	return "error" in climbed ? failure(climbed.error) : success(climbed);
}

/**
 * The climb behind `findRelevantCaa`, reporting a failure with the name that failed so a
 * verdict can say where DNS broke. `authenticated` is the AD flag of every answer ANDed,
 * NXDOMAIN included, because an unvalidated empty step is where a suppressed record hides.
 */
export async function climbCaa(
	domain: string,
	options?: DoH.ResolveOptions,
): Promise<CAA.RelevantSet | ClimbFailure> {
	let queried: string[] = [];
	let authenticated = true;

	for (let name of candidateNames(domain)) {
		queried.push(name);
		let answer = await resolve(name, "CAA", options);

		if (isFailure(answer)) {
			if (!(answer.error instanceof NameNotFoundError))
				return { name, queried, error: answer.error };
			authenticated &&= answer.error.authenticated;
			continue;
		}

		authenticated &&= answer.data.authenticated;
		let { records, unparsed, chain } = answer.data;
		if (records.length > 0 || unparsed.length > 0)
			return { name, records, unparsed, chain, queried, authenticated };
	}

	return {
		name: null,
		records: [],
		unparsed: [],
		chain: [],
		queried,
		authenticated: authenticated && queried.length > 0,
	};
}

/**
 * The domain and each ancestor below the root, nearest first. The domain is lowercased,
 * its trailing dot and a leading `*.` dropped, since RFC 8659 computes `*.X`'s set at `X`.
 */
function candidateNames(domain: string): string[] {
	let name = domain.trim().toLowerCase();
	if (name.endsWith(".")) name = name.slice(0, -1);
	if (name.startsWith("*.")) name = name.slice(2);
	let labels = name.split(".").filter((label) => label.length > 0);
	return labels.map((_, index) => labels.slice(index).join("."));
}
