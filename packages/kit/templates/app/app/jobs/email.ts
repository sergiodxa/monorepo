/**
 * Delivers a queued email. A delivery no retry can send (an email nothing maps, props its
 * schema refuses) ends here; any other failure, such as the provider being down, is retried.
 */

import { createJobHandler } from "@sdxc/jobs";
import { EmailRefusedError } from "@sdxc/mail";
import { isFailure } from "@sdxc/result";

import jobs from "~/app/jobs";

export default createJobHandler(jobs.email, async (ctx) => {
	let sent = await ctx.email.deliver(ctx.input);
	if (isFailure(sent) && sent.error instanceof EmailRefusedError) ctx.exit(sent.error.message);
	if (isFailure(sent)) ctx.retry({ cause: sent.error });
});
