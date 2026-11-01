/**
 * Records a "Was this page helpful?" vote on the request's log event and sends the reader back to
 * the page they voted on, which thanks them at the top, where the page opens. It works for
 * signed-out readers, so it stores nothing tied to an account.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import {
	DOCS_FEEDBACK_NOTE_FIELD,
	DOCS_FEEDBACK_PAGE_FIELD,
	DOCS_FEEDBACK_VOTE_FIELD,
} from "@sdxc/ui/docs";
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";
import { createAction } from "remix/router";

import { FEEDBACK_SENT_PARAM } from "~/app/http/controllers/docs/show";
import { DOC_PAGES, docHref } from "~/resources/docs/registry";
import routes from "~/routes/web";

/** The longest note kept from a vote; past it a note is truncated rather than refused. */
export const FEEDBACK_NOTE_LENGTH = 1000;

const FeedbackForm = f.object({
	[DOCS_FEEDBACK_VOTE_FIELD]: f.field(s.defaulted(s.string(), "")),
	[DOCS_FEEDBACK_PAGE_FIELD]: f.field(s.defaulted(s.string(), "")),
	[DOCS_FEEDBACK_NOTE_FIELD]: f.field(s.defaulted(s.string(), "")),
});

export default createAction(routes.docs.feedback, (ctx) => {
	let submitted = s.parse(FeedbackForm, ctx.formData);
	let page = DOC_PAGES.find((candidate) => docHref(candidate.slug) === submitted.page);

	/** A vote naming no help page has nowhere to go back to, so it lands on the hub. */
	if (!page) return redirect(routes.docs.index.href(), { status: redirect.Status.SeeOther });

	let vote = submitted.helpful === "yes" || submitted.helpful === "no" ? submitted.helpful : null;
	if (vote !== null) {
		ctx.log.set({
			feedback: {
				page: page.slug,
				helpful: vote === "yes",
				note: submitted.note.trim().slice(0, FEEDBACK_NOTE_LENGTH),
			},
		});
	}

	let query = new URLSearchParams({ [FEEDBACK_SENT_PARAM]: "sent" });
	return redirect(`${docHref(page.slug)}?${query}`, {
		status: redirect.Status.SeeOther,
	});
});
