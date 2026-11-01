/**
 * `POST /demo/docs/:site/feedback` — where a docs demo page's "Was this helpful?" form posts.
 * A demo keeps no votes; it sends the reader back to the page, which thanks them in place of
 * the form, the way a real docs site answers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
import { DOCS_FEEDBACK_PAGE_FIELD, DOCS_FEEDBACK_VOTE_FIELD } from "@sdxc/ui/docs";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { demoDocsHref } from "~/resources/views/demo-docs";
import { FEEDBACK_ID, FEEDBACK_SENT_PARAM } from "~/resources/views/demo-docs/shell";
import routes from "~/routes/web";

/** The `:site` the form posted under. */
const PARAMS = s.object({ site: s.string() });

/** A vote as the form posts it; the note is read and dropped. */
const VOTE = s.object({
	[DOCS_FEEDBACK_VOTE_FIELD]: s.enum_(["yes", "no"]),
	[DOCS_FEEDBACK_PAGE_FIELD]: s.string(),
});

/**
 * Answers `303` to the page the vote was about, with the thanks flag and the block's id as
 * the fragment. The page must sit under the same demo, so a vote can only ever send the
 * reader back into it; anything else answers `400`.
 */
export default createAction(routes.demoDocs.feedback, async (ctx) => {
	let { site } = s.parse(PARAMS, ctx.params);
	let parsed = await validate(ctx.formData, VOTE);
	let root = demoDocsHref(site)();
	if (isFailure(parsed)) return new Response("That feedback could not be read.", { status: 400 });

	let page = parsed.data[DOCS_FEEDBACK_PAGE_FIELD];
	if (!page.startsWith(`${root}/`) || page.includes("//") || page.includes("\\")) {
		return new Response("That feedback could not be read.", { status: 400 });
	}

	let target = new URL(page, ctx.url.origin);
	target.searchParams.set(FEEDBACK_SENT_PARAM, "sent");
	target.hash = FEEDBACK_ID;
	return new Response(null, {
		status: 303,
		headers: { Location: `${target.pathname}${target.search}${target.hash}` },
	});
});
