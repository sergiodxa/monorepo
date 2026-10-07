/**
 * Reads the archive.org account keys Save Page Now captures bookmarks under, from the
 * worker's Secrets Store bindings, when a capture is about to be asked for: the other jobs
 * never pay for the two secret reads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:workers";

import type { Wayback } from "~/app/services/wayback";

/**
 * The keys in `WAYBACK_ACCESS_KEY` and `WAYBACK_SECRET_KEY`, or `null` when either cannot
 * be read or is empty, which leaves the bookmark unarchived until the next attempt.
 *
 * @returns Both keys, or `null`.
 */
export async function waybackKeys(): Promise<Wayback.Keys | null> {
	try {
		let [access, secret] = await Promise.all([
			env.WAYBACK_ACCESS_KEY.get(),
			env.WAYBACK_SECRET_KEY.get(),
		]);
		if (!access || !secret) return null;
		return { access, secret };
	} catch {
		return null;
	}
}
