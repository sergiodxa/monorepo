import { badRequest, created } from "@pkg/response";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { href, redirect } from "react-router";
import { toast } from "sonner";
import { z } from "zod/v4";

import { db } from "~/middleware/drizzle";
import { i18next } from "~/middleware/i18next";
import { logger } from "~/middleware/logger";
import { subject } from "~/middleware/subject";
import { team } from "~/middleware/team";
import Monitor from "~/models/monitor";

import type { Route } from "./+types/route";

const schema = z.object({
	name: z.string().min(1),
	method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET").optional(),
	url: z.url(),
	expectedStatus: z.coerce.number().min(100).max(599).default(200).optional(),
	intervalSeconds: z.coerce
		.number()
		.min(1)
		.max(60)
		.default(10)
		.transform((val) => val * 60) // Convert to seconds
		.optional(),
});

export async function action({ request, context }: Route.ActionArgs) {
	logger().info("action.start", { route: "create-monitor", method: request.method });

	let result = await validate(request, schema);
	let { t } = i18next(context);

	if (isFailure(result)) {
		logger().info("action.create-monitor.validation-failed", {
			issues: result.error.issues,
		});
		return badRequest({ message: t("actions.createInvite.errors.generic") });
	}

	try {
		let monitor = await Monitor.create(db(), subject().id, team().id, {
			name: result.data.name,
			url: result.data.url,
			method: result.data.method ?? "GET",
			status: result.data.expectedStatus ?? 200,
			interval: result.data.intervalSeconds ?? 60,
			timeout: 10, // Default timeout of 10 seconds
		});

		await Monitor.ping(db(), monitor.id);

		logger().info("action.create-monitor.success", {
			monitorId: monitor.id,
			teamId: team().id,
		});

		return created({
			message: t("actions.createMonitor.success", {
				name: monitor.name,
			}),
		});
	} catch (error) {
		logger().error("action.create-monitor.error", {
			error: error instanceof Error ? error.message : String(error),
			teamId: team().id,
		});

		return badRequest({
			message: t("actions.createMonitor.errors.generic"),
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
