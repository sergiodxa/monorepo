/**
 * Rule deletion for `DELETE /rules/:ruleId`. It takes the rule away and returns the reader
 * to the page listing them.
 *
 * Deleting a rule deletes no post: one that dropped posts never wrote them, and one that
 * marked or flagged them leaves those marks exactly where they are. What changes is what
 * happens to the next arrival.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { rulesPage } from "~/app/http/controllers/rules/manage";
import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { userStore } from "~/database/user-do";
import routes from "~/routes/web";

/** The path this route matches, which carries the rule being deleted. */
const Params = s.object({ ruleId: s.string() });

/** DELETE /rules/:ruleId — takes the rule away, leaving every stored post as it is. */
export default createAction(routes.rule.delete, {
	middleware: [requireUser],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { ruleId } = s.parse(Params, ctx.params);
		let removed = await userStore(viewer.id).deleteRule(ruleId);

		return redirect(rulesPage(removed.ok ? "deleted" : removed.reason), {
			status: redirect.Status.SeeOther,
		});
	},
});
