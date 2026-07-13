/**
 * API v1 endpoints for the authenticated team: `GET /api/v1/team` reads its profile
 * (`teams:read`) and `PUT /api/v1/team` updates its name and/or logo (`teams:write`).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BadRequest } from "@pkg/http/status-code";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import { Database } from "remix/data-table";
import { createController } from "remix/fetch-router";

import type { InsertTeam, SelectTeam } from "~/database/schema";

import Team from "~/app/data/team";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { apiError, apiSuccess } from "~/app/services/api-response";
import routes from "~/routes/web";

/** Maps a team row to the OLD APP's exact camelCase JSON shape. */
function serializeTeam(team: SelectTeam) {
	return {
		id: team.id,
		name: team.name,
		slug: team.slug,
		logo: team.logo,
		ownerId: team.owner_id,
		createdAt: team.created_at,
		updatedAt: team.updated_at,
	};
}

const UpdateTeamSchema = s
	.object({
		name: s.optional(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
		logoUrl: s.optional(s.string().pipe(checks.url())),
	})
	.refine(
		(value) => value.name !== undefined || value.logoUrl !== undefined,
		"At least one field must be provided",
	);

/** Route leaves this controller handles, grouped for a single `router.map()` call. */
export const teamRoutes = {
	teamShow: routes.api.v1.teamShow,
	teamUpdate: routes.api.v1.teamUpdate,
};

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
				let result = await validate(ctx.request, UpdateTeamSchema);
				if (isFailure(result)) {
					return apiError(
						"VALIDATION_ERROR",
						result.error.issues.map((issue) => issue.message).join(", "),
						BadRequest,
					);
				}

				let changes: Partial<InsertTeam> = {};
				if (result.data.name !== undefined) changes.name = result.data.name;
				if (result.data.logoUrl !== undefined) changes.logo = result.data.logoUrl;

				let db = getServiceContainer().get(Database);
				let team = await Team.updateById(db, ctx.apiTeam.id, changes);
				return apiSuccess({ team: serializeTeam(team) });
			},
		},
	},
});
