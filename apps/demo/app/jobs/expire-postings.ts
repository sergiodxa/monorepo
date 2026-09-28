/**
 * Closes postings the board has carried for its whole lifetime, so the listing stays a set
 * of positions somebody could still apply to. A closed posting keeps its row and its id,
 * which is what lets an old link and an agent's saved resource URI keep resolving.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createJobHandler } from "@sdxc/jobs";

import Job, { POSTING_LIFETIME_DAYS } from "~/app/data/posting";
import jobs from "~/app/jobs";

/** Milliseconds in one day, the unit the lifetime is stated in. */
const DAY_MS = 86_400_000;

export default createJobHandler(jobs.expirePostings, async (ctx) => {
	let cutoff = Date.now() - POSTING_LIFETIME_DAYS * DAY_MS;
	let closed = await Job.expirePublishedBefore(ctx.database, cutoff);

	ctx.log.set({ postings: { expired: closed } });
});
