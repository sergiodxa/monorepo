/**
 * Predicts whether a CA may issue for a name: the relevant RRset found over DoH, then
 * decided with no further I/O. Every failure, a broken lookup included, reads as
 * `allowed: false`, because that is what a CA does with it (RFC 8659 §6).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { DoH } from "../types.js";

import type { CAA } from "./types.js";

import { evaluateCaa } from "./evaluate.js";
import { climbCaa } from "./relevant-set.js";

/**
 * Whether a CA may issue for `request.domain`. A failing query answers `lookup-failed`
 * with the name that failed, and an unparsable record in the set answers `unreadable`,
 * both refused. The verdict predicts what the CA's own lookup finds if the zone serves the same.
 *
 * @param request - The domain, the CA's identifiers and, optionally, the RFC 8657 account and method.
 * @param options - Passed to every lookup, so `resolver: GOOGLE` confirms through a second resolver.
 * @returns The verdict and, unless the lookup failed, the RRset that decided it.
 * @example let verdict = await mayIssue({ domain: "*.example.com", issuer: "letsencrypt.org" });
 */
export async function mayIssue(
	request: CAA.Request,
	options?: DoH.ResolveOptions,
): Promise<CAA.Verdict> {
	let relevant = await climbCaa(request.domain, options);
	if ("error" in relevant) return { allowed: false, reason: "lookup-failed", ...relevant };

	let [unreadable] = relevant.unparsed;
	if (unreadable) return { allowed: false, reason: "unreadable", record: unreadable, relevant };

	return { ...evaluateCaa(relevant.records, request), relevant };
}
