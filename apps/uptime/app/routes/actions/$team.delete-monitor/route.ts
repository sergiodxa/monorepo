import { badRequest, forbidden, notFound, ok } from "@pkg/response";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { toast } from "sonner";
import { z } from "zod/v4";

import { db } from "~/middleware/drizzle";
import { i18next } from "~/middleware/i18next";
import { logger } from "~/middleware/logger";
import { team } from "~/middleware/team";
import Monitor from "~/models/monitor";

import type { Route } from "./+types/route";

const inputSchema = z.object({ monitorId: z.uuid() });

export async function action({ request, context }: Route.ActionArgs) {
	logger().info("action.start", { route: "delete-monitor", method: request.method });

	let result = await validate(request, inputSchema);
	let { t } = i18next(context);

	if (isFailure(result)) {
		logger().info("action.delete-monitor.validation-failed", {
			issues: result.error.issues,
		});
		return badRequest({ message: t("actions.deleteMonitor.errors.generic") });
	}

	if (team().memberships[0].role === "member") {
		logger().info("action.delete-monitor.forbidden", {
			teamId: team().id,
			reason: "member_role",
		});
		return forbidden({
			message: t("actions.deleteMonitor.errors.notAllowed"),
		});
	}

	let monitor = await db().query.monitors.findFirst({
		where(fields, operators) {
			return operators.eq(fields.id, result.data.monitorId);
		},
	});

	if (!monitor) {
		logger().info("action.delete-monitor.not-found", {
			teamId: team().id,
			monitorId: result.data.monitorId,
		});
		return notFound({
			message: t("actions.deleteMonitor.errors.notFound"),
		});
	}

	try {
		await Monitor.deleteById(db(), result.data.monitorId);
		logger().info("action.delete-monitor.success", {
			teamId: team().id,
			monitorId: monitor.id,
		});
		return ok({ message: t("actions.deleteMonitor.success", monitor) });
	} catch (error) {
		logger().error("action.delete-monitor.error", {
			teamId: team().id,
			monitorId: result.data.monitorId,
			error: error instanceof Error ? error.message : String(error),
		});
		return badRequest({ message: t("actions.deleteMonitor.errors.generic") });
	}
}

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	let result = await serverAction();
	if (result.ok) toast.success(result.message);
	else toast.error(result.message);
	return result;
}
