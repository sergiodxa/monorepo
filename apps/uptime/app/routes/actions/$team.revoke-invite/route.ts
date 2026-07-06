/**
 * Route module for the team "revoke invite" action. Validates the invite id, requires a
 * non-member role, looks up the invite, refuses to revoke one already accepted, and
 * deletes the pending invite. Exists so team admins can cancel an outstanding invitation
 * before it is accepted.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { badRequest, forbidden, notFound, ok } from "@pkg/response";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { eq } from "drizzle-orm";
import { toast } from "sonner";
import { z } from "zod/v4";

import * as schema from "~/db/schema";
import { db } from "~/middleware/drizzle";
import { i18next } from "~/middleware/i18next";
import { logger } from "~/middleware/logger";
import { team } from "~/middleware/team";

import type { Route } from "./+types/route";

const inputSchema = z.object({ inviteId: z.uuid() });

export async function action({ request, context }: Route.ActionArgs) {
	logger().info("action.start", { route: "revoke-invite", method: request.method });

	let result = await validate(request, inputSchema);
	let { t } = i18next(context);

	if (isFailure(result)) {
		logger().info("action.revoke-invite.validation-failed", {
			issues: result.error.issues,
		});
		return badRequest({ message: t("actions.revokeInvite.errors.generic") });
	}

	if (team().memberships[0].role === "member") {
		logger().info("action.revoke-invite.forbidden", {
			teamId: team().id,
			reason: "member_role",
		});
		return forbidden({
			message: t("actions.revokeInvite.errors.notAllowed"),
		});
	}

	let invite = await db().query.invites.findFirst({
		where(fields, operators) {
			return operators.eq(fields.id, result.data.inviteId);
		},
	});

	if (!invite) {
		logger().info("action.revoke-invite.not-found", {
			inviteId: result.data.inviteId,
		});
		return notFound({
			message: t("actions.revokeInvite.errors.notFound", {
				team: team().name,
			}),
		});
	}

	if (invite.acceptedAt !== null) {
		logger().info("action.revoke-invite.already-accepted", {
			teamId: team().id,
			inviteId: invite.id,
		});
		return badRequest({
			message: t("actions.revokeInvite.errors.alreadyAccepted", {
				team: team().name,
			}),
		});
	}

	await db().delete(schema.invites).where(eq(schema.invites.id, invite.id));

	logger().info("action.revoke-invite.success", {
		teamId: team().id,
		inviteId: invite.id,
		email: invite.email,
	});

	return ok({
		message: t("actions.revokeInvite.success", {
			team: team().name,
			email: invite.email,
		}),
	});
}

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	let result = await serverAction();
	if (result.ok) toast.success(result.message);
	else toast.error(result.message);
	return result;
}
