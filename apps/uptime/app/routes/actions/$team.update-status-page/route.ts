import { badRequest } from "@pkg/response";
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

const inputSchema = z.object({
	statusPageId: z.uuid(),
	name: z.string().min(1),
	slug: z
		.string()
		.min(1)
		.regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
	title: z.string().min(1),
	description: z.string().optional(),
	logoUrl: z.url().optional().or(z.literal("")),
	isPublic: z.preprocess((v) => v === "on" || v === true, z.boolean()).default(false),
	showOverallStatus: z.preprocess((v) => v === "on" || v === true, z.boolean()).default(true),
	monitorIds: z
		.union([z.uuid().transform((v) => [v]), z.array(z.uuid())])
		.optional()
		.default([]),
	cronJobIds: z
		.union([z.uuid().transform((v) => [v]), z.array(z.uuid())])
		.optional()
		.default([]),
});

export async function action({ request, context, params }: Route.ActionArgs) {
	logger().info("action.start", { route: "update-status-page", method: request.method });

	let result = await validate(request, inputSchema);
	let { t } = i18next(context);

	if (isFailure(result)) {
		logger().info("action.update-status-page.validation-failed", {
			issues: result.error.issues,
		});
		return badRequest({ message: t("actions.updateStatusPage.errors.generic") });
	}

	let existingStatusPage = await db().query.statusPages.findFirst({
		where(fields, operators) {
			return operators.and(
				operators.eq(fields.id, result.data.statusPageId),
				operators.eq(fields.teamId, team().id),
			);
		},
	});

	if (!existingStatusPage) {
		logger().info("action.update-status-page.not-found", {
			statusPageId: result.data.statusPageId,
		});
		return badRequest({ message: t("actions.updateStatusPage.errors.notFound") });
	}

	let slugTaken = await db().query.statusPages.findFirst({
		where(fields, operators) {
			return operators.and(
				operators.eq(fields.slug, result.data.slug),
				operators.ne(fields.id, result.data.statusPageId),
			);
		},
	});

	if (slugTaken) {
		logger().info("action.update-status-page.slug-taken", {
			slug: result.data.slug,
		});
		return badRequest({
			message: t("actions.updateStatusPage.errors.slugTaken"),
			errors: { slug: t("actions.updateStatusPage.errors.slugTaken") },
		});
	}

	await db()
		.update(schema.statusPages)
		.set({
			name: result.data.name,
			slug: result.data.slug,
			title: result.data.title,
			description: result.data.description || null,
			logoUrl: result.data.logoUrl || null,
			isPublic: result.data.isPublic,
			showOverallStatus: result.data.showOverallStatus,
		})
		.where(eq(schema.statusPages.id, result.data.statusPageId));

	await db()
		.delete(schema.statusPageMonitors)
		.where(eq(schema.statusPageMonitors.statusPageId, result.data.statusPageId));

	if (result.data.monitorIds.length > 0) {
		await db()
			.insert(schema.statusPageMonitors)
			.values(
				result.data.monitorIds.map((monitorId, index) => ({
					statusPageId: result.data.statusPageId,
					monitorId,
					order: index,
				})),
			);
	}

	await db()
		.delete(schema.statusPageCronJobs)
		.where(eq(schema.statusPageCronJobs.statusPageId, result.data.statusPageId));

	if (result.data.cronJobIds.length > 0) {
		await db()
			.insert(schema.statusPageCronJobs)
			.values(
				result.data.cronJobIds.map((cronJobMonitorId, index) => ({
					statusPageId: result.data.statusPageId,
					cronJobMonitorId,
					order: index,
				})),
			);
	}

	logger().info("action.update-status-page.success", {
		teamId: team().id,
		statusPageId: result.data.statusPageId,
	});

	throw redirect(href("/app/:team/status-pages", params));
}

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	let result = await serverAction();
	if (result && !result.ok) toast.error(result.message);
	return result;
}
