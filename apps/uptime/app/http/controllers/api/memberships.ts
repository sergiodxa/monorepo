/**
 * API v1 endpoint listing the authenticated team's memberships, requiring
 * `teams:read` via `requireApiKey`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { getServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import Team from "~/app/data/team";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { apiSuccess } from "~/app/services/api-response";
import routes from "~/routes/web";

/** GET /api/v1/memberships — lists the team's memberships. */
export const membershipsIndex = createAction(routes.api.v1.memberships, {
	middleware: [requireApiKey("teams:read")],
	handler: async (ctx) => {
		let db = getServiceContainer().get(Database);
		let memberships = await Team.listMembersByTeam(db, ctx.apiTeam.id);

		return apiSuccess({
			memberships: memberships.map((membership) => ({
				id: membership.id,
				subjectId: membership.subject_id,
				teamId: membership.team_id,
				role: membership.role,
				createdAt: membership.created_at,
				updatedAt: membership.updated_at,
			})),
		});
	},
});
