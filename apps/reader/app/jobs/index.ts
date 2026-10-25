/**
 * The reader's job map: every background job the worker runs and the payload each
 * carries. A pure declaration, so importing it pulls in neither a handler nor a binding,
 * and a feed's own object enqueues through it without loading the work.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { job, jobs } from "@sdxc/jobs";
import * as s from "remix/data-schema";

/**
 * Keyed by the name each job travels under on the queue, so a message one deploy enqueued
 * stays routable by the deploy that consumes it.
 */
export default jobs({
	feeds: {
		/**
		 * Walks a newly followed feed's history (RFC 5005): `prev-archive` back through an
		 * archived feed, or `next` through a paged one, from `url`, within a page and an entry
		 * budget.
		 */
		backfill: job({
			input: s.object({
				feedId: s.string(),
				url: s.string(),
				rel: s.enum_(["prev-archive", "next"]),
			}),
		}),
	},
});
