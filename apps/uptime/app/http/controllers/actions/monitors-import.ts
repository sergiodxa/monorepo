/**
 * `POST /actions/:team/import-monitors` — creates one monitor per URL in a pasted list.
 *
 * Every URL goes through the same validation and the same `Monitor.create` the single-monitor
 * form uses, so an imported monitor is indistinguishable from a hand-made one and no second
 * creation path exists to drift from the first.
 *
 * A partial success is the expected outcome, not an error: somebody pasting thirty lines off a
 * spreadsheet will have a stray blank, a duplicate, and something that isn't a URL among them.
 * Refusing the whole submission over one bad line would make the feature useless precisely
 * when it is most needed, so the good lines are created and the bad ones are reported back
 * with their reasons.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@pkg/http/response";
import { createAction } from "remix/fetch-router";

import routes from "~/routes/web";

/** POST /actions/:team/import-monitors */
export const importMonitors = createAction(routes.actions.monitor.http.import, async (ctx) => {
	return redirect(routes.app.team.monitorsImport.href({ team: ctx.team.slug }), {
		status: redirect.Status.SeeOther,
	});
});

export default importMonitors;
