/**
 * Account page controller. Requires `requireUser` + `requireTeam` — the `:team` in
 * its URL only picks which team's shell wraps the page; the content itself lists
 * every team the viewer belongs to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import Team from "~/app/data/team";
import UserPreferences from "~/app/data/user-preferences";
import { getViewer } from "~/app/http/middleware/auth";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import AccountView from "~/resources/views/account";
import routes from "~/routes/web";

/** GET /app/:team/account — the signed-in user's account settings. */
export default createAction(
	routes.app.team.account,
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let [memberships, preferences] = await Promise.all([
			Team.listWithRoleBySubjectId(db, viewer.id),
			UserPreferences.findBySubjectId(db, viewer.id),
		]);

		let renderDocument = DocumentLayout();
		return ctx.render(
			renderDocument({
				title: `${ctx.team.name} · Account`,
				children: (
					<AppShell team={ctx.team} viewer={viewer}>
						<AccountView
							viewer={viewer}
							memberships={memberships}
							preferredLanguage={preferences?.preferred_language ?? null}
						/>
					</AppShell>
				),
			}),
		);
	}),
);
