/**
 * The platform's job map: every background job this worker runs and the schedule each
 * is enqueued on. A pure declaration, so importing it costs the leaves alone and pulls
 * in neither a handler nor a binding.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { job, jobs } from "@sdxc/jobs";

/**
 * Every scheduled job, keyed by the name it travels under: the key is the message
 * `type`, so a message one deploy enqueued is still routable by the deploy that
 * consumes it.
 */
export default jobs({
	refreshPendingDomains: job({ cron: "0 0 * * *" }),
});
