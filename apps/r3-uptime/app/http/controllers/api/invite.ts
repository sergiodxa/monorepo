/**
 * API v1 endpoint that deletes a single pending team invite, requiring
 * `invites:write` via `requireApiKey`. Rejects deleting an already-accepted invite.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BadRequest, NotFound } from "@pkg/http/status-code";
import { getServiceContainer } from "@pkg/service-container";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import Invite from "~/app/data/invite";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { apiError, apiSuccess } from "~/app/services/api-response";
import routes from "~/routes/web";

const InviteIdParams = s.object({ inviteId: s.string() });

/** DELETE /api/v1/invites/:inviteId — revokes a pending invite. */
export const inviteDestroy = createAction(routes.api.v1.inviteDestroy, {
	middleware: [requireApiKey("invites:write")],
	handler: async (ctx) => {
		let { inviteId } = s.parse(InviteIdParams, ctx.params);
		let db = getServiceContainer().get(Database);
		let invite = await Invite.findByIdForTeam(db, ctx.apiTeam.id, inviteId);
		if (!invite) return apiError("NOT_FOUND", "Invite not found", NotFound);
		if (invite.accepted_at !== null) {
			return apiError("VALIDATION_ERROR", "This invite was already accepted.", BadRequest);
		}

		await Invite.revoke(db, inviteId);
		return apiSuccess({ deleted: true });
	},
});
