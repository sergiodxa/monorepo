/**
 * Route module for the team "create invite" action. Validates the invitee email,
 * requires a non-member role, reuses or creates an invite for the current team, and
 * sends a TeamInviteEmail via Resend with a link to accept. Exists so team admins can
 * invite new members and resend pending invitations.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { badRequest, forbidden, ok } from "@pkg/response";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { waitUntil } from "cloudflare:workers";
import { href } from "react-router";
import { toast } from "sonner";
import { z } from "zod/v4";

import resend from "~/clients/resend";
import { TeamInviteEmail } from "~/components/emails/team-invite";
import * as schema from "~/db/schema";
import { db } from "~/middleware/drizzle";
import { i18next } from "~/middleware/i18next";
import { logger } from "~/middleware/logger";
import { subject } from "~/middleware/subject";
import { team } from "~/middleware/team";

import type { Route } from "./+types/route";

const inputSchema = z.object({ email: z.email() });

export async function action({ request, context }: Route.ActionArgs) {
	logger().info("action.start", { route: "create-invite", method: request.method });

	let result = await validate(request, inputSchema);
	let { t } = i18next(context);

	if (isFailure(result)) {
		logger().info("action.create-invite.validation-failed", {
			issues: result.error.issues,
		});
		return badRequest({ message: t("actions.createInvite.errors.generic") });
	}

	if (team().memberships[0].role === "member") {
		logger().info("action.create-invite.forbidden", {
			teamId: team().id,
			reason: "member_role",
		});
		return forbidden({
			message: t("actions.createInvite.errors.notAllowed"),
		});
	}

	let invite = await db().query.invites.findFirst({
		where(fields, operators) {
			return operators.and(
				operators.eq(fields.email, result.data.email),
				operators.eq(fields.teamId, team().id),
			);
		},
	});

	if (invite) {
		if (invite.acceptedAt !== null) {
			logger().info("action.create-invite.already-accepted", {
				teamId: team().id,
				email: result.data.email,
			});
			return badRequest({
				message: t("actions.createInvite.errors.alreadyAccepted", {
					team: team().name,
				}),
				errors: { email: t("actions.createInvite.errors.alreadyAccepted") },
			});
		}

		logger().info("action.create-invite.resent", {
			teamId: team().id,
			email: result.data.email,
		});
		return ok({
			invite,
			message: t("actions.createInvite.success", {
				team: team().name,
				email: result.data.email,
			}),
		});
	}

	[invite] = await db()
		.insert(schema.invites)
		.values({
			email: result.data.email,
			teamId: team().id,
			senderId: subject().id,
		})
		.returning();

	if (invite) {
		waitUntil(
			resend.emails.send({
				to: result.data.email,
				from: "Uptime <no-reply@uptime.sergiodxa.com>",
				replyTo: "hello@sergiodxa.com",
				subject: t("actions.createInvite.email.subject", {
					team: team().name,
				}),
				react: (
					<TeamInviteEmail
						team={team().name}
						url={new URL(href("/invite/:inviteId", { inviteId: invite.id }), request.url)}
					/>
				),
			}),
		);

		logger().info("action.create-invite.success", {
			teamId: team().id,
			inviteId: invite.id,
			email: result.data.email,
		});

		return ok({
			message: t("actions.createInvite.success", {
				team: team().name,
				email: result.data.email,
			}),
		});
	}

	logger().error("action.create-invite.insert-failed", {
		teamId: team().id,
		email: result.data.email,
	});
	return badRequest({ message: t("actions.createInvite.errors.generic") });
}

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	let result = await serverAction();
	if (result.ok) toast.success(result.message);
	else toast.error(result.message);
	return result;
}
