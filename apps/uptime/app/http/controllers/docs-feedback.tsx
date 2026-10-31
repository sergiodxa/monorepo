/**
 * POST /docs/feedback receives a page's "Was this helpful?" answer and records it on the
 * request's wide log event, then sends the reader back to the page they answered on, which thanks
 * them in place of the form. A submission that fails validation still lands back on docs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createAction } from "remix/router";

import { DocsFeedbackSchema } from "~/app/http/validators/docs-feedback";
import routes from "~/routes/web";

/** A docs page path, the only place a submission may send the reader back to. */
const DOCS_PATH = /^\/docs(\/[a-z0-9][a-z0-9-]*)*$/;

/**
 * Logs the answer under `docs_feedback` with the page, the vote and the note, and redirects
 * with `303` to `?feedback=sent` on that page. A page outside `/docs` sends the reader to
 * the hub, so the form can never redirect off the site.
 */
export default createAction(routes.docs.feedback, async (ctx) => {
	let result = await validate(ctx.formData, DocsFeedbackSchema);
	if (isFailure(result)) {
		ctx.log.set({ docs_feedback: { refused: "invalid" } });
		return redirect(routes.docs.index.href(), { status: redirect.Status.SeeOther });
	}

	let { helpful, page, note } = result.data;
	if (!DOCS_PATH.test(page)) {
		ctx.log.set({ docs_feedback: { refused: "page" } });
		return redirect(routes.docs.index.href(), { status: redirect.Status.SeeOther });
	}

	ctx.log.set({ docs_feedback: { page, helpful, note: note === "" ? undefined : note } });
	return redirect(`${page}?feedback=sent#docs-feedback`, { status: redirect.Status.SeeOther });
});
