/**
 * Every background job the app runs, declared in one map: the payload each carries and the
 * schedule it is enqueued on. Importing it costs the schemas alone, so a controller enqueues
 * a job without loading the handler that runs it.
 */

import { job, jobs } from "@sdxc/jobs";
import { EMAIL_DELIVERY } from "@sdxc/mail";

/** The app's jobs; `sdxc make job <name>` declares one here and maps its handler. */
export default jobs({
	/** Delivers what `ctx.email.queue()` handed the queue, for every declared email. */
	email: job({ input: EMAIL_DELIVERY }),
});
