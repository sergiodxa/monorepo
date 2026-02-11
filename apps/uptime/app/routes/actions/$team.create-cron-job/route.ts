import { badRequest, created } from "@pkg/response";
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
	logger().info("action.start", { route: "create-cron-job", method: request.method });

	let result = await validate(request, schema);
	let { t } = i18next(context);

	if (isFailure(result)) {
		logger().info("action.create-cron-job.validation-failed", {
			issues: result.error.issues,
		});
		return badRequest({ message: t("actions.createCronJob.errors.generic") });
	}

	// Validate cron expression
	try {
		CronExpressionParser.parse(result.data.cronExpression, {
			currentDate: new Date(),
			tz: result.data.timezone,
		});
	} catch {
		logger().info("action.create-cron-job.invalid-cron", {
			cronExpression: result.data.cronExpression,
		});
		return badRequest({ message: t("actions.createCronJob.errors.invalidCron") });
	}

	try {
		let cronJob = await CronJobMonitor.create(db(), {
			teamId: team().id,
			name: result.data.name,
			description: result.data.description ?? null,
			cronExpression: result.data.cronExpression,
			gracePeriodSeconds: result.data.gracePeriodMinutes, // Already converted to seconds
			timezone: result.data.timezone,
			alertOnLate: result.data.alertOnLate,
			enabledAt: result.data.enabled ? new Date() : null,
			nextExpectedAt: result.data.enabled
				? CronJobMonitor.calculateNextExpected(result.data.cronExpression, result.data.timezone)
				: null,
		});

		logger().info("action.create-cron-job.success", {
			cronJobId: cronJob.id,
			teamId: team().id,
		});

		return created({
			cronJobId: cronJob.id,
			message: t("actions.createCronJob.success", {
				name: cronJob.name,
			}),
		});
	} catch (error) {
		logger().error("action.create-cron-job.error", {
			error: error instanceof Error ? error.message : String(error),
			teamId: team().id,
		});

		return badRequest({
			message: t("actions.createCronJob.errors.generic"),
		});
	}
}

export async function clientAction({ serverAction, params }: Route.ClientActionArgs) {
	let result = (await serverAction()) as { ok: boolean; message: string; cronJobId?: string };
	if (result.ok && result.cronJobId) {
		toast.success(result.message);
		return redirect(
			href("/app/:team/cron-jobs/:cronJobId", { team: params.team, cronJobId: result.cronJobId }),
		);
	}
	toast.error(result.message);
	return result;
}
