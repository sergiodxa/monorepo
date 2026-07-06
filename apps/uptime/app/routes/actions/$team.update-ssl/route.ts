/**
 * Route module for the team "update SSL" action. Validates the SSL monitoring fields for
 * a monitor, confirms the monitor belongs to the team, computes an initial SSL status
 * from the expiry date and warning threshold, and persists the SSL settings. Exists so
 * teams can enable and configure certificate-expiry monitoring for an HTTP monitor.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { badRequest, notFound, ok } from "@pkg/response";
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
import { calculateSslStatus } from "~/services/check-ssl";

import type { Route } from "./+types/route";

const sslSchema = z.object({
	monitorId: z.string().uuid(),
	sslMonitoringEnabled: z
		.string()
		.optional()
		.transform((val) => val === "true" || val === "on"),
	sslExpiryWarningDays: z.coerce.number().min(1).max(365).default(30).optional(),
	sslExpiresAt: z
		.string()
		.optional()
		.transform((val) => {
			if (!val) return null;
			let date = new Date(val);
			return Number.isNaN(date.getTime()) ? null : date;
		}),
	sslIssuer: z.string().optional().default(""),
});

export async function action({ request, context }: Route.ActionArgs) {
	logger().info("action.start", { route: "update-ssl", method: request.method });

	let result = await validate(request, sslSchema);
	let { t } = i18next(context);

	if (isFailure(result)) {
		logger().info("action.update-ssl.validation-failed", {
			issues: result.error.issues,
		});
		return badRequest({ message: t("actions.updateSsl.errors.generic") });
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
		logger().info("action.update-ssl.not-found", {
			monitorId: result.data.monitorId,
			teamId: team().id,
		});
		return notFound({ message: t("actions.updateSsl.errors.notFound") });
	}

	try {
		// Calculate the initial SSL status based on the expiry date
		let sslStatus: schema.SelectMonitor["sslStatus"] = "unknown";
		if (result.data.sslMonitoringEnabled && result.data.sslExpiresAt) {
			let { status } = calculateSslStatus(
				result.data.sslExpiresAt,
				result.data.sslExpiryWarningDays ?? 30,
			);
			sslStatus = status;
		}

		await db()
			.update(schema.monitors)
			.set({
				sslMonitoringEnabled: result.data.sslMonitoringEnabled,
				sslExpiryWarningDays: result.data.sslExpiryWarningDays ?? 30,
				sslExpiresAt: result.data.sslExpiresAt,
				sslIssuer: result.data.sslIssuer || null,
				sslStatus,
				sslLastCheckedAt: result.data.sslMonitoringEnabled ? new Date() : null,
			})
			.where(eq(schema.monitors.id, result.data.monitorId));

		logger().info("action.update-ssl.success", {
			monitorId: result.data.monitorId,
			teamId: team().id,
			sslMonitoringEnabled: result.data.sslMonitoringEnabled,
		});

		return ok({
			message: t("actions.updateSsl.success", {
				name: existingMonitor.name,
			}),
		});
	} catch (error) {
		logger().error("action.update-ssl.error", {
			error: error instanceof Error ? error.message : String(error),
			teamId: team().id,
		});

		return badRequest({
			message: t("actions.updateSsl.errors.generic"),
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
