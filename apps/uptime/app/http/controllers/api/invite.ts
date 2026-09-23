/**
 * API v1 endpoint that deletes a single pending team invite, requiring
 * `invites:write` via `requireApiKey`. Rejects deleting an already-accepted invite.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import Invite from "~/app/data/invite";
import catchValidationError from "~/app/http/middleware/catch-validation-error";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { apiProblems, invalidField, problemInstance } from "~/app/services/api-problems";
import { apiSuccess } from "~/app/services/api-response";
import { typedId } from "~/app/services/typed-id";
import routes from "~/routes/web";

const InviteIdParams = s.object({ inviteId: typedId("inv") });

/** DELETE /api/v1/invites/:inviteId — revokes a pending invite. */
export const inviteDestroy = createAction(routes.api.v1.invites.destroy, {
	middleware: [catchValidationError(), requireApiKey("invites:write")],
	handler: async (ctx) => {
		let { inviteId } = s.parse(InviteIdParams, ctx.params);
		let invite = await Invite.findByIdForTeam(ctx.db, ctx.apiTeam.id, inviteId);
		if (!invite)
			return apiProblems.notFound({ detail: "Invite not found", instance: problemInstance() });
		if (invite.accepted_at !== null) {
			return invalidField("This invite was already accepted.");
		}

		await Invite.revoke(ctx.db, inviteId);
		return apiSuccess({ deleted: true });
	},
});
