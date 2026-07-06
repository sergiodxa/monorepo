/**
 * Route action that deletes an API key belonging to the current team. It validates the
 * incoming apiKeyId, verifies the key is actually owned by this team before deleting,
 * and reports a not-found error otherwise. This guards key deletion against cross-team
 * access and keeps the destructive operation scoped to the requesting team.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { badRequest, notFound, ok } from "@pkg/response";
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
	apiKeyId: z.uuid(),
});

export async function action({ request, context }: Route.ActionArgs) {
	logger().info("action.start", { route: "delete-api-key", method: request.method });

	let result = await validate(request, inputSchema);
	let { t } = i18next(context);

	if (isFailure(result)) {
		logger().info("action.delete-api-key.validation-failed", {
			issues: result.error.issues,
		});
		return badRequest({ message: t("actions.deleteApiKey.errors.generic") });
	}

	// Verify the API key belongs to this team
	let apiKey = await db().query.apiKeys.findFirst({
		where(fields, operators) {
			return operators.and(
				operators.eq(fields.id, result.data.apiKeyId),
				operators.eq(fields.teamId, team().id),
			);
		},
	});

	if (!apiKey) {
		logger().info("action.delete-api-key.not-found", {
			teamId: team().id,
			apiKeyId: result.data.apiKeyId,
		});
		return notFound({ message: t("actions.deleteApiKey.errors.notFound") });
	}

	await db().delete(schema.apiKeys).where(eq(schema.apiKeys.id, result.data.apiKeyId));

	logger().info("action.delete-api-key.success", {
		teamId: team().id,
		apiKeyId: apiKey.id,
		name: apiKey.name,
	});

	return ok({
		message: t("actions.deleteApiKey.success", { name: apiKey.name }),
	});
}

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	let result = await serverAction();
	if (result.ok) {
		toast.success(result.message);
	} else {
		toast.error(result.message);
	}
	return result;
}
