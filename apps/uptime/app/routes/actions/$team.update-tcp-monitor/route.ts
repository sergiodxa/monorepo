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
import TcpMonitor from "~/models/tcp-monitor";

import type { Route } from "./+types/route";

const schema = z.object({
	tcpMonitorId: z.uuid(),
	name: z.string().min(1),
	host: z.string().min(1),
	port: z.coerce.number().min(1).max(65535),
	intervalSeconds: z.coerce
		.number()
		.min(1)
		.max(60)
		.transform((val) => val * 60), // Convert minutes to seconds
	timeoutMs: z.coerce
		.number()
		.min(1)
		.max(30)
		.transform((val) => val * 1000), // Convert seconds to milliseconds
	isEnabled: z
		.union([z.literal("on"), z.literal("true"), z.literal("false")])
		.transform((val) => val === "on" || val === "true")
		.default("true"),
});

export async function action({ request, context }: Route.ActionArgs) {
	logger().info("action.start", { route: "update-tcp-monitor", method: request.method });

	let result = await validate(request, schema);
	let { t } = i18next(context);

	if (isFailure(result)) {
		logger().info("action.update-tcp-monitor.validation-failed", {
			issues: result.error.issues,
		});
		return badRequest({ message: t("actions.updateTcpMonitor.errors.generic") });
	}

	// Check if the TCP monitor exists and belongs to the team
	let existingMonitor = await TcpMonitor.findByIdAndTeam(db(), result.data.tcpMonitorId, team().id);

	if (!existingMonitor) {
		logger().info("action.update-tcp-monitor.not-found", {
			tcpMonitorId: result.data.tcpMonitorId,
			teamId: team().id,
		});
		return notFound({ message: t("actions.updateTcpMonitor.errors.notFound") });
	}

	try {
		let tcpMonitor = await TcpMonitor.updateById(db(), result.data.tcpMonitorId, {
			name: result.data.name,
			host: result.data.host,
			port: result.data.port,
			intervalSeconds: result.data.intervalSeconds,
			timeoutMs: result.data.timeoutMs,
			isEnabled: result.data.isEnabled,
		});

		logger().info("action.update-tcp-monitor.success", {
			tcpMonitorId: tcpMonitor.id,
			teamId: team().id,
		});

		return ok({
			message: t("actions.updateTcpMonitor.success", {
				name: tcpMonitor.name,
			}),
		});
	} catch (error) {
		logger().error("action.update-tcp-monitor.error", {
			error: error instanceof Error ? error.message : String(error),
			teamId: team().id,
			tcpMonitorId: result.data.tcpMonitorId,
		});

		return badRequest({
			message: t("actions.updateTcpMonitor.errors.generic"),
		});
	}
}

export async function clientAction({ serverAction, params, request }: Route.ClientActionArgs) {
	let result = await serverAction();
	let formData = await request.formData();
	let tcpMonitorId = formData.get("tcpMonitorId") as string;

	if (result.ok) {
		toast.success(result.message);
		return redirect(href("/app/:team/tcp/:tcpMonitorId", { team: params.team, tcpMonitorId }));
	}
	toast.error(result.message);
	return result;
}
