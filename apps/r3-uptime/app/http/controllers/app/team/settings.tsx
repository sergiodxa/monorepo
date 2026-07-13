/**
 * Team settings page controller. Requires `requireUser` + `requireTeam` +
 * `requireRole("admin")` — only admins and the owner may view or manage settings.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { AuthSDK } from "@pkg/auth-sdk";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import Invite from "~/app/data/invite";
import Team from "~/app/data/team";
import TeamDomain from "~/app/data/team-domain";
import { getViewer } from "~/app/http/middleware/auth";
import requireRole from "~/app/http/middleware/require-role";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { resolveSubjects } from "~/app/services/subjects";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import SettingsView from "~/resources/views/settings/index";
import routes from "~/routes/web";

/** GET /app/:team/settings — team settings: general, members, domains, danger zone. */
export default createAction(routes.app.team.settings, {
	middleware: [requireUser, requireTeam, requireRole("admin")],
	handler: inject([Database, AuthSDK] as const, async (db, authSdk) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let [members, pendingInvites, domains] = await Promise.all([
			Team.listMembersByTeam(db, ctx.team.id),
			Invite.listPendingByTeam(db, ctx.team.id),
			TeamDomain.listByTeam(db, ctx.team.id),
		]);

		let subjectsById = await resolveSubjects(
			authSdk,
			members.map((member) => member.subject_id),
		);

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · Settings`}>
				<AppShell
					team={ctx.team}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					breadcrumb="Settings"
				>
					<SettingsView
						team={ctx.team}
						members={members}
						subjectsById={subjectsById}
						pendingInvites={pendingInvites}
						domains={domains}
					/>
				</AppShell>
			</DocumentLayout>,
		);
	}),
});
