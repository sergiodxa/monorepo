/**
 * Route module for the team "create status page" action. Validates the page fields and
 * selected monitor/cron-job ids, enforces slug uniqueness, inserts the status page, and
 * links the chosen monitors and cron jobs in order. Exists so teams can publish a new
 * public status page and are redirected back to their status pages list.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { badRequest } from "@pkg/response";
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
	logger().info("action.start", { route: "create-status-page", method: request.method });

	let result = await validate(request, inputSchema);
	let { t } = i18next(context);

	if (isFailure(result)) {
		logger().info("action.create-status-page.validation-failed", {
			issues: result.error.issues,
		});
		return badRequest({ message: t("actions.createStatusPage.errors.generic") });
	}

	let existingSlug = await db().query.statusPages.findFirst({
		where(fields, operators) {
			return operators.eq(fields.slug, result.data.slug);
		},
	});

	if (existingSlug) {
		logger().info("action.create-status-page.slug-taken", {
			slug: result.data.slug,
		});
		return badRequest({
			message: t("actions.createStatusPage.errors.slugTaken"),
			errors: { slug: t("actions.createStatusPage.errors.slugTaken") },
		});
	}

	let [statusPage] = await db()
		.insert(schema.statusPages)
		.values({
			teamId: team().id,
			name: result.data.name,
			slug: result.data.slug,
			title: result.data.title,
			description: result.data.description || null,
			logoUrl: result.data.logoUrl || null,
			isPublic: result.data.isPublic,
			showOverallStatus: result.data.showOverallStatus,
		})
		.returning();

	if (!statusPage) {
		logger().error("action.create-status-page.insert-failed", {
			teamId: team().id,
		});
		return badRequest({ message: t("actions.createStatusPage.errors.generic") });
	}

	if (result.data.monitorIds.length > 0) {
		await db()
			.insert(schema.statusPageMonitors)
			.values(
				result.data.monitorIds.map((monitorId, index) => ({
					statusPageId: statusPage.id,
					monitorId,
					order: index,
				})),
			);
	}

	if (result.data.cronJobIds.length > 0) {
		await db()
			.insert(schema.statusPageCronJobs)
			.values(
				result.data.cronJobIds.map((cronJobMonitorId, index) => ({
					statusPageId: statusPage.id,
					cronJobMonitorId,
					order: index,
				})),
			);
	}

	logger().info("action.create-status-page.success", {
		teamId: team().id,
		statusPageId: statusPage.id,
	});

	throw redirect(href("/app/:team/status-pages", params));
}

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	let result = await serverAction();
	if (result && !result.ok) toast.error(result.message);
	return result;
}
