/**
 * Mails the poster once their position is live. It runs off the request so a slow provider
 * never delays the page the submitter lands on, and it writes in the language the
 * submission was made in, which is what the message carries.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createJobHandler } from "@sdxc/jobs";
import { isFailure } from "@sdxc/result";

import emails from "~/app/emails";
import jobs from "~/app/jobs";

export default createJobHandler(jobs.sendConfirmation, async (ctx) => {
	let posting = await ctx.models.postings.find(ctx.input.postingId);
	if (!posting) {
		ctx.log.note("confirmation.posting_missing");
		return;
	}

	let sent = await ctx.email.send(emails.postingPublished, {
		to: posting.contact_email,
		locale: ctx.input.locale,
		props: { title: posting.title, company: posting.company },
	});

	if (isFailure(sent)) {
		ctx.log.fail(sent.error);
		return;
	}

	ctx.log.set({ confirmation: { posting: posting.id } });
});
