/**
 * API v1 collection endpoints for team invites: `GET /api/v1/invites` lists every
 * invite (pending and accepted) and `POST /api/v1/invites` creates a pending one.
 * Requires `invites:read`/`invites:write` via `requireApiKey`. Creating an invite
 * only inserts the row.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BadRequest, Created, InternalServerError } from "@sdxc/http/status-code";
import { InvalidCursorError, Pagination } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";
import { getServiceContainer } from "@sdxc/service-container";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import { Database } from "remix/data-table";
import { createController } from "remix/router";

import type { SelectInvite } from "~/database/schema";

import Invite from "~/app/data/invite";
import catchValidationError from "~/app/http/middleware/catch-validation-error";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { apiError, apiSuccess } from "~/app/services/api-response";
import { apiPage, NEWEST_FIRST, PAGING } from "~/app/services/pagination";
import { encodeId } from "~/app/services/typed-id";
import routes from "~/routes/web";

/** Maps an invite row to its public camelCase JSON shape. */
function serializeInvite(invite: SelectInvite) {
	return {
		id: encodeId("inv", invite.id),
		email: invite.email,
		senderId: encodeId("usr", invite.sender_id),
		teamId: encodeId("team", invite.team_id),
		acceptedAt: invite.accepted_at,
		createdAt: invite.created_at,
		updatedAt: invite.updated_at,
	};
}

const CreateInviteSchema = s.object({ email: s.string().pipe(checks.email()) });

/** Route leaves this controller handles, grouped for a single `router.map()` call. */
export const invitesRoutes = {
	invitesIndex: routes.api.v1.invites.index,
	invitesCreate: routes.api.v1.invites.create,
};

export default createController(invitesRoutes, {
	middleware: [catchValidationError()],
	actions: {
		/** GET /api/v1/invites — lists every invite (pending and accepted) for the team. */
		invitesIndex: {
			middleware: [requireApiKey("invites:read")],
			handler: async (ctx) => {
				let db = getServiceContainer().get(Database);

				let params = PAGING.parse(ctx.url.searchParams);
				if (isFailure(params)) return apiError("BAD_REQUEST", params.error.message, BadRequest);

				// Chaining returns new queries, so the same one both counts and pages.
				let query = Invite.listByTeamQuery(db, ctx.apiTeam.id);

				let page = await Pagination.byKeyset(query, {
					orderBy: NEWEST_FIRST,
					cursor: params.data.cursor,
					limit: params.data.perPage,
				});

				if (isFailure(page)) {
					if (page.error instanceof InvalidCursorError) {
						return apiError("BAD_REQUEST", page.error.message, BadRequest);
					}
					return apiError("INTERNAL", page.error.message, InternalServerError);
				}

				return apiPage({ invites: page.data.items.map(serializeInvite) }, page.data, {
					url: ctx.url,
					perPage: params.data.perPage,
					total: await query.count(),
				});
			},
		},

		/** POST /api/v1/invites — creates a pending invite for the team. */
		invitesCreate: {
			middleware: [requireApiKey("invites:write")],
			handler: async (ctx) => {
				let result = await validate(ctx.request, CreateInviteSchema);
				if (isFailure(result)) {
					return apiError(
						"VALIDATION_ERROR",
						result.error.issues.map((issue) => issue.message).join(", "),
						BadRequest,
					);
				}

				let db = getServiceContainer().get(Database);
				let invite = await Invite.create(
					db,
					ctx.apiTeam.id,
					ctx.apiTeam.owner_id,
					result.data.email,
				);
				return apiSuccess({ invite: serializeInvite(invite) }, Created);
			},
		},
	},
});
