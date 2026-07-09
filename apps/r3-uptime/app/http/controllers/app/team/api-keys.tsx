/**
 * API keys list controller. Requires `requireUser` + `requireTeam` +
 * `requireRole("admin")`. Reads the one-time `newApiKey` session flash so a key just
 * created on this render (redirected from the create action) can be shown once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";
import { Session } from "remix/session";

import ApiKey from "~/app/data/api-key";
import { getViewer } from "~/app/http/middleware/auth";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import ApiKeysView from "~/resources/views/api-keys/index";
import routes from "~/routes/web";

interface NewApiKey {
	name: string;
	key: string;
}

/** GET /app/:team/api-keys — the team's API keys list. */
export default createAction(
	routes.app.team.apiKeys,
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let apiKeys = await ApiKey.listByTeam(db, ctx.team.id);
		let newApiKey = ctx.get(Session)?.get("newApiKey") as NewApiKey | undefined;

		let renderDocument = DocumentLayout();
		return ctx.render(
			renderDocument({
				title: `${ctx.team.name} · API keys`,
				children: (
					<AppShell team={ctx.team} viewer={viewer}>
						<ApiKeysView team={ctx.team} apiKeys={apiKeys} newApiKey={newApiKey} />
					</AppShell>
				),
			}),
		);
	}),
);
