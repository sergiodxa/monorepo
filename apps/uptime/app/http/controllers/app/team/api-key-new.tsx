/**
 * New API key page controller. Requires `requireUser` + `requireTeam` +
 * `requireAbility(abilities.apiKeys.write)`; the create action draws the same page again with a
 * rejected submission, so nothing typed or checked is lost.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { requireAbility } from "@sdxc/authz/middleware/router";
import { createAction } from "remix/router";

import { teamAccess } from "~/app/http/middleware/access";
import appShellData from "~/app/http/middleware/app-shell-data";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import abilities from "~/app/policies/abilities";
import NewApiKeyPage from "~/resources/views/api-keys/new-api-key-page";
import routes from "~/routes/web";

/** GET /app/:team/api-keys/new — the new API key form, empty on a first visit. */
export default createAction(routes.app.team.apiKeys.new, {
	middleware: [
		requireUser,
		requireTeam,
		appShellData(),
		teamAccess,
		requireAbility(abilities.apiKeys.write),
	],
	handler: (ctx) => ctx.render(<NewApiKeyPage />),
});
