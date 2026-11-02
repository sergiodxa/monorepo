/**
 * `POST /demo/docs/:site/feedback` — where a docs demo page's "Was this helpful?" form posts.
 * A demo keeps no votes: a document post goes back to the page, and a post aimed at the
 * feedback frame goes to that frame, both thanking the reader in place of the form.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
import { DOCS_FEEDBACK_PAGE_FIELD, DOCS_FEEDBACK_VOTE_FIELD } from "@sdxc/ui/docs";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import {
	demoDocsFeedbackHref,
	demoDocsThanksHref,
	FEEDBACK_FRAME,
	findFeedbackPage,
} from "~/resources/views/demo-docs/feedback";
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
 * the fragment; a post carrying `X-Remix-Target` for the feedback frame is sent to the
 * frame's thanks instead, so only that frame reloads. The page must be one of the demo's
 * own pages; anything else answers `400`.
 */
export default createAction(routes.demoDocs.feedback, async (ctx) => {
	let { site } = s.parse(PARAMS, ctx.params);
	let parsed = await validate(ctx.formData, VOTE);
	if (isFailure(parsed)) return new Response("That feedback could not be read.", { status: 400 });

	let path = await findFeedbackPage(site, parsed.data[DOCS_FEEDBACK_PAGE_FIELD]);
	if (path === null) return new Response("That feedback could not be read.", { status: 400 });

	let location =
		ctx.request.headers.get("X-Remix-Target") === FEEDBACK_FRAME
			? demoDocsFeedbackHref(site, path, true)
			: demoDocsThanksHref(site, path);
	return new Response(null, { status: 303, headers: { Location: location } });
});
