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

const inputSchema = z.object({ maintenanceId: z.uuid() });

export async function action({ request, context }: Route.ActionArgs) {
	let result = await validate(request, inputSchema);
	let { t } = i18next(context);

	if (isFailure(result)) {
		logger().info("action.delete-maintenance.validation-failed", {
			issues: result.error.issues,
		});
		return badRequest({ message: t("actions.deleteMaintenance.errors.generic") });
	}

	let maintenance = await db().query.maintenanceWindows.findFirst({
		where(fields, operators) {
			return operators.eq(fields.id, result.data.maintenanceId);
		},
	});

	if (!maintenance) {
		logger().info("action.delete-maintenance.not-found", {
			maintenanceId: result.data.maintenanceId,
		});
		return notFound({ message: t("actions.deleteMaintenance.errors.notFound") });
	}

	if (maintenance.teamId !== team().id) {
		logger().info("action.delete-maintenance.forbidden", {
			maintenanceId: result.data.maintenanceId,
			maintenanceTeamId: maintenance.teamId,
			requestTeamId: team().id,
		});
		return forbidden({
			message: t("actions.deleteMaintenance.errors.forbidden"),
		});
	}

	await db()
		.delete(schema.maintenanceWindows)
		.where(eq(schema.maintenanceWindows.id, maintenance.id));

	logger().info("action.delete-maintenance.success", {
		teamId: team().id,
		maintenanceId: maintenance.id,
	});

	return ok({
		message: t("actions.deleteMaintenance.success", { name: maintenance.name }),
	});
}

export async function clientAction({ serverAction, params }: Route.ClientActionArgs) {
	let result = await serverAction();
	if (result.ok) {
		toast.success(result.message);
		return redirect(href("/app/:team/maintenance", params));
	}
	toast.error(result.message);
	return result;
}
