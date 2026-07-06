/**
 * Route action that updates the current user's preferred UI language. It validates
 * the selection (mapping "auto" to null for auto-detection), upserts the user's
 * preference row, and sets or clears the i18n cookie so the change applies at once.
 * It exists so users can switch languages, with the client reloading to apply it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { badRequest } from "@pkg/response";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { eq } from "drizzle-orm";
import { data } from "react-router";
import { toast } from "sonner";
import { z } from "zod/v4";

import { i18n as localeCookie } from "~/cookies";
import * as schema from "~/db/schema";
import { db } from "~/middleware/drizzle";
import { i18next } from "~/middleware/i18next";
import { logger } from "~/middleware/logger";
import { requireSubject } from "~/middleware/session";

import type { Route } from "./+types/route";

const inputSchema = z.object({
	language: z
		.enum(["auto", ...schema.supportedLanguages])
		.transform((val) => (val === "auto" ? null : val)),
});

export async function action({ request, context }: Route.ActionArgs) {
	logger().info("action.start", { route: "update-language", method: request.method });

	let { t } = i18next(context);
	let subjectId = requireSubject();

	let result = await validate(request, inputSchema);

	if (isFailure(result)) {
		logger().info("action.update-language.validation-failed", {
			issues: result.error.issues,
		});
		return badRequest({ message: t("actions.updateLanguage.errors.generic") });
	}

	let preferredLanguage = result.data.language;

	// Check if user preference already exists
	let existingPreference = await db().query.userPreferences.findFirst({
		where(fields, operators) {
			return operators.eq(fields.subjectId, subjectId);
		},
	});

	if (existingPreference) {
		// Update existing preference
		await db()
			.update(schema.userPreferences)
			.set({
				preferredLanguage,
			})
			.where(eq(schema.userPreferences.id, existingPreference.id));
	} else {
		// Create new preference
		await db().insert(schema.userPreferences).values({
			subjectId,
			preferredLanguage,
		});
	}

	logger().info("action.update-language.success", {
		subjectId,
		preferredLanguage,
	});

	// Set/update the i18n cookie so the change takes effect immediately
	// If preferredLanguage is null (auto-detect), clear the cookie
	let cookieValue = preferredLanguage ?? "";

	return data(
		{
			ok: true as const,
			message: t("actions.updateLanguage.success"),
			language: preferredLanguage,
		},
		{
			headers: {
				"Set-Cookie": await localeCookie.serialize(cookieValue),
			},
		},
	);
}

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	let result = await serverAction();
	if (result.ok) {
		toast.success(result.message);
		// Reload the page to apply the new language
		window.location.reload();
	}
	return result;
}
