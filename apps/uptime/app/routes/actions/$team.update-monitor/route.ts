import { badRequest, notFound, ok } from "@pkg/response";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { href, redirect } from "react-router";
import { toast } from "sonner";
import { z } from "zod/v4";

import { db } from "~/middleware/drizzle";
import { i18next } from "~/middleware/i18next";
import { logger } from "~/middleware/logger";
import { team } from "~/middleware/team";
import Monitor from "~/models/monitor";

import type { Route } from "./+types/route";

const schema = z.object({
	monitorId: z.string().uuid(),
	name: z.string().min(1),
	url: z.url(),
	expectedStatus: z.coerce.number().min(100).max(599).default(200).optional(),
	intervalSeconds: z.coerce
		.number()
		.min(1)
		.max(60)
		.default(10)
		.transform((val) => val * 60) // Convert minutes to seconds
		.optional(),
	region: z
		.enum(["wnam", "enam", "sam", "weur", "eeur", "apac", "oc", "afr", "me"])
		.default("wnam")
		.optional(),
});

export async function action({ request, context }: Route.ActionArgs) {
	logger().info("action.start", { route: "update-monitor", method: request.method });

	let result = await validate(request, schema);
	let { t } = i18next(context);

	if (isFailure(result)) {
		logger().info("action.update-monitor.validation-failed", {
			issues: result.error.issues,
		});
		return badRequest({ message: t("actions.updateMonitor.errors.generic") });
	}

	// Verify the monitor belongs to the current team
	let existingMonitor = await db().query.monitors.findFirst({
		where(fields, operators) {
			return operators.and(
				operators.eq(fields.id, result.data.monitorId),
				operators.eq(fields.teamId, team().id),
			);
		},
	});

	if (!existingMonitor) {
		logger().info("action.update-monitor.not-found", {
			monitorId: result.data.monitorId,
			teamId: team().id,
		});
		return notFound({ message: t("actions.updateMonitor.errors.notFound") });
	}

	try {
		let monitor = await Monitor.updateById(db(), result.data.monitorId, {
			name: result.data.name,
			url: result.data.url,
			expectedStatus: result.data.expectedStatus ?? 200,
			intervalSeconds: result.data.intervalSeconds ?? 600,
			locationHint: result.data.region ?? "wnam",
		});

		logger().info("action.update-monitor.success", {
			monitorId: monitor.id,
			teamId: team().id,
		});

		return ok({
			message: t("actions.updateMonitor.success", {
				name: monitor.name,
			}),
		});
	} catch (error) {
		logger().error("action.update-monitor.error", {
			error: error instanceof Error ? error.message : String(error),
			teamId: team().id,
		});

		return badRequest({
			message: t("actions.updateMonitor.errors.generic"),
		});
	}
}

export async function clientAction({ serverAction, params }: Route.ClientActionArgs) {
	let result = await serverAction();
	if (result.ok) {
		toast.success(result.message);
		return redirect(href("/app/:team/dashboard", params));
	}
	toast.error(result.message);
	return result;
}
