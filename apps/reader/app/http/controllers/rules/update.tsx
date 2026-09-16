/**
 * Rule editing for `POST /rules/:ruleId`. It rewrites what a rule says and returns the
 * reader to the page listing them.
 *
 * The counters travel with the rule rather than being reset: they measure the rule, and a
 * rule whose term was corrected is the same rule the reader has been watching.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { rulesPage, submittedRule } from "~/app/http/controllers/rules/manage";
import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { userStore } from "~/database/user-do";
import routes from "~/routes/web";

/** The path this route matches, which carries the rule being rewritten. */
const Params = s.object({ ruleId: s.string() });

/** POST /rules/:ruleId — rewrites a rule, which changes what arrives from here. */
export default createAction(routes.rule.update, {
	middleware: [requireUser],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { ruleId } = s.parse(Params, ctx.params);

		let written = await userStore(viewer.id).updateRule(ruleId, submittedRule(ctx.formData));

		return redirect(rulesPage(written.ok ? "updated" : written.reason), {
			status: redirect.Status.SeeOther,
		});
	},
});
