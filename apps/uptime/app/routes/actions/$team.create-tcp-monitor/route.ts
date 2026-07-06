/**
 * Route module for the team "create TCP monitor" action. Validates the submitted name,
 * host, port and interval/timeout fields, persists a new TcpMonitor for the current
 * team, and returns a localized success or error response. Exists so the app can
 * register new TCP uptime checks and redirect back to the team's TCP monitors list.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { badRequest, created } from "@pkg/response";
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
	name: z.string().min(1),
	host: z.string().min(1),
	port: z.coerce.number().min(1).max(65535),
	intervalSeconds: z.coerce
		.number()
		.min(1)
		.max(60)
		.default(5)
		.transform((val) => val * 60) // Convert minutes to seconds
		.optional(),
	timeoutMs: z.coerce
		.number()
		.min(1)
		.max(30)
		.default(5)
		.transform((val) => val * 1000) // Convert seconds to milliseconds
		.optional(),
});

export async function action({ request, context }: Route.ActionArgs) {
	logger().info("action.start", { route: "create-tcp-monitor", method: request.method });

	let result = await validate(request, schema);
	let { t } = i18next(context);

	if (isFailure(result)) {
		logger().info("action.create-tcp-monitor.validation-failed", {
			issues: result.error.issues,
		});
		return badRequest({ message: t("actions.createTcpMonitor.errors.generic") });
	}

	try {
		let tcpMonitor = await TcpMonitor.create(db(), team().id, {
			name: result.data.name,
			host: result.data.host,
			port: result.data.port,
			intervalSeconds: result.data.intervalSeconds,
			timeoutMs: result.data.timeoutMs,
		});

		logger().info("action.create-tcp-monitor.success", {
			tcpMonitorId: tcpMonitor.id,
			teamId: team().id,
		});

		return created({
			message: t("actions.createTcpMonitor.success", {
				name: tcpMonitor.name,
			}),
		});
	} catch (error) {
		logger().error("action.create-tcp-monitor.error", {
			error: error instanceof Error ? error.message : String(error),
			teamId: team().id,
		});

		return badRequest({
			message: t("actions.createTcpMonitor.errors.generic"),
		});
	}
}

export async function clientAction({ serverAction, params }: Route.ClientActionArgs) {
	let result = await serverAction();
	if (result.ok) {
		toast.success(result.message);
		return redirect(href("/app/:team/tcp", params));
	}
	toast.error(result.message);
	return result;
}
