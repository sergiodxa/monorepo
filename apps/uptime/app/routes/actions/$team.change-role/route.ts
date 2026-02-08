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

const inputSchema = z.object({
	subjectId: z.uuid(),
	name: z.string(),
	currentRole: z.enum(["member", "admin"]),
});

export async function action({ request, context }: Route.ActionArgs) {
	logger().info("action.start", { route: "change-role", method: request.method });

	let result = await validate(request, inputSchema);
	let { t } = i18next(context);

	if (isFailure(result)) {
		logger().info("action.change-role.validation-failed", {
			issues: result.error.issues,
		});
		return badRequest({ message: t("actions.changeRole.errors.generic") });
	}

	if (team().memberships[0].role === "member") {
		logger().info("action.change-role.forbidden", {
			teamId: team().id,
			reason: "member_role",
		});
		return forbidden({ message: t("actions.changeRole.errors.notAllowed") });
	}

	if (team().ownerId === result.data.subjectId) {
		logger().info("action.change-role.forbidden", {
			teamId: team().id,
			reason: "cannot_change_owner",
		});
		return forbidden({
			message: t("actions.changeRole.errors.cannotChangeOwner"),
		});
	}

	let role = result.data.currentRole === "admin" ? ("member" as const) : ("admin" as const);

	await db()
		.update(schema.memberships)
		.set({ role })
		.where(
			and(
				eq(schema.memberships.teamId, team().id),
				eq(schema.memberships.subjectId, result.data.subjectId),
			),
		);

	logger().info("action.change-role.success", {
		teamId: team().id,
		subjectId: result.data.subjectId,
		newRole: role,
	});

	return ok({
		message: t("actions.changeRole.success", {
			role,
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
