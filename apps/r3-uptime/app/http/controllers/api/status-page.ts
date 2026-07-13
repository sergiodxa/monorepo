/**
 * API v1 item endpoints for a single status page: get/update/delete
 * (`status-pages:read`/`status-pages:write`) and replacing its HTTP-monitor and
 * cron-job attachments in one call. DNS/TCP attachments have no API surface.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BadRequest, NotFound } from "@pkg/http/status-code";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import { Database } from "remix/data-table";
import { createController } from "remix/fetch-router";

import type { InsertStatusPage } from "~/database/schema";

import CronJobMonitor from "~/app/data/cron-job";
import Monitor from "~/app/data/monitor";
import StatusPage from "~/app/data/status-page";
import { serializeStatusPage } from "~/app/http/controllers/api/status-pages";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { apiError, apiSuccess } from "~/app/services/api-response";
import routes from "~/routes/web";

const SLUG_PATTERN = /^[a-z0-9-]+$/;
const StatusPageIdParams = s.object({ statusPageId: s.string() });

/** Loads a page plus its curated HTTP-monitor/cron-job id lists. */
async function loadWithAttachments(db: Database, teamId: string, statusPageId: string) {
	let statusPage = await StatusPage.findByIdForTeam(db, teamId, statusPageId);
	if (!statusPage) return null;
	let attached = await StatusPage.getAttachedIds(db, statusPageId);
	return {
		...serializeStatusPage(statusPage),
		monitors: attached.monitorIds,
		cronJobs: attached.cronJobIds,
	};
}

