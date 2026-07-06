/**
 * Route module for the team "create content check" action. Validates the check type
 * (contains, not_contains or regex) and value, confirms the target monitor belongs to
 * the team, enforces a limit of ten checks per monitor, and inserts the content check.
 * Exists so teams can assert on response-body content for an HTTP monitor.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { badRequest, created, notFound, unprocessableEntity } from "@pkg/response";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { count, eq } from "drizzle-orm";
import { href, redirect } from "react-router";
import { toast } from "sonner";
import { z } from "zod/v4";

import * as schema from "~/db/schema";
import { db } from "~/middleware/drizzle";
import { logger } from "~/middleware/logger";
import { team } from "~/middleware/team";
import { isValidRegex } from "~/services/check-content";

import type { Route } from "./+types/route";

const inputSchema = z
	.object({
		monitorId: z.uuid(),
		type: z.enum(["contains", "not_contains", "regex"]),
		value: z.string().min(1, "Value is required"),
		caseSensitive: z.literal("on").optional(),
	})
	.refine(
		(data) => {
			if (data.type === "regex") {
				return isValidRegex(data.value);
			}
			return true;
		},
		{ message: "Invalid regex pattern", path: ["value"] },
	);

export async function action({ request }: Route.ActionArgs) {
	logger().info("action.start", { route: "create-content-check", method: request.method });

	let result = await validate(request, inputSchema);

	if (isFailure(result)) {
		logger().info("action.create-content-check.validation-failed", {
			issues: result.error.issues,
		});
		return badRequest({ message: "Invalid input. Please check your values." });
	}

	// Verify the monitor belongs to this team
	let monitor = await db().query.monitors.findFirst({
		where(fields, operators) {
			return operators.and(
				operators.eq(fields.id, result.data.monitorId),
				operators.eq(fields.teamId, team().id),
			);
		},
	});

	if (!monitor) {
		logger().info("action.create-content-check.monitor-not-found", {
			monitorId: result.data.monitorId,
			teamId: team().id,
		});
		return notFound({ message: "Monitor not found" });
	}

	// Check limit (max 10 content checks per monitor)
	let [countResult] = await db()
		.select({ count: count() })
		.from(schema.monitorContentChecks)
		.where(eq(schema.monitorContentChecks.monitorId, monitor.id));

	if ((countResult?.count ?? 0) >= 10) {
		logger().info("action.create-content-check.limit-exceeded", {
			monitorId: monitor.id,
			currentCount: countResult?.count ?? 0,
			limit: 10,
		});
		return unprocessableEntity({
			message: "Maximum of 10 content checks per monitor reached",
		});
	}

	let [contentCheck] = await db()
		.insert(schema.monitorContentChecks)
		.values({
			monitorId: monitor.id,
			type: result.data.type,
			value: result.data.value,
			caseSensitive: result.data.caseSensitive === "on",
		})
		.returning();

	if (!contentCheck) {
		logger().error("action.create-content-check.insert-failed", {
			monitorId: monitor.id,
		});
		return badRequest({ message: "Failed to create content check" });
	}

	logger().info("action.create-content-check.success", {
		teamId: team().id,
		monitorId: monitor.id,
		contentCheckId: contentCheck.id,
		type: result.data.type,
	});

	return created({ message: "Content check created" });
}

export async function clientAction({ serverAction, params }: Route.ClientActionArgs) {
	let result = await serverAction();
	if (result.ok) {
		toast.success(result.message);
		return redirect(
			href("/app/:team/monitors/:monitorId/edit", {
				team: params.team,
				monitorId: new URL(window.location.href).searchParams.get("monitorId") ?? "",
			}),
		);
	}
	toast.error(result.message);
	return result;
}
