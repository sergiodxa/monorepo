/**
 * Route module for the team "delete cron job" action. Validates the cron job id,
 * requires a non-member role, confirms the CronJobMonitor belongs to the current team,
 * and deletes it. Exists so team admins can remove a scheduled-job monitor with
 * localized success or error feedback.
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
import CronJobMonitor from "~/models/cron-job-monitor";

import type { Route } from "./+types/route";

const inputSchema = z.object({ cronJobId: z.uuid() });

export async function action({ request, context }: Route.ActionArgs) {
	logger().info("action.start", { route: "delete-cron-job", method: request.method });

	let result = await validate(request, inputSchema);
	let { t } = i18next(context);

	if (isFailure(result)) {
		logger().info("action.delete-cron-job.validation-failed", {
			issues: result.error.issues,
		});
		return badRequest({ message: t("actions.deleteCronJob.errors.generic") });
	}

	if (team().memberships[0].role === "member") {
		logger().info("action.delete-cron-job.forbidden", {
			teamId: team().id,
			reason: "member_role",
		});
		return forbidden({
			message: t("actions.deleteCronJob.errors.forbidden"),
		});
	}

	let cronJob = await CronJobMonitor.findByIdAndTeam(db(), result.data.cronJobId, team().id);

	if (!cronJob) {
		logger().info("action.delete-cron-job.not-found", {
			teamId: team().id,
			cronJobId: result.data.cronJobId,
		});
		return notFound({
			message: t("actions.deleteCronJob.errors.notFound"),
		});
	}

	try {
		await CronJobMonitor.deleteById(db(), result.data.cronJobId);
		logger().info("action.delete-cron-job.success", {
			teamId: team().id,
			cronJobId: cronJob.id,
		});
		return ok({ message: t("actions.deleteCronJob.success", { name: cronJob.name }) });
	} catch (error) {
		logger().error("action.delete-cron-job.error", {
			teamId: team().id,
			cronJobId: result.data.cronJobId,
			error: error instanceof Error ? error.message : String(error),
		});
		return badRequest({ message: t("actions.deleteCronJob.errors.generic") });
	}
}

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	let result = await serverAction();
	if (result.ok) toast.success(result.message);
	else toast.error(result.message);
	return result;
}
