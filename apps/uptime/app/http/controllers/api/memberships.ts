/**
 * API v1 endpoint listing the authenticated team's memberships, requiring
 * `teams:read` via `requireApiKey`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { InvalidCursorError, Pagination } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import requireApiKey from "~/app/http/middleware/require-api-key";
import { apiProblems, problemInstance } from "~/app/services/api-problems";
import { apiPage, NEWEST_FIRST, PAGING } from "~/app/services/pagination";
import { encodeId } from "~/app/services/typed-id";
import routes from "~/routes/web";

/** GET /api/v1/memberships — lists the team's memberships. */
export const membershipsIndex = createAction(routes.api.v1.memberships, {
	middleware: [requireApiKey("teams:read")],
	handler: async (ctx) => {
		let params = PAGING.parse(ctx.url.searchParams);
		if (isFailure(params))
			return apiProblems.badRequest({ detail: params.error.message, instance: problemInstance() });

		let query = ctx.models.memberships.inTeam(ctx.apiTeam.id);

		/**
		 * The ordering is left off the query deliberately: `Pagination.byKeyset()` owns it,
		 * because it needs the sort keys both to seek and to mint the cursor.
		 */
		let page = await Pagination.byKeyset(query, {
			orderBy: NEWEST_FIRST,
			cursor: params.data.cursor,
			limit: params.data.perPage,
		});

		if (isFailure(page)) {
			if (page.error instanceof InvalidCursorError) {
				return apiProblems.badRequest({ detail: page.error.message, instance: problemInstance() });
			}
			return apiProblems.internal({ detail: page.error.message, instance: problemInstance() });
		}

		return apiPage(
			{
				memberships: page.data.items.map((membership) => ({
					id: encodeId("mem", membership.id),
					subjectId: encodeId("usr", membership.subject_id),
					teamId: encodeId("team", membership.team_id),
					role: membership.role,
					createdAt: membership.created_at,
					updatedAt: membership.updated_at,
				})),
			},
			page.data,
			{
				url: ctx.url,
				perPage: params.data.perPage,
				total: await query.count(),
			},
		);
	},
});
