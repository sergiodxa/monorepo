/**
 * Route module for the team "update cron job" action. Validates the submitted fields,
 * confirms the cron job monitor belongs to the current team, parses and verifies the
 * cron expression, and updates name, schedule, grace period and enabled state while
 * recomputing the next expected run. Exists so teams can edit scheduled-job monitors.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { badRequest, notFound, ok } from "@pkg/response";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { CronExpressionParser } from "cron-parser";
import { href, redirect } from "react-router";
import { toast } from "sonner";
import { z } from "zod/v4";

import { db } from "~/middleware/drizzle";
import { i18next } from "~/middleware/i18next";
import { logger } from "~/middleware/logger";
import { team } from "~/middleware/team";
import CronJobMonitor from "~/models/cron-job-monitor";

import type { Route } from "./+types/route";

const schema = z.object({
	cronJobId: z.string().uuid(),
	name: z.string().min(1),
	description: z.string().optional(),
	cronExpression: z.string().min(1),
	gracePeriodMinutes: z.coerce
		.number()
		.min(1)
		.max(60)
		.default(5)
		.transform((val) => val * 60), // Convert minutes to seconds
	timezone: z.string().default("UTC"),
	alertOnLate: z
		.string()
		.optional()
		.transform((val) => val === "on"),
	enabled: z
		.string()
		.optional()
		.transform((val) => val === "on"),
});

export async function action({ request, context }: Route.ActionArgs) {
	logger().info("action.start", { route: "update-cron-job", method: request.method });

	let result = await validate(request, schema);
	let { t } = i18next(context);

	if (isFailure(result)) {
		logger().info("action.update-cron-job.validation-failed", {
			issues: result.error.issues,
		});
		return badRequest({ message: t("actions.updateCronJob.errors.generic") });
	}

	let cronJob = await CronJobMonitor.findByIdAndTeam(db(), result.data.cronJobId, team().id);

	if (!cronJob) {
		logger().info("action.update-cron-job.not-found", {
			cronJobId: result.data.cronJobId,
			teamId: team().id,
		});
		return notFound({ message: t("actions.updateCronJob.errors.notFound") });
	}

	// Validate cron expression
	try {
		CronExpressionParser.parse(result.data.cronExpression, {
			currentDate: new Date(),
			tz: result.data.timezone,
		});
	} catch {
		logger().info("action.update-cron-job.invalid-cron", {
			cronExpression: result.data.cronExpression,
		});
		return badRequest({ message: t("actions.updateCronJob.errors.invalidCron") });
	}

	try {
		let wasEnabled = cronJob.enabledAt !== null;
		let willBeEnabled = result.data.enabled;
		let scheduleChanged =
			cronJob.cronExpression !== result.data.cronExpression ||
			cronJob.timezone !== result.data.timezone;

		await CronJobMonitor.updateById(db(), cronJob.id, {
			name: result.data.name,
			description: result.data.description ?? null,
			cronExpression: result.data.cronExpression,
			gracePeriodSeconds: result.data.gracePeriodMinutes, // Already converted to seconds
			timezone: result.data.timezone,
			alertOnLate: result.data.alertOnLate,
			enabledAt: willBeEnabled ? (wasEnabled ? cronJob.enabledAt : new Date()) : null,
			// Update next expected time if schedule changed or enabling
			nextExpectedAt:
				willBeEnabled && (scheduleChanged || !wasEnabled)
					? CronJobMonitor.calculateNextExpected(result.data.cronExpression, result.data.timezone)
					: willBeEnabled
						? cronJob.nextExpectedAt
						: null,
		});

		logger().info("action.update-cron-job.success", {
			cronJobId: cronJob.id,
			teamId: team().id,
		});

		return ok({
			message: t("actions.updateCronJob.success", {
				name: result.data.name,
			}),
		});
	} catch (error) {
		logger().error("action.update-cron-job.error", {
			error: error instanceof Error ? error.message : String(error),
			cronJobId: cronJob.id,
			teamId: team().id,
		});

		return badRequest({
			message: t("actions.updateCronJob.errors.generic"),
		});
	}
}

export async function clientAction({ serverAction, params, request }: Route.ClientActionArgs) {
	let result = await serverAction();
	let formData = await request.formData();
	let cronJobId = formData.get("cronJobId") as string;

	if (result.ok) {
		toast.success(result.message);
		return redirect(href("/app/:team/cron-jobs/:cronJobId", { team: params.team, cronJobId }));
	}
	toast.error(result.message);
	return result;
}
