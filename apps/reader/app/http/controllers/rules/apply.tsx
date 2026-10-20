/**
 * The one-off over a previewed page, for `POST /rules/previewed`. It applies a candidate's
 * action to the posts that candidate matched among the reader's newest ones.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { createAction } from "remix/router";

import {
	afterRule,
	APPLIED_PARAM,
	rulesPage,
	submittedRule,
} from "~/app/http/controllers/rules/manage";
import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { userStore } from "~/app/models/user-store";
import routes from "~/routes/web";

/** POST /rules/previewed — acts on the posts a previewed candidate matched. */
export default createAction(routes.rule.apply, {
	middleware: [requireUser],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let applied = await userStore(viewer.id).applyPreviewedRule(submittedRule(ctx.formData));

		if (!applied.ok) {
			return redirect(afterRule(applied.reason), { status: redirect.Status.SeeOther });
		}

		return redirect(rulesPage("applied", { [APPLIED_PARAM]: String(applied.affected) }), {
			status: redirect.Status.SeeOther,
		});
	},
});
