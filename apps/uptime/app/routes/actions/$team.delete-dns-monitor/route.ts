import { badRequest, forbidden, notFound, ok } from "@pkg/response";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { eq } from "drizzle-orm";
import { href, redirect } from "react-router";
import { toast } from "sonner";
import { z } from "zod/v4";

import * as schema from "~/db/schema";
import { db } from "~/middleware/drizzle";
import { i18next } from "~/middleware/i18next";
import { logger } from "~/middleware/logger";
import { team } from "~/middleware/team";

import type { Route } from "./+types/route";

const inputSchema = z.object({ dnsMonitorId: z.uuid() });

export async function action({ request, context }: Route.ActionArgs) {
	logger().info("action.start", { route: "delete-dns-monitor", method: request.method });

	let result = await validate(request, inputSchema);
	let { t } = i18next(context);

	if (isFailure(result)) {
		logger().info("action.delete-dns-monitor.validation-failed", {
			issues: result.error.issues,
		});
		return badRequest({ message: t("actions.deleteDnsMonitor.errors.generic") });
	}

	let dnsMonitor = await db().query.dnsMonitors.findFirst({
		where(fields, operators) {
			return operators.eq(fields.id, result.data.dnsMonitorId);
		},
	});

	if (!dnsMonitor) {
		logger().info("action.delete-dns-monitor.not-found", {
			dnsMonitorId: result.data.dnsMonitorId,
		});
		return notFound({ message: t("actions.deleteDnsMonitor.errors.notFound") });
	}

	if (dnsMonitor.teamId !== team().id) {
		logger().info("action.delete-dns-monitor.forbidden", {
			dnsMonitorId: result.data.dnsMonitorId,
			dnsMonitorTeamId: dnsMonitor.teamId,
			requestTeamId: team().id,
		});
		return forbidden({
			message: t("actions.deleteDnsMonitor.errors.forbidden"),
		});
	}

	// Delete associated results first
	await db()
		.delete(schema.dnsMonitorResults)
		.where(eq(schema.dnsMonitorResults.dnsMonitorId, dnsMonitor.id));

	// Delete the monitor
	await db().delete(schema.dnsMonitors).where(eq(schema.dnsMonitors.id, dnsMonitor.id));

	logger().info("action.delete-dns-monitor.success", {
		teamId: team().id,
		dnsMonitorId: dnsMonitor.id,
	});

	return ok({
		message: t("actions.deleteDnsMonitor.success", { name: dnsMonitor.name }),
	});
}

export async function clientAction({ serverAction, params }: Route.ClientActionArgs) {
	let result = await serverAction();
	if (result.ok) {
		toast.success(result.message);
		return redirect(href("/app/:team/dns", params));
	}
	toast.error(result.message);
	return result;
}
