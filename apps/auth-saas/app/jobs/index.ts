/**
 * The platform's job map: every background job this worker runs and the schedule each
 * is enqueued on. A pure declaration, so importing it costs the leaves alone and pulls
 * in neither a handler nor a binding.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { job, jobs } from "@sdxc/jobs";
import * as s from "remix/data-schema";

/**
 * Every scheduled job, keyed by the name it travels under: the key is the message
 * `type`, so a message one deploy enqueued is still routable by the deploy that
 * consumes it.
 */
export default jobs({
	refreshPendingDomains: job({ cron: "0 0 * * *" }),
	/**
	 * Claims every tenant's own due webhook deliveries and fans one `deliverWebhook`
	 * message out per delivery. Runs every five minutes as a backstop: the real retry
	 * timing comes from each delivery's own `next_attempt_at` and the delay
	 * `deliverWebhook` schedules its own retries with, so an enqueue this sweep misses
	 * heals on the next one rather than losing a delivery.
	 */
	sweepDueWebhookDeliveries: job({ cron: "*/5 * * * *" }),
	/** Sends one webhook delivery, enqueued explicitly by the sweep above. */
	deliverWebhook: job({ input: s.object({ tenantId: s.string(), deliveryId: s.string() }) }),
});
