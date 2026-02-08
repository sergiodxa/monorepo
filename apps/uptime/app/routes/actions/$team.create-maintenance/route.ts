import { badRequest, created } from "@pkg/response";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { href, redirect } from "react-router";
import { toast } from "sonner";
import { z } from "zod/v4";

import * as schema from "~/db/schema";
import { db } from "~/middleware/drizzle";
import { i18next } from "~/middleware/i18next";
import { logger } from "~/middleware/logger";
import { team } from "~/middleware/team";

import type { Route } from "./+types/route";

const inputSchema = z.object({
	name: z.string().min(1),
	monitorId: z.uuid().optional(),
	startsAt: z.iso.datetime(),
	endsAt: z.iso.datetime(),
	suppressAlerts: z.literal("on").optional(),
	showOnStatusPage: z.literal("on").optional(),
	isRecurring: z.literal("on").optional(),
	recurringPattern: z.string().optional(),
});

export async function action({ request, context }: Route.ActionArgs) {
	logger().info("action.start", { route: "create-maintenance", method: request.method });

	let result = await validate(request, inputSchema);
	let { t } = i18next(context);

	if (isFailure(result)) {
		logger().info("action.create-maintenance.validation-failed", {
			issues: result.error.issues,
		});
		return badRequest({ message: t("actions.createMaintenance.errors.generic") });
	}

	let startsAt = new Date(result.data.startsAt);
	let endsAt = new Date(result.data.endsAt);

	if (endsAt <= startsAt) {
		return badRequest({ message: t("actions.createMaintenance.errors.invalidDates") });
	}

	let [maintenance] = await db()
		.insert(schema.maintenanceWindows)
		.values({
			teamId: team().id,
			monitorId: result.data.monitorId ?? null,
			name: result.data.name,
			startsAt,
			endsAt,
			suppressAlerts: result.data.suppressAlerts === "on",
			showOnStatusPage: result.data.showOnStatusPage === "on",
			isRecurring: result.data.isRecurring === "on",
			recurringPattern: result.data.recurringPattern ?? null,
		})
		.returning();

	if (!maintenance) {
		logger().error("action.create-maintenance.insert-failed", {
			teamId: team().id,
			name: result.data.name,
		});
		return badRequest({ message: t("actions.createMaintenance.errors.generic") });
	}

	logger().info("action.create-maintenance.success", {
		teamId: team().id,
		maintenanceId: maintenance.id,
	});

	return created({
		message: t("actions.createMaintenance.success.created", { name: maintenance.name }),
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
