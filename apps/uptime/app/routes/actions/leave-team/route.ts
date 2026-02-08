import { badRequest, forbidden, ok } from "@pkg/response";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { and, eq } from "drizzle-orm";
import { toast } from "sonner";
import { z } from "zod/v4";

import * as schema from "~/db/schema";
import { db } from "~/middleware/drizzle";
import { i18next } from "~/middleware/i18next";
import { logger } from "~/middleware/logger";
import { requireSubject } from "~/middleware/session";

import type { Route } from "./+types/route";

const inputSchema = z.object({
	teamId: z.uuid(),
	teamName: z.string(),
});

export async function action({ request, context }: Route.ActionArgs) {
	logger().info("action.start", { route: "leave-team", method: request.method });

	let result = await validate(request, inputSchema);
	let { t } = i18next(context);
	let subjectId = requireSubject();

	if (isFailure(result)) {
		logger().info("action.leave-team.validation-failed", {
			issues: result.error.issues,
		});
		return badRequest({ message: t("actions.leaveTeam.errors.generic") });
	}

	// Find the membership
	let membership = await db().query.memberships.findFirst({
		where(fields, operators) {
			return operators.and(
				operators.eq(fields.teamId, result.data.teamId),
				operators.eq(fields.subjectId, subjectId),
			);
		},
	});

	if (!membership) {
		logger().info("action.leave-team.membership-not-found", {
			teamId: result.data.teamId,
			subjectId,
		});
		return badRequest({ message: t("actions.leaveTeam.errors.notMember") });
	}

	// Check if the user is an owner or admin - they cannot leave
	let team = await db().query.teams.findFirst({
		where(fields, operators) {
			return operators.eq(fields.id, result.data.teamId);
		},
	});

	if (!team) {
		logger().info("action.leave-team.team-not-found", {
			teamId: result.data.teamId,
		});
		return badRequest({ message: t("actions.leaveTeam.errors.generic") });
	}

	if (team.ownerId === subjectId) {
		logger().info("action.leave-team.forbidden", {
			teamId: result.data.teamId,
			subjectId,
			reason: "owner_cannot_leave",
		});
		return forbidden({ message: t("actions.leaveTeam.errors.ownerCannotLeave") });
	}

	if (membership.role === "admin") {
		logger().info("action.leave-team.forbidden", {
			teamId: result.data.teamId,
			subjectId,
			reason: "admin_cannot_leave",
		});
		return forbidden({ message: t("actions.leaveTeam.errors.adminCannotLeave") });
	}

	// Delete the membership
	await db()
		.delete(schema.memberships)
		.where(
			and(
				eq(schema.memberships.teamId, result.data.teamId),
				eq(schema.memberships.subjectId, subjectId),
			),
		);

	logger().info("action.leave-team.success", {
		teamId: result.data.teamId,
		subjectId,
	});

	return ok({
		message: t("actions.leaveTeam.success", {
			team: result.data.teamName,
		}),
	});
}

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	let result = await serverAction();
	if (result.ok) toast.success(result.message);
	else toast.error(result.message);
	return result;
}
