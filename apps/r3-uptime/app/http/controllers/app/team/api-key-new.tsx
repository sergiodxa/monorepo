/**
 * New API key page controller. Requires `requireUser` + `requireTeam` +
 * `requireRole("admin")`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { getContext } from "remix/async-context-middleware";
import { createAction } from "remix/fetch-router";

import { getViewer } from "~/app/http/middleware/auth";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import NewApiKeyView from "~/resources/views/api-keys/new";
import routes from "~/routes/web";

/** GET /app/:team/api-keys/new — the new API key form. */
export default createAction(routes.app.team.apiKeyNew, () => {
	let ctx = getContext();
	let viewer = getViewer();
	if (!viewer) throw new Error("requireUser must run before this handler");

	let renderDocument = DocumentLayout();
	return ctx.render(
		renderDocument({
			title: `${ctx.team.name} · New API key`,
			children: (
				<AppShell team={ctx.team} viewer={viewer}>
					<NewApiKeyView team={ctx.team} />
				</AppShell>
			),
		}),
	);
});
