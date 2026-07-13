/**
 * API v1 endpoints for the authenticated team's domains: list/add (`team-domains:read`/
 * `team-domains:write`) and remove one by id, given in the JSON body rather than as a
 * route param.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BadRequest, Created, NotFound } from "@pkg/http/status-code";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import { Database } from "remix/data-table";
import { createController } from "remix/fetch-router";

import type { SelectTeamDomain } from "~/database/schema";

import TeamDomain from "~/app/data/team-domain";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { apiError, apiSuccess } from "~/app/services/api-response";
import routes from "~/routes/web";

/** Maps a team-domain row to its public camelCase JSON shape. */
function serializeTeamDomain(domain: SelectTeamDomain) {
	return {
		id: domain.id,
		hostname: domain.hostname,
		verifiedAt: domain.verified_at,
		teamId: domain.team_id,
		createdAt: domain.created_at,
		updatedAt: domain.updated_at,
	};
}

const CreateTeamDomainSchema = s.object({
	hostname: s.string().pipe(checks.minLength(1), checks.maxLength(255)),
});

const DeleteTeamDomainSchema = s.object({ id: s.string() });

/** Route leaves this controller handles, grouped for a single `router.map()` call. */
export const teamDomainsRoutes = {
	teamDomainsIndex: routes.api.v1.teamDomains.index,
	teamDomainsCreate: routes.api.v1.teamDomains.create,
	teamDomainsDestroy: routes.api.v1.teamDomains.destroy,
};

export default createController(teamDomainsRoutes, {
	actions: {
		/** GET /api/v1/team-domains — lists the team's domains. */
		teamDomainsIndex: {
			middleware: [requireApiKey("team-domains:read")],
			handler: async (ctx) => {
				let db = getServiceContainer().get(Database);
				let teamDomains = await TeamDomain.listByTeam(db, ctx.apiTeam.id);
				return apiSuccess({ teamDomains: teamDomains.map(serializeTeamDomain) });
			},
		},

		/** POST /api/v1/team-domains — adds a domain for the team, pending verification. */
		teamDomainsCreate: {
			middleware: [requireApiKey("team-domains:write")],
			handler: async (ctx) => {
				let result = await validate(ctx.request, CreateTeamDomainSchema);
				if (isFailure(result)) {
					return apiError(
						"VALIDATION_ERROR",
						result.error.issues.map((issue) => issue.message).join(", "),
						BadRequest,
					);
				}

				let db = getServiceContainer().get(Database);
				let teamDomain = await TeamDomain.create(db, ctx.apiTeam.id, result.data.hostname);
				return apiSuccess({ teamDomain: serializeTeamDomain(teamDomain) }, Created);
			},
		},

		/** DELETE /api/v1/team-domains — removes a domain by id (given in the JSON body). */
		teamDomainsDestroy: {
			middleware: [requireApiKey("team-domains:write")],
			handler: async (ctx) => {
				let result = await validate(ctx.request, DeleteTeamDomainSchema);
				if (isFailure(result)) {
					return apiError(
						"VALIDATION_ERROR",
						result.error.issues.map((issue) => issue.message).join(", "),
						BadRequest,
					);
				}

				let db = getServiceContainer().get(Database);
				let teamDomain = await TeamDomain.findByIdForTeam(db, ctx.apiTeam.id, result.data.id);
				if (!teamDomain) return apiError("NOT_FOUND", "Team domain not found", NotFound);

				await TeamDomain.deleteById(db, result.data.id);
				return apiSuccess({ deleted: true });
			},
		},
	},
});
