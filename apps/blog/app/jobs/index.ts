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
		/** Plans what a created, updated or deleted post notifies and queues each delivery. */
		send: job({ input: s.object({ postId: s.string() }) }),
		/**
		 * Notifies one target, so one slow endpoint delays nobody else; `removed` marks a
		 * link the post dropped, whose record goes once the target is told.
		 */
		deliver: job({
			input: s.object({ postId: s.string(), target: s.string(), removed: s.boolean() }),
		}),
		/** Sends for posts whose scheduled publish date has arrived since the last run. */
		scheduled: job({ cron: "*/15 * * * *" }),
	},
});
