/**
 * API v1 collection endpoints for team invites: `GET /api/v1/invites` lists every
 * invite (pending and accepted) and `POST /api/v1/invites` creates a pending one.
 * Requires `invites:read`/`invites:write` via `requireApiKey`. Creating an invite
 * only inserts the row.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Created } from "@sdxc/http/status-code";
import { InvalidCursorError, Pagination } from "@sdxc/pagination";
import { issuesFrom } from "@sdxc/problem";
import { isFailure, unwrap } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createController } from "remix/router";

import type { SelectInvite } from "~/database/schema";

import catchValidationError from "~/app/http/middleware/catch-validation-error";
import idempotent from "~/app/http/middleware/idempotency";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { CREATE_INVITE_BODY } from "~/app/http/openapi/team";
import { apiProblems, problemInstance } from "~/app/services/api-problems";
import { apiSuccess } from "~/app/services/api-response";
import { refuseUndeliverableRecipient } from "~/app/services/email-address";
import { apiPage, NEWEST_FIRST, PAGING } from "~/app/services/pagination";
import { encodeId } from "~/app/services/typed-id";
import { invitesRoutes } from "~/routes/api-groups";

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

export default createController(invitesRoutes, {
	middleware: [catchValidationError()],
	actions: {
		/** GET /api/v1/invites — lists every invite (pending and accepted) for the team. */
		invitesIndex: {
			middleware: [requireApiKey("invites:read")],
			handler: async (ctx) => {
				let params = PAGING.parse(ctx.url.searchParams);
				if (isFailure(params))
					return apiProblems.badRequest({
						detail: params.error.message,
						instance: problemInstance(),
					});

				// Chaining returns new queries, so the same one both counts and pages.
				let query = ctx.models.invites.inTeam(ctx.apiTeam.id);

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

				return apiPage({ invites: page.data.items.map(serializeInvite) }, page.data, {
					url: ctx.url,
					perPage: params.data.perPage,
					total: await query.count(),
				});
			},
		},

		/**
		 * POST /api/v1/invites — creates a pending invite for the team. An email the team has
		 * already invited, pending or accepted, answers 409 `conflict` and sends nothing.
		 */
		invitesCreate: {
			middleware: [requireApiKey("invites:write"), idempotent],
			handler: async (ctx) => {
				let result = await validate(ctx.request, CREATE_INVITE_BODY);
				if (isFailure(result)) {
					return apiProblems.validationError({
						instance: problemInstance(),
						extensions: { errors: issuesFrom(result.error) },
					});
				}

				let undeliverable = await refuseUndeliverableRecipient(result.data.email, "/email");
				if (undeliverable) return undeliverable;

				if (
					await ctx.models.invites
						.inTeam(ctx.apiTeam.id)
						.where({ email: result.data.email })
						.first()
				) {
					return apiProblems.conflict({
						detail: "An invite for this email already exists",
						instance: problemInstance(),
					});
				}

				let invite = unwrap(
					await ctx.models.invites.create({
						team_id: ctx.apiTeam.id,
						sender_id: ctx.apiTeam.owner_id,
						email: result.data.email,
					}),
				);
				return apiSuccess({ invite: serializeInvite(invite) }, Created);
			},
		},
	},
});
