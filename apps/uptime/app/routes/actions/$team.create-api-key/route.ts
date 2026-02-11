import { badRequest, created } from "@pkg/response";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { count, eq } from "drizzle-orm";
import { toast } from "sonner";
import { z } from "zod/v4";

import * as schema from "~/db/schema";
import { generateApiKey } from "~/middleware/api-auth";
import { db } from "~/middleware/drizzle";
import { i18next } from "~/middleware/i18next";
import { logger } from "~/middleware/logger";
import { team } from "~/middleware/team";

import type { Route } from "./+types/route";

const scopeEnum = z.enum(schema.apiKeyScopes);

const inputSchema = z.object({
	name: z.string().min(1).max(255),
	scopes: z
		.union([scopeEnum.transform((v) => [v]), z.array(scopeEnum)])
		.pipe(z.array(scopeEnum).min(1)),
	expiresAt: z.preprocess(
		(val) => (val === "" || val === null || val === undefined ? undefined : val),
		z.coerce.date().optional(),
	),
});

export async function action({ request, context }: Route.ActionArgs) {
	logger().info("action.start", { route: "create-api-key", method: request.method });

	let result = await validate(request, inputSchema);
	let { t } = i18next(context);

	if (isFailure(result)) {
		logger().info("action.create-api-key.validation-failed", {
			issues: result.error.issues,
		});
		return badRequest({ message: t("actions.createApiKey.errors.generic") });
	}

	// Check API key limit (max 10 per team)
	let [countResult] = await db()
		.select({ count: count() })
		.from(schema.apiKeys)
		.where(eq(schema.apiKeys.teamId, team().id));

	if ((countResult?.count ?? 0) >= 10) {
		logger().info("action.create-api-key.limit-exceeded", {
			teamId: team().id,
			currentCount: countResult?.count ?? 0,
			limit: 10,
		});
		return badRequest({
			message: t("actions.createApiKey.errors.limitExceeded", { limit: 10 }),
		});
	}

	let { key, keyHash, keyPrefix } = await generateApiKey();

	let [apiKey] = await db()
		.insert(schema.apiKeys)
		.values({
			teamId: team().id,
			name: result.data.name,
			keyHash,
			keyPrefix,
			scopes: result.data.scopes,
			expiresAt: result.data.expiresAt ?? null,
		})
		.returning();

	if (!apiKey) {
		logger().error("action.create-api-key.insert-failed", {
			teamId: team().id,
			name: result.data.name,
		});
		return badRequest({ message: t("actions.createApiKey.errors.generic") });
	}

	logger().info("action.create-api-key.success", {
		teamId: team().id,
		apiKeyId: apiKey.id,
		name: apiKey.name,
	});

	// Return the full key (only shown once!)
	return created({
		message: t("actions.createApiKey.success.created", { name: apiKey.name }),
		apiKey: {
			id: apiKey.id,
			name: apiKey.name,
			key, // Full key - only shown once
			keyPrefix: apiKey.keyPrefix,
			scopes: apiKey.scopes,
			expiresAt: apiKey.expiresAt,
			createdAt: apiKey.createdAt,
		},
	});
}

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	let result = await serverAction();
	if (result.ok) {
		// Don't redirect, we need to show the key
		toast.success(result.message);
		return result;
	}
	toast.error(result.message);
	return result;
}
