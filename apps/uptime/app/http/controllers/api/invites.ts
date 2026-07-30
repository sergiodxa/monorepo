/**
 * API v1 collection endpoints for team invites: `GET /api/v1/invites` lists every
 * invite (pending and accepted) and `POST /api/v1/invites` creates a pending one.
 * Requires `invites:read`/`invites:write` via `requireApiKey`. Unlike the web invite
 * flow, this only inserts the row and does not send an email.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BadRequest, Created } from "@pkg/http/status-code";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import { Database } from "remix/data-table";
import { createController } from "remix/fetch-router";

import type { SelectInvite } from "~/database/schema";

import Invite from "~/app/data/invite";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { apiError, apiSuccess } from "~/app/services/api-response";
import routes from "~/routes/web";

/** Maps an invite row to its public camelCase JSON shape. */
function serializeInvite(invite: SelectInvite) {
	return {
		id: invite.id,
		email: invite.email,
		senderId: invite.sender_id,
		teamId: invite.team_id,
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
	actions: {
		/** GET /api/v1/invites — lists every invite (pending and accepted) for the team. */
		invitesIndex: {
			middleware: [requireApiKey("invites:read")],
			handler: async (ctx) => {
				let db = getServiceContainer().get(Database);
				let invites = await Invite.listByTeam(db, ctx.apiTeam.id);
				return apiSuccess({ invites: invites.map(serializeInvite) });
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
