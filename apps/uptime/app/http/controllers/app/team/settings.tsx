/**
 * Team settings page controller, gated behind `requireUser`, `requireTeam`, and
 * `requireAbility(abilities.team.update)`. One route laid out as a settings area: a section nav
 * of in-page anchors beside the team's profile, members, invites, domains, billing and danger zone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { requireAbility } from "@sdxc/authz/middleware/router";
import { createAction } from "remix/router";
import { Session } from "remix/session";

import type { TeamSettingsToast } from "~/resources/views/settings/settings-page";

import { teamAccess } from "~/app/http/middleware/access";
import { admin } from "~/app/http/middleware/admin";
import appShellData from "~/app/http/middleware/app-shell-data";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { createManagementClient } from "~/app/initializers/management-client";
import abilities from "~/app/policies/abilities";
import { loadTeamSettings } from "~/app/services/team-settings";
import TeamSettingsPage from "~/resources/views/settings/settings-page";
import routes from "~/routes/web";

/** GET /app/:team/settings — the team's settings area. The members table needs `ctx.admin` to name each member. */
export default createAction(routes.app.team.settings, {
	middleware: [
		requireUser,
		requireTeam,
		appShellData(),
		teamAccess,
		requireAbility(abilities.team.update),
		admin(createManagementClient),
	],
	handler: async (ctx) => {
		let settings = await loadTeamSettings(ctx.models, ctx.admin, ctx.team);
		let toast = ctx.get(Session)?.get("toast") as TeamSettingsToast | undefined;
		return ctx.render(<TeamSettingsPage settings={settings} toast={toast} />);
	},
});