const UpdateStatusPageSchema = s.object({
	name: s.optional(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
	slug: s.optional(
		s
			.string()
			.pipe(checks.minLength(1))
			.refine(
				(value: string) => SLUG_PATTERN.test(value),
				"Slug must contain only lowercase letters, numbers, and hyphens",
			),
	),
	title: s.optional(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
	description: s.optional(s.string().pipe(checks.maxLength(500))),
	logoUrl: s.optional(s.string().pipe(checks.url())),
	customDomain: s.optional(s.string().pipe(checks.minLength(1))),
	isPublic: s.optional(s.boolean()),
	showOverallStatus: s.optional(s.boolean()),
});

const UpdateAssociationsSchema = s.object({
	monitorIds: s.defaulted(s.array(s.string()), []),
	cronJobIds: s.defaulted(s.array(s.string()), []),
});

/** Route leaves this controller handles, grouped for a single `router.map()` call. */
export const statusPageRoutes = {
	statusPageShow: routes.api.v1.statusPages.show,
	statusPageUpdate: routes.api.v1.statusPages.update,
	statusPageDestroy: routes.api.v1.statusPages.destroy,
	statusPageMonitors: routes.api.v1.statusPages.monitors,
};

export default createController(statusPageRoutes, {
	actions: {
		/** GET /api/v1/status-pages/:statusPageId — a status page with its attachment id lists. */
		statusPageShow: {
			middleware: [requireApiKey("status-pages:read")],
			handler: async (ctx) => {
				let { statusPageId } = s.parse(StatusPageIdParams, ctx.params);
				let db = getServiceContainer().get(Database);
				let statusPage = await loadWithAttachments(db, ctx.apiTeam.id, statusPageId);
				if (!statusPage) return apiError("NOT_FOUND", "Status page not found", NotFound);
				return apiSuccess({ statusPage });
			},
		},

		/** PUT /api/v1/status-pages/:statusPageId — updates a status page's own fields. */
		statusPageUpdate: {
			middleware: [requireApiKey("status-pages:write")],
			handler: async (ctx) => {
				let { statusPageId } = s.parse(StatusPageIdParams, ctx.params);
				let db = getServiceContainer().get(Database);
				let existing = await StatusPage.findByIdForTeam(db, ctx.apiTeam.id, statusPageId);
				if (!existing) return apiError("NOT_FOUND", "Status page not found", NotFound);

				let result = await validate(ctx.request, UpdateStatusPageSchema);
				if (isFailure(result)) {
					return apiError(
						"VALIDATION_ERROR",
						result.error.issues.map((issue) => issue.message).join(", "),
						BadRequest,
					);
				}

				if (
					result.data.slug !== undefined &&
					(await StatusPage.isSlugTaken(db, result.data.slug, existing.id))
				) {
					return apiError("VALIDATION_ERROR", "Slug is already in use", BadRequest);
				}

				let changes: Partial<InsertStatusPage> = {};
				if (result.data.name !== undefined) changes.name = result.data.name;
				if (result.data.slug !== undefined) changes.slug = result.data.slug;
				if (result.data.title !== undefined) changes.title = result.data.title;
				if (result.data.description !== undefined)
					changes.description = result.data.description ?? null;
				if (result.data.logoUrl !== undefined) changes.logo_url = result.data.logoUrl ?? null;
				if (result.data.customDomain !== undefined)
					changes.custom_domain = result.data.customDomain ?? null;
				if (result.data.isPublic !== undefined) changes.is_public = result.data.isPublic;
				if (result.data.showOverallStatus !== undefined)
					changes.show_overall_status = result.data.showOverallStatus;

				if (Object.keys(changes).length > 0) await StatusPage.updateById(db, statusPageId, changes);

				let statusPage = await loadWithAttachments(db, ctx.apiTeam.id, statusPageId);
				if (!statusPage)
					return apiError("INTERNAL_ERROR", "Failed to load updated status page", BadRequest);
				return apiSuccess({ statusPage });
			},
		},

		/** DELETE /api/v1/status-pages/:statusPageId — deletes a status page and its attachments. */
		statusPageDestroy: {
			middleware: [requireApiKey("status-pages:write")],
			handler: async (ctx) => {
				let { statusPageId } = s.parse(StatusPageIdParams, ctx.params);
				let db = getServiceContainer().get(Database);
				let existing = await StatusPage.findByIdForTeam(db, ctx.apiTeam.id, statusPageId);
				if (!existing) return apiError("NOT_FOUND", "Status page not found", NotFound);

				await StatusPage.deleteById(db, statusPageId);
				return apiSuccess({ deleted: true });
			},
		},

		/** PUT /api/v1/status-pages/:statusPageId/monitors — replaces attached monitors/cron jobs. */
		statusPageMonitors: {
			middleware: [requireApiKey("status-pages:write")],
			handler: async (ctx) => {
				let { statusPageId } = s.parse(StatusPageIdParams, ctx.params);
				let db = getServiceContainer().get(Database);
				let statusPage = await StatusPage.findByIdForTeam(db, ctx.apiTeam.id, statusPageId);
				if (!statusPage) return apiError("NOT_FOUND", "Status page not found", NotFound);

				let result = await validate(ctx.request, UpdateAssociationsSchema);
				if (isFailure(result)) {
					return apiError(
						"VALIDATION_ERROR",
						result.error.issues.map((issue) => issue.message).join(", "),
						BadRequest,
					);
				}

				let { monitorIds, cronJobIds } = result.data;

				if (monitorIds.length > 0) {
					let found = await Monitor.findManyByIdsForTeam(db, ctx.apiTeam.id, monitorIds);
					if (found.length !== monitorIds.length) {
						return apiError("NOT_FOUND", "One or more monitors not found", NotFound);
					}
				}

				if (cronJobIds.length > 0) {
					let found = await CronJobMonitor.findManyByIdsForTeam(db, ctx.apiTeam.id, cronJobIds);
					if (found.length !== cronJobIds.length) {
						return apiError("NOT_FOUND", "One or more cron jobs not found", NotFound);
					}
				}

				await StatusPage.setMonitors(db, statusPageId, monitorIds);
				await StatusPage.setCronJobs(db, statusPageId, cronJobIds);

				return apiSuccess({
					statusPage: serializeStatusPage(statusPage),
					monitors: monitorIds,
					cronJobs: cronJobIds,
				});
			},
		},
	},
});
