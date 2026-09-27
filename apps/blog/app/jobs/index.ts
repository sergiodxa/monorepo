/**
 * The blog's job map: every background job the worker runs, the payload each carries
 * and the schedule it is enqueued on. A pure declaration, so importing it pulls in
 * neither a handler nor a binding.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { job, jobs } from "@sdxc/jobs";
import * as s from "remix/data-schema";

/**
 * Keyed by the name each job travels under on the queue, so a message one deploy
 * enqueued stays routable by the deploy that consumes it.
 */
export default jobs({
	webmentions: {
		/** Fetches a received mention's source and stores, updates or deletes the mention. */
		verify: job({ input: s.object({ source: s.string(), target: s.string() }) }),
	},
});
