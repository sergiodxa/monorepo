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

import { PostingPublishedEmail } from "~/app/emails/posting-published";
import jobs from "~/app/jobs";
import { translatorFor } from "~/app/lib/i18n";
import { mailer } from "~/app/lib/mailer";

export default createJobHandler(jobs.sendConfirmation, async (ctx) => {
	let posting = await ctx.models.postings.find(ctx.input.postingId);
	if (!posting) {
		ctx.log.note("confirmation.posting_missing");
		return;
	}

	let intl = translatorFor(ctx.input.locale);

	let sent = await mailer.send(
		new PostingPublishedEmail(posting.contact_email, {
			subject: intl.t("email.subject", { title: posting.title }),
			heading: intl.t("email.heading"),
			body: intl.t("email.body", { title: posting.title, company: posting.company }),
			footer: intl.t("email.footer"),
		}),
	);

	if (isFailure(sent)) {
		ctx.log.fail(sent.error);
		return;
	}

	ctx.log.set({ confirmation: { posting: posting.id } });
});
