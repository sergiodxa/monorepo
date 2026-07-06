/**
 * Route module for the team "delete status page" action. Validates the status page id,
 * confirms it belongs to the current team, removes its monitor associations, and then
 * deletes the status page itself. Exists so teams can tear down a public status page
 * and its links cleanly with localized feedback.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { badRequest, ok } from "@pkg/response";
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

const inputSchema = z.object({
	statusPageId: z.uuid(),
});

export async function action({ request, context }: Route.ActionArgs) {
	logger().info("action.start", { route: "delete-status-page", method: request.method });

	let result = await validate(request, inputSchema);
	let { t } = i18next(context);

	if (isFailure(result)) {
		logger().info("action.delete-status-page.validation-failed", {
			issues: result.error.issues,
		});
		return badRequest({ message: t("actions.deleteStatusPage.errors.generic") });
	}

	let existingStatusPage = await db().query.statusPages.findFirst({
		where(fields, operators) {
			return operators.and(
				operators.eq(fields.id, result.data.statusPageId),
				operators.eq(fields.teamId, team().id),
			);
		},
	});

	if (!existingStatusPage) {
		logger().info("action.delete-status-page.not-found", {
			statusPageId: result.data.statusPageId,
		});
		return badRequest({ message: t("actions.deleteStatusPage.errors.notFound") });
	}

	await db()
		.delete(schema.statusPageMonitors)
		.where(eq(schema.statusPageMonitors.statusPageId, result.data.statusPageId));

	await db().delete(schema.statusPages).where(eq(schema.statusPages.id, result.data.statusPageId));

	logger().info("action.delete-status-page.success", {
		teamId: team().id,
		statusPageId: result.data.statusPageId,
	});

	return ok({
		message: t("actions.deleteStatusPage.success"),
	});
}

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	let result = await serverAction();
	if (result.ok) toast.success(result.message);
	else toast.error(result.message);
	return result;
}
