/**
 * `POST /docs/feedback` — where a docs page's "Was this helpful?" form posts. Each vote is
 * logged as one `docs.feedback` event, so which pages help and which miss can be read from
 * the logs, and the reader is sent back to the page, which thanks them in place of the form.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
import {
	DOCS_FEEDBACK_NOTE_FIELD,
	DOCS_FEEDBACK_PAGE_FIELD,
	DOCS_FEEDBACK_VOTE_FIELD,
} from "@sdxc/ui/docs";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import { maxLength } from "remix/data-schema/checks";
import { createAction } from "remix/router";

import {
	DOCS_FEEDBACK_ID,
	FEEDBACK_SENT_PARAM,
	FEEDBACK_SENT_VALUE,
} from "~/resources/components/docs-feedback-block";
import routes from "~/routes/web";

/** The longest note kept, which holds a few sentences and refuses a pasted page. */
export const MAX_FEEDBACK_NOTE_LENGTH = 1000;

/** The longest page path accepted, far beyond any address the site serves. */
const MAX_PAGE_LENGTH = 512;

/**
 * Whether `page` is a path on this site: it starts with one `/` and resolves against the
 * site's own origin, so a vote can only ever send the reader back to a page here.
 */
function isSameSitePath(page: string): boolean {
	if (!page.startsWith("/") || page.startsWith("//") || page.includes("\\")) return false;
	try {
		return new URL(page, "https://sdxc.dev").origin === "https://sdxc.dev";
	} catch {
		return false;
	}
}

/** A vote as the form posts it; an empty note reads as no note. */
const FEEDBACK_SCHEMA = s.object({
	[DOCS_FEEDBACK_VOTE_FIELD]: s.enum_(["yes", "no"]),
	[DOCS_FEEDBACK_PAGE_FIELD]: s
		.string()
		.pipe(maxLength(MAX_PAGE_LENGTH))
		.refine(isSameSitePath, "Expected a path on this site"),
	[DOCS_FEEDBACK_NOTE_FIELD]: s.optional(s.string().pipe(maxLength(MAX_FEEDBACK_NOTE_LENGTH))),
});

/**
 * Logs the vote as a `docs.feedback` event and answers `303` to the page it was about, with
 * `?feedback=sent` so the page renders its thank-you, and the block's id as the fragment so
 * the reader lands where they voted. A submission that fails validation answers `400`.
 */
export default createAction(routes.docsFeedback, async (ctx) => {
	let parsed = await validate(ctx.formData, FEEDBACK_SCHEMA);
	if (isFailure(parsed)) {
		ctx.log.warn("docs.feedback.rejected", {
			issues: parsed.error.issues.map((issue) => issue.message).join("; "),
		});
		return new Response("That feedback could not be read.", { status: 400 });
	}

	let page = parsed.data[DOCS_FEEDBACK_PAGE_FIELD];
	let note = parsed.data[DOCS_FEEDBACK_NOTE_FIELD]?.trim() ?? "";
	let target = new URL(page, ctx.url.origin);

	ctx.log.note("docs.feedback", {
		page: target.pathname,
		helpful: parsed.data[DOCS_FEEDBACK_VOTE_FIELD] === "yes",
		note: note === "" ? undefined : note,
	});

	target.searchParams.set(FEEDBACK_SENT_PARAM, FEEDBACK_SENT_VALUE);
	target.hash = DOCS_FEEDBACK_ID;
	return new Response(null, {
		status: 303,
		headers: { location: `${target.pathname}${target.search}${target.hash}` },
	});
});
