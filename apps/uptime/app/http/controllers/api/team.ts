/**
 * API v1 endpoints for the authenticated team: `GET /api/v1/team` reads its profile
 * (`teams:read`) and `PUT /api/v1/team` updates its name and/or logo (`teams:write`).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { issuesFrom } from "@sdxc/problem";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createController } from "remix/router";

import type { InsertTeam, SelectTeam } from "~/database/schema";

import Team from "~/app/data/team";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { UPDATE_TEAM_BODY } from "~/app/http/openapi/team";
import { apiProblems, problemInstance } from "~/app/services/api-problems";
import { apiSuccess } from "~/app/services/api-response";
import { encodeId } from "~/app/services/typed-id";
import { teamRoutes } from "~/routes/api-groups";

/** Maps a team row to its public camelCase JSON shape. */
function serializeTeam(team: SelectTeam) {
	return {
		id: encodeId("team", team.id),
		name: team.name,
		slug: team.slug,
		logo: team.logo,
		ownerId: encodeId("usr", team.owner_id),
		createdAt: team.created_at,
		updatedAt: team.updated_at,
	};
}

export default createController(teamRoutes, {
	actions: {
		/** GET /api/v1/team — the authenticated team's profile. */
		teamShow: {
			middleware: [requireApiKey("teams:read")],
			handler: async (ctx) => {
				return apiSuccess({ team: serializeTeam(ctx.apiTeam) });
			},
		},

		/** PUT /api/v1/team — updates the authenticated team's name and/or logo. */
		teamUpdate: {
			middleware: [requireApiKey("teams:write")],
			handler: async (ctx) => {
				let result = await validate(ctx.request, UPDATE_TEAM_BODY);
				if (isFailure(result)) {
					return apiProblems.validationError({
						instance: problemInstance(),
						extensions: { errors: issuesFrom(result.error) },
					});
				}

				let changes: Partial<InsertTeam> = {};
				if (result.data.name !== undefined) changes.name = result.data.name;
				if (result.data.logoUrl !== undefined) changes.logo = result.data.logoUrl;

				let team = await Team.updateById(ctx.db, ctx.apiTeam.id, changes);
				return apiSuccess({ team: serializeTeam(team) });
			},
		},
	},
});
