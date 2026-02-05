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
import { team } from "~/middleware/team";

import type { Route } from "./+types/route";

const inputSchema = z.object({ subjectId: z.uuid(), name: z.string(), email: z.email() });

export async function action({ request, context }: Route.ActionArgs) {
	let result = await validate(request, inputSchema);
	let { t } = i18next(context);

	if (isFailure(result)) {
		logger().info("action.remove-member.validation-failed", {
			issues: result.error.issues,
		});
		return badRequest({ message: t("actions.removeMember.errors.generic") });
	}

	if (team().memberships[0].role === "member") {
		logger().info("action.remove-member.forbidden", {
			teamId: team().id,
			reason: "member_role",
		});
		return forbidden({ message: t("actions.removeMember.errors.notAllowed") });
	}

	if (team().ownerId === result.data.subjectId) {
		logger().info("action.remove-member.forbidden", {
			teamId: team().id,
			reason: "cannot_remove_owner",
		});
		return forbidden({
			message: t("actions.removeMember.errors.cannotRemoveOwner"),
		});
	}

	await db().batch([
		db()
			.delete(schema.memberships)
			.where(
				and(
					eq(schema.memberships.teamId, team().id),
					eq(schema.memberships.subjectId, result.data.subjectId),
				),
			),
		db()
			.delete(schema.invites)
			.where(
				and(eq(schema.invites.teamId, team().id), eq(schema.invites.email, result.data.email)),
			),
	]);

	logger().info("action.remove-member.success", {
		teamId: team().id,
		subjectId: result.data.subjectId,
	});

	return ok({
		message: t("actions.removeMember.success", {
			team: team().name,
			name: result.data.name,
		}),
	});
}

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	let result = await serverAction();
	if (result.ok) toast.success(result.message);
	else toast.error(result.message);
	return result;
}
