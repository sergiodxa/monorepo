/**
 * The one-off over a previewed page, for `POST /rules/previewed`. It applies a candidate's
 * action to the posts that candidate matched among the reader's newest ones.
 *
 * This is what a reader has instead of a rule that reaches backwards: it is bounded by the
 * page they just looked at, it runs once, and it acts on posts they saw rather than on
 * everything a term might reach. Writing the rule itself is a separate submission, so
 * clearing a bad week and filtering the next one are two decisions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { createAction } from "remix/router";

import { APPLIED_PARAM, rulesPage, submittedRule } from "~/app/http/controllers/rules/manage";
import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { features } from "~/app/lib/flags";
import { userStore } from "~/database/user-do";
import routes from "~/routes/web";

/** POST /rules/previewed — acts on the posts a previewed candidate matched. */
export default createAction(routes.rule.apply, {
	middleware: [requireUser],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		if (!(await ctx.flags.get(features.filterRules))) {
			return redirect(routes.reading.index.href(), { status: redirect.Status.SeeOther });
		}

		let applied = await userStore(viewer.id).applyPreviewedRule(submittedRule(ctx.formData));

		if (!applied.ok) {
			return redirect(rulesPage(applied.reason), { status: redirect.Status.SeeOther });
		}

		return redirect(rulesPage("applied", { [APPLIED_PARAM]: String(applied.affected) }), {
			status: redirect.Status.SeeOther,
		});
	},
});
