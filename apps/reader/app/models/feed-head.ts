/**
 * The freshness index: one key per feed, holding the head that feed has reached. Telling
 * every subscriber that a feed moved is one write per subscriber, wherever those writes
 * are arranged, and most of those readers will not open the reader today.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:workers";

/**
 * Namespace for the heads inside the KV this app shares between the sessions, the
 * provider's discovery document and these, each kept apart by its own prefix.
 */
const HEAD_KEY_PREFIX = "feed";

/**
 * Where one feed's head is published.
 *
 * Built from the feed's id rather than its URL: a KV key stops at 512 bytes and a URL
 * does not, and the id is short, fixed-width and already written down on both sides.
 *
 * @param feedId - The feed the catalog named.
 */
export function headKey(feedId: string): string {
	return `${HEAD_KEY_PREFIX}:${feedId}:head`;
}

/**
 * Publishes a feed's head, so its subscribers can see there is something to come and get.
 *
 * @param feedId - The feed the catalog named.
 * @param head - The counter's current value, which is what a cursor is compared against.
 */
export async function publishHead(feedId: string, head: number): Promise<void> {
	await env.KV.put(headKey(feedId), String(head));
}

/**
 * Drops a feed's head, which is what a purge does along with the storage behind it.
 * Leaving the key would advertise a head for an object that no longer holds the items to
 * satisfy it, and the first subscriber to revive the feed would read a hint the revived
 *
 * @param feedId - The feed the catalog named.
 */
export async function forgetHead(feedId: string): Promise<void> {
	await env.KV.delete(headKey(feedId));
}

/**
 * The heads of many feeds at once, as one read per hundred rather than one read per feed.
 * A reader following thirty feeds issues one request; two hundred and fifty, three, and
 * those run together, so the check costs one round trip however many subscriptions it cov
 *
 * @param feedIds - The feeds to read heads for.
 * @returns Each feed's head by id, with the feeds that published none left out.
 */
export async function readHeads(feedIds: readonly string[]): Promise<Map<string, number>> {
	let heads = new Map<string, number>();
	if (feedIds.length === 0) return heads;

	let batches = chunked(feedIds, KEYS_PER_BULK_READ);

	let reads = await Promise.all(
		batches.map((batch) => env.KV.get(batch.map((feedId) => headKey(feedId)))),
	);

	for (let [index, read] of reads.entries()) {
		let batch = batches[index];
		if (batch === undefined) continue;

		for (let feedId of batch) {
			let published = read.get(headKey(feedId));
			if (published === null || published === undefined) continue;

			let head = Number.parseInt(published, 10);
			if (Number.isNaN(head)) continue;

			heads.set(feedId, head);
		}
	}

	return heads;
}

/**
 * Keys one bulk read may carry, which is what chunks a subscription list. Exported so a
 * caller reporting how many reads its check cost counts them the way this splits them.
 */
export const KEYS_PER_BULK_READ = 100;

/**
 * Splits a list into runs of at most `size`.
 *
 * @param values - The list to split.
 * @param size - The most any run may hold.
 */
function chunked<value>(values: readonly value[], size: number): value[][] {
	let batches: value[][] = [];
	for (let index = 0; index < values.length; index += size) {
		batches.push(values.slice(index, index + size));
	}
	return batches;
}
