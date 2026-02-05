import { badRequest, created, unprocessableEntity } from "@pkg/response";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { count, eq } from "drizzle-orm";
import { href, redirect } from "react-router";
import { toast } from "sonner";
import { z } from "zod/v4";

import * as schema from "~/db/schema";
import { db } from "~/middleware/drizzle";
import { i18next } from "~/middleware/i18next";
import { logger } from "~/middleware/logger";
import { team } from "~/middleware/team";

import type { Route } from "./+types/route";

const inputSchema = z.discriminatedUnion("strategy", [
	z.object({
		name: z.string(),
		strategy: z.literal("email"),
		email: z.email(),
		subjectPrefix: z.string().optional(),
	}),
	z.object({
		name: z.string(),
		strategy: z.literal("webhook"),
		url: z.url(),
		secret: z.string().optional(),
	}),
]);

export async function action({ request, context }: Route.ActionArgs) {
	let result = await validate(request, inputSchema);
	let { t } = i18next(context);

	if (isFailure(result)) {
		logger().info("action.create-alert.validation-failed", {
			issues: result.error.issues,
		});
		return badRequest({ message: t("actions.createAlert.errors.generic") });
	}

	let [countResult] = await db()
		.select({ count: count() })
		.from(schema.alerts)
		.where(eq(schema.alerts.teamId, team().id));

	if ((countResult?.count ?? 0) >= 10) {
		logger().info("action.create-alert.limit-exceeded", {
			teamId: team().id,
			currentCount: countResult?.count ?? 0,
			limit: 10,
		});
		return unprocessableEntity({
			message: t("actions.createAlert.errors.limitExceeded", { limit: 10 }),
		});
	}

	let [alert] = await db()
		.insert(schema.alerts)
		.values({
			teamId: team().id,
			name: result.data.name,
			config:
				result.data.strategy === "email"
					? {
							strategy: "email",
							config: {
								to: result.data.email,
								subjectPrefix: result.data.subjectPrefix ?? "",
							},
						}
					: {
							strategy: "webhook",
							config: {
								url: result.data.url,
								secret: result.data.secret ?? "",
							},
						},
		})
		.returning();

	if (!alert) {
		logger().error("action.create-alert.insert-failed", {
			teamId: team().id,
			name: result.data.name,
		});
		return badRequest({ message: t("actions.createAlert.errors.generic") });
	}

	logger().info("action.create-alert.success", {
		teamId: team().id,
		alertId: alert.id,
		strategy: result.data.strategy,
	});

	return created({
		message: t("actions.createAlert.success.created", { name: alert.name }),
	});
}

export async function clientAction({ serverAction, params }: Route.ClientActionArgs) {
	let result = await serverAction();
	if (result.ok) {
		toast.success(result.message);
		return redirect(href("/app/:team/alerts", params));
	}
	toast.error(result.message);
	return result;
}
