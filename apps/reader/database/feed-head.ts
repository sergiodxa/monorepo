/**
 * The freshness index: one key per feed, holding the head that feed has reached.
 *
 * Telling every subscriber that a feed moved is one write per subscriber, wherever those
 * writes are arranged, and most of those readers will not open the reader today. The
 * comparison each of them would be told the answer to is `head > cursor`, and both sides
 * of it already exist — the head in the feed's own storage, the cursor in the reader's.
 * Publishing the head somewhere shared lets each reader make the comparison themselves,
 * at the moment they ask a question that needs the answer. The publication then writes
 * once, whatever the subscriber count, and nobody who is not reading pays anything.
 *
 * What is here is a hint and never a fact. KV is eventually consistent, so a reader can
 * see a head lower than the one the feed has actually reached and believe they are
 * current when they are not; the cost is a delay, and the next check corrects it, because
 * a head only ever moves forward and the items are all still in the feed's object.
 * Correctness lives in the two SQLite databases. This only decides when to go and look.
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
 *
 * Leaving the key would advertise a head for an object that no longer holds the items to
 * satisfy it, and the first subscriber to revive the feed would read a hint the revived
 * counter cannot yet answer.
 *
 * @param feedId - The feed the catalog named.
 */
export async function forgetHead(feedId: string): Promise<void> {
	await env.KV.delete(headKey(feedId));
}

/**
 * The heads of many feeds at once, as one read per hundred rather than one read per feed.
 *
 * A reader following thirty feeds issues one request; two hundred and fifty, three, and
 * those run together, so the check costs one round trip however many subscriptions it
 * covers.
 *
 * A feed with no head published reads as `null`, which callers take as no reason to go
 * and look. Treating an absent key as stale would turn an empty or cold namespace into a
 * full synchronization for every reader on every request, which is a stampede set off by
 * the failure of a hint.
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
