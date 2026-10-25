/**
 * The history backfill of a newly followed feed (RFC 5005): walks its archives or pages
 * within the walk's budgets and stores what they hold. It runs off the subscription so a
 * reader joins a feed in one fetch, and its history arrives behind it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createJobHandler } from "@sdxc/jobs";

import jobs from "~/app/jobs";
import { feedStore } from "~/app/models/feed-store";
import { walkHistory } from "~/app/services/history";

/**
 * Walks the feed's history and records how far it got. A transient failure retries the
 * message, which passes over every document already stored at the cost of a 304 each.
 */
export default createJobHandler(jobs.feeds.backfill, async (ctx) => {
	let { feedId, url, rel } = ctx.input;
	let outcome = await walkHistory(feedStore(feedId), { url, rel }, { signal: ctx.signal });

	ctx.log.set({
		feed: { id: feedId },
		history: {
			rel,
			status: outcome.status,
			reason: outcome.status === "done" ? outcome.reason : outcome.message,
			pages: outcome.pages,
			inserted: outcome.inserted,
		},
	});

	if (outcome.status === "retry") {
		return ctx.retry({ delay: "5 minutes", reason: outcome.message });
	}
});
