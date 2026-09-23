/**
 * API v1 endpoints for the authenticated team's domains: list/add (`team-domains:read`/
 * `team-domains:write`) and remove one by id, given in the JSON body.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Created } from "@sdxc/http/status-code";
import { InvalidCursorError, Pagination } from "@sdxc/pagination";
import { issuesFrom } from "@sdxc/problem";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import { createController } from "remix/router";

import type { SelectTeamDomain } from "~/database/schema";

import TeamDomain from "~/app/data/team-domain";
import catchValidationError from "~/app/http/middleware/catch-validation-error";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { apiProblems, problemInstance } from "~/app/services/api-problems";
import { apiSuccess } from "~/app/services/api-response";
import { apiPage, NEWEST_FIRST, PAGING } from "~/app/services/pagination";
import { encodeId, typedId } from "~/app/services/typed-id";
import { teamDomainsRoutes } from "~/routes/api-groups";

/** Maps a team-domain row to its public camelCase JSON shape. */
function serializeTeamDomain(domain: SelectTeamDomain) {
	return {
		id: encodeId("dom", domain.id),
		hostname: domain.hostname,
		verifiedAt: domain.verified_at,
		teamId: encodeId("team", domain.team_id),
		createdAt: domain.created_at,
		updatedAt: domain.updated_at,
	};
}

const CreateTeamDomainSchema = s.object({
	hostname: s.string().pipe(checks.minLength(1), checks.maxLength(255)),
});

const DeleteTeamDomainSchema = s.object({ id: typedId("dom") });

export default createController(teamDomainsRoutes, {
	middleware: [catchValidationError()],
	actions: {
		/** GET /api/v1/team-domains — lists the team's domains. */
		teamDomainsIndex: {
			middleware: [requireApiKey("team-domains:read")],
			handler: async (ctx) => {
				let params = PAGING.parse(ctx.url.searchParams);
				if (isFailure(params))
					return apiProblems.badRequest({
						detail: params.error.message,
						instance: problemInstance(),
					});

				// Chaining returns new queries, so the same one both counts and pages.
				let query = TeamDomain.listByTeamQuery(ctx.db, ctx.apiTeam.id);

				let page = await Pagination.byKeyset(query, {
					orderBy: NEWEST_FIRST,
					cursor: params.data.cursor,
					limit: params.data.perPage,
				});

				if (isFailure(page)) {
					if (page.error instanceof InvalidCursorError) {
						return apiProblems.badRequest({
							detail: page.error.message,
							instance: problemInstance(),
						});
					}
					return apiProblems.internal({ detail: page.error.message, instance: problemInstance() });
				}

				return apiPage({ teamDomains: page.data.items.map(serializeTeamDomain) }, page.data, {
					url: ctx.url,
					perPage: params.data.perPage,
					total: await query.count(),
				});
			},
		},

		/**
		 * POST /api/v1/team-domains — adds a domain for the team, pending verification. A
		 * hostname the team already added, verified or not, answers 409 `conflict`.
		 */
		teamDomainsCreate: {
			middleware: [requireApiKey("team-domains:write")],
			handler: async (ctx) => {
				let result = await validate(ctx.request, CreateTeamDomainSchema);
				if (isFailure(result)) {
					return apiProblems.validationError({
						instance: problemInstance(),
						extensions: { errors: issuesFrom(result.error) },
					});
				}

				if (await TeamDomain.findByHostnameForTeam(ctx.db, ctx.apiTeam.id, result.data.hostname)) {
					return apiProblems.conflict({
						detail: "This domain was already added to the team",
						instance: problemInstance(),
					});
				}

				let teamDomain = await TeamDomain.create(ctx.db, ctx.apiTeam.id, result.data.hostname);
				return apiSuccess({ teamDomain: serializeTeamDomain(teamDomain) }, Created);
			},
		},

		/** DELETE /api/v1/team-domains — removes a domain by id (given in the JSON body). */
		teamDomainsDestroy: {
			middleware: [requireApiKey("team-domains:write")],
			handler: async (ctx) => {
				let result = await validate(ctx.request, DeleteTeamDomainSchema);
				if (isFailure(result)) {
					return apiProblems.validationError({
						instance: problemInstance(),
						extensions: { errors: issuesFrom(result.error) },
					});
				}

				let teamDomain = await TeamDomain.findByIdForTeam(ctx.db, ctx.apiTeam.id, result.data.id);
				if (!teamDomain)
					return apiProblems.notFound({
						detail: "Team domain not found",
						instance: problemInstance(),
					});

				await TeamDomain.deleteById(ctx.db, result.data.id);
				return apiSuccess({ deleted: true });
			},
		},
	},
});
