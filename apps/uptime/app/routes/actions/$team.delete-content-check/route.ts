/**
 * Route action that deletes a content check attached to a monitor. It validates the
 * content-check id, loads the check together with its monitor to verify the monitor
 * belongs to the current team, then removes the content check. It exists so teams
 * can remove content assertions from a monitor, redirecting back to its edit page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { badRequest, forbidden, notFound, ok } from "@pkg/response";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { eq } from "drizzle-orm";
import { href, redirect } from "react-router";
import { toast } from "sonner";
import { z } from "zod/v4";

import * as schema from "~/db/schema";
import { db } from "~/middleware/drizzle";
import { logger } from "~/middleware/logger";
import { team } from "~/middleware/team";

import type { Route } from "./+types/route";

const inputSchema = z.object({
	contentCheckId: z.uuid(),
});

export async function action({ request }: Route.ActionArgs) {
	logger().info("action.start", { route: "delete-content-check", method: request.method });

	let result = await validate(request, inputSchema);

	if (isFailure(result)) {
		logger().info("action.delete-content-check.validation-failed", {
			issues: result.error.issues,
		});
		return badRequest({ message: "Invalid content check ID" });
	}

	// Find the content check with its monitor to verify ownership
	let contentCheck = await db().query.monitorContentChecks.findFirst({
		where(fields, operators) {
			return operators.eq(fields.id, result.data.contentCheckId);
		},
		with: {
			monitor: {
				columns: {
					id: true,
					teamId: true,
				},
			},
		},
	});

	if (!contentCheck) {
		logger().info("action.delete-content-check.not-found", {
			contentCheckId: result.data.contentCheckId,
		});
		return notFound({ message: "Content check not found" });
	}

	// Verify the monitor belongs to this team
	if (contentCheck.monitor.teamId !== team().id) {
		logger().info("action.delete-content-check.forbidden", {
			contentCheckId: result.data.contentCheckId,
			monitorTeamId: contentCheck.monitor.teamId,
			requestTeamId: team().id,
		});
		return forbidden({ message: "Not authorized to delete this content check" });
	}

	await db()
		.delete(schema.monitorContentChecks)
		.where(eq(schema.monitorContentChecks.id, contentCheck.id));

	logger().info("action.delete-content-check.success", {
		teamId: team().id,
		monitorId: contentCheck.monitor.id,
		contentCheckId: contentCheck.id,
	});

	return ok({ message: "Content check deleted" });
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
