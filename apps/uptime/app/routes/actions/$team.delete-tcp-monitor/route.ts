/**
 * Route module for the team "delete TCP monitor" action. Validates the monitor id,
 * requires a non-member role, confirms the monitor belongs to the current team, and
 * deletes it. Exists so team admins can remove a TCP uptime check with localized
 * success or error feedback.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { badRequest, forbidden, notFound, ok } from "@pkg/response";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { toast } from "sonner";
import { z } from "zod/v4";

import { db } from "~/middleware/drizzle";
import { i18next } from "~/middleware/i18next";
import { logger } from "~/middleware/logger";
import { team } from "~/middleware/team";
import TcpMonitor from "~/models/tcp-monitor";

import type { Route } from "./+types/route";

const inputSchema = z.object({ tcpMonitorId: z.uuid() });

export async function action({ request, context }: Route.ActionArgs) {
	logger().info("action.start", { route: "delete-tcp-monitor", method: request.method });

	let result = await validate(request, inputSchema);
	let { t } = i18next(context);

	if (isFailure(result)) {
		logger().info("action.delete-tcp-monitor.validation-failed", {
			issues: result.error.issues,
		});
		return badRequest({ message: t("actions.deleteTcpMonitor.errors.generic") });
	}

	if (team().memberships[0].role === "member") {
		logger().info("action.delete-tcp-monitor.forbidden", {
			teamId: team().id,
			reason: "member_role",
		});
		return forbidden({
			message: t("actions.deleteTcpMonitor.errors.notAllowed"),
		});
	}

	let tcpMonitor = await TcpMonitor.findByIdAndTeam(db(), result.data.tcpMonitorId, team().id);

	if (!tcpMonitor) {
		logger().info("action.delete-tcp-monitor.not-found", {
			teamId: team().id,
			tcpMonitorId: result.data.tcpMonitorId,
		});
		return notFound({
			message: t("actions.deleteTcpMonitor.errors.notFound"),
		});
	}

	try {
		await TcpMonitor.deleteById(db(), result.data.tcpMonitorId);
		logger().info("action.delete-tcp-monitor.success", {
			teamId: team().id,
			tcpMonitorId: tcpMonitor.id,
		});
		return ok({ message: t("actions.deleteTcpMonitor.success", { name: tcpMonitor.name }) });
	} catch (error) {
		logger().error("action.delete-tcp-monitor.error", {
			teamId: team().id,
			tcpMonitorId: result.data.tcpMonitorId,
			error: error instanceof Error ? error.message : String(error),
		});
		return badRequest({ message: t("actions.deleteTcpMonitor.errors.generic") });
	}
}

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	let result = await serverAction();
	if (result.ok) toast.success(result.message);
	else toast.error(result.message);
	return result;
}
