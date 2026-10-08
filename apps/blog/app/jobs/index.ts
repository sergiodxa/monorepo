/**
 * The blog's job map: every background job the worker runs, the payload each carries
 * and the schedule it is enqueued on. A pure declaration, so importing it pulls in
 * neither a handler nor a binding.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { Federation } from "@sdxc/activitypub";
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
	bookmarks: {
		/**
		 * Reads one bookmark's page: records what it came to, raises or clears its flag, and
		 * fills a title or description the bookmark is missing.
		 */
		inspect: job({ input: s.object({ postId: s.string() }) }),
		/**
		 * Takes a bookmark's Wayback Machine capture, or for an old bookmark finds the closest
		 * existing one, and records its instant as `archived_at`.
		 */
		archive: job({ input: s.object({ postId: s.string() }) }),
		/** Queues an inspection of every bookmark, and an archive of each one due, Mondays at 06:00 UTC. */
		sweep: job({ cron: "0 6 * * 1" }),
		/** Mails the flags raised since the last digest; sends nothing when there are none. */
		digest: job({ cron: "0 14 * * *" }),
	},
	activityPub: {
		/**
		 * Runs one step the federation queued: an activity the inbox verified, the fan-out of
		 * a published activity, or one signed delivery to one inbox.
		 */
		process: job({ input: Federation.MESSAGE }),
		/**
		 * Federates a created, edited or deleted post: `Create` the first time, `Update` after,
		 * `Delete` once gone. `changedAt` is when the edit happened, which names its `Update`.
		 */
		publish: job({ input: s.object({ postId: s.string(), changedAt: s.string() }) }),
		/** Federates posts whose scheduled publish date has arrived since the last run. */
		scheduled: job({ cron: "*/15 * * * *" }),
	},
	sponsors: {
		/** Stores the public sponsor roster `/sponsors` renders, four times a day. */
		refresh: job({ cron: "0 */6 * * *" }),
	},
});
