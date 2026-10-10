/**
 * API v1 endpoints for the authenticated team: `GET /api/v1/team` reads its profile
 * (`teams:read`); `PATCH /api/v1/team` merge-patches its name and/or logo and `PUT` updates
 * them (`teams:write`).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import { issuesFrom } from "@sdxc/problem";
import { isFailure, unwrap } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createController } from "remix/router";

import type { InsertTeam, SelectTeam } from "~/database/schema";

import requireApiKey from "~/app/http/middleware/require-api-key";
import { UPDATE_TEAM_BODY, WRITABLE_TEAM } from "~/app/http/openapi/team";
import { teamLogoUrl } from "~/app/lib/team-logo";
import { apiProblems, problemInstance } from "~/app/services/api-problems";
import { apiSuccess } from "~/app/services/api-response";
import { readApiUpdate } from "~/app/services/api-update";
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

/**
 * The team's writable members as the API reads them, the target a `PATCH` merge patch
 * applies to. A stored logo that is not an https URL (legacy rows saved before the rule) is
 * left out, so a patch leaving `logoUrl` alone validates and keeps it.
 */
function writableTeam(team: SelectTeam) {
	return {
		name: team.name,
		logoUrl: teamLogoUrl(team.logo),
	};
}

/**
 * Applies a `PATCH` merge patch to the calling key's team, writing only the members the
 * patch changed; a removed `logoUrl` clears the logo.
 *
 * @param ctx - The request, after `requireApiKey("teams:write")`.
 * @returns The updated team, or the patch's `415`/`400` problem.
 */
async function patchTeam(ctx: RequestContext): Promise<Response> {
	let update = await readApiUpdate(ctx.request, writableTeam(ctx.apiTeam), WRITABLE_TEAM);
	if (update instanceof Response) return update;
	let { value, changed } = update;

	let changes: Partial<InsertTeam> = {};
	if (changed.has("name")) changes.name = value.name;
	if (changed.has("logoUrl")) changes.logo = value.logoUrl ?? null;

	let team = unwrap(await ctx.models.teams.update(ctx.apiTeam.id, changes));
	return apiSuccess({ team: serializeTeam(team) });
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

		/** PATCH /api/v1/team — merge-patches the authenticated team. */
		teamPatch: {
			middleware: [requireApiKey("teams:write")],
			handler: patchTeam,
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

				let team = unwrap(await ctx.models.teams.update(ctx.apiTeam.id, changes));
				return apiSuccess({ team: serializeTeam(team) });
			},
		},
	},
});
