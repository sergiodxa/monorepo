/**
 * The platform's job map: every background job this worker runs and the schedule each
 * is enqueued on. A pure declaration, so importing it costs the leaves alone and pulls
 * in neither a handler nor a binding.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { job, jobs } from "@pkg/jobs-next";

/**
 * Every scheduled job, keyed by the name it travels under: the key is the message
 * `type`, so a message one deploy enqueued is still routable by the deploy that
 * consumes it. The two 02:00 jobs share a trigger and arrive as separate messages.
 */
export default jobs({
	reportUsage: job({ cron: "0 1 * * *" }),
	purgeDeletedBlogs: job({ cron: "0 2 * * *" }),
	pollHostnames: job({ cron: "0 2 * * *" }),
});
