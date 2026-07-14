/**
 * API keys list controller. Requires `requireUser` + `requireTeam` +
 * `requireRole("admin")`. Reads the one-time `newApiKey` session flash so a key just
 * created on this render (redirected from the create action) can be shown once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { PlusIcon } from "@pkg/lucide-remix";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";
import { Session } from "remix/session";

import ApiKey from "~/app/data/api-key";
import { getViewer } from "~/app/http/middleware/auth";
import requireRole from "~/app/http/middleware/require-role";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import LinkButton from "~/resources/components/link-button";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import ApiKeysView from "~/resources/views/api-keys/index";
import routes from "~/routes/web";

interface NewApiKey {
	name: string;
	key: string;
}

/** GET /app/:team/api-keys — the team's API keys list. */
export default createAction(routes.app.team.apiKeys.index, {
	middleware: [requireUser, requireTeam, requireRole("admin")],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let apiKeys = await ApiKey.listByTeam(db, ctx.team.id);
		let newApiKey = ctx.get(Session)?.get("newApiKey") as NewApiKey | undefined;

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · API keys`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					heading="API Keys"
					actions={
						apiKeys.length < 10 && (
							<LinkButton href={routes.app.team.apiKeys.new.href({ team: ctx.team.slug })}>
								<PlusIcon size={16} strokeWidth={1.5} />
								Create API Key
							</LinkButton>
						)
					}
				>
					<ApiKeysView team={ctx.team} apiKeys={apiKeys} newApiKey={newApiKey} />
				</AppShell>
			</DocumentLayout>,
		);
	}),
});
