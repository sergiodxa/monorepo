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

const inputSchema = z.object({ alertId: z.uuid() });

export async function action({ request, context }: Route.ActionArgs) {
	let result = await validate(request, inputSchema);
	let { t } = i18next(context);

	if (isFailure(result)) {
		logger().info("action.remove-alert.validation-failed", {
			issues: result.error.issues,
		});
		return badRequest({ message: t("actions.removeAlert.errors.generic") });
	}

	let alert = await db().query.alerts.findFirst({
		where(fields, operators) {
			return operators.eq(fields.id, result.data.alertId);
		},
	});

	if (!alert) {
		logger().info("action.remove-alert.not-found", {
			alertId: result.data.alertId,
		});
		return notFound({ message: t("actions.removeAlert.errors.notFound") });
	}

	if (alert.teamId !== team().id) {
		logger().info("action.remove-alert.forbidden", {
			alertId: result.data.alertId,
			alertTeamId: alert.teamId,
			requestTeamId: team().id,
		});
		return forbidden({
			message: t("actions.removeAlert.errors.forbidden"),
		});
	}

	await db().delete(schema.alerts).where(eq(schema.alerts.id, alert.id));

	logger().info("action.remove-alert.success", {
		teamId: team().id,
		alertId: alert.id,
	});

	return ok({
		message: t("actions.removeAlert.success", { name: alert.name }),
	});
}

export async function clientAction({ serverAction, params }: Route.ClientActionArgs) {
	let result = await serverAction();
	if (result.ok) {
		toast.success(result.message);
		return redirect(href("/app/:team/alerts", params));
	}
	toast.error(result.message);
	return result;
}
