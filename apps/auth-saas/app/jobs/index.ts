/**
 * The platform's job map: every background job this worker runs and the schedule each
 * is enqueued on. A pure declaration, so importing it costs the leaves alone and pulls
 * in neither a handler nor a binding.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { job, jobs } from "@sdxc/jobs";
import { EMAIL_DELIVERY } from "@sdxc/mail";
import * as s from "remix/data-schema";

/**
 * Every scheduled job, keyed by the name it travels under: the key is the message
 * `type`, so a message one deploy enqueued is still routable by the deploy that
 * consumes it.
 */
export default jobs({
	/** Delivers what `ctx.email.queue()` handed the queue, for every declared email. */
	email: job({ input: EMAIL_DELIVERY }),
	refreshPendingDomains: job({ cron: "0 0 * * *" }),
	/**
	 * Claims every tenant's own due webhook deliveries and fans one `deliverWebhook`
	 * message out per delivery.
	 */
	sweepDueWebhookDeliveries: job({ cron: "*/5 * * * *" }),
	/** Sends one webhook delivery, enqueued explicitly by the sweep above. */
	deliverWebhook: job({ input: s.object({ tenantId: s.string(), deliveryId: s.string() }) }),
	/**
	 * Compares every provisioned tenant's own last hour of failed sign-ins against its
	 * trailing week, mailing that tenant's owners once when the rate stands well above
	 * baseline.
	 */
	checkAttackSignalBaseline: job({ cron: "0 8 * * *" }),
	/**
	 * Advances every tenant's own active import run by whatever batches fit in one
	 * tick. Runs every minute, the tightest cadence any job here carries, because an
	 * import in progress has to show steady visible progress between ticks rather than
	 */
	subjectsImport: job({ cron: "* * * * *" }),
	/**
	 * Advances every tenant's own active export run by whatever pages fit in one tick.
	 * Carries the same once-a-minute cadence as the import side for the same reason: a
	 * customer watching an export in progress needs steady visible movement rather t
	 */
	subjectsExport: job({ cron: "* * * * *" }),
});
