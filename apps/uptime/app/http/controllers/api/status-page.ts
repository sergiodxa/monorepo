/**
 * API v1 item endpoints for a single status page: get/update/delete
 * (`status-pages:read`/`status-pages:write`) and replacing its HTTP-monitor and
 * cron-job attachments in one call — the only attachment types the API exposes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import * as s from "@sdxc/json-schema";
import { issuesFrom } from "@sdxc/problem";
import { isFailure, unwrap } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createController } from "remix/router";

import type { UptimeModels } from "~/app/models";
import type { InsertStatusPage, SelectStatusPage } from "~/database/schema";

import { serializeStatusPage } from "~/app/http/controllers/api/status-pages";
import catchValidationError from "~/app/http/middleware/catch-validation-error";
import requireApiKey from "~/app/http/middleware/require-api-key";
import {
	STATUS_PAGE_ID_PARAMS,
	UPDATE_ATTACHMENTS_BODY,
	UPDATE_STATUS_PAGE_BODY,
	WRITABLE_STATUS_PAGE,
} from "~/app/http/openapi/status-pages";
import { apiProblems, problemInstance } from "~/app/services/api-problems";
import { apiSuccess } from "~/app/services/api-response";
import { readApiUpdate } from "~/app/services/api-update";
import { encodeId } from "~/app/services/typed-id";
import { statusPageRoutes } from "~/routes/api-groups";

/** Loads a page plus its curated HTTP-monitor/cron-job id lists. */
async function loadWithAttachments(models: UptimeModels, teamId: string, statusPageId: string) {
	let statusPage = await models.statusPages.inTeam(teamId).find(statusPageId);
	if (!statusPage) return null;
	let attached = await models.statusPages.getAttachedIds(statusPageId);
	return {
		...serializeStatusPage(statusPage),
		monitors: attached.monitorIds.map((id) => encodeId("mon", id)),
		cronJobs: attached.cronJobIds.map((id) => encodeId("cron", id)),
	};
}

/**
 * The page's writable members as the API reads them, the target a `PATCH` merge patch
 * applies to.
 */
function writableStatusPage(page: SelectStatusPage) {
	return {
		name: page.name,
		slug: page.slug,
		title: page.title,
		description: page.description,
		logoUrl: page.logo_url,
		customDomain: page.custom_domain,
		isPublic: page.is_public,
		showOverallStatus: page.show_overall_status,
	};
}

/**
 * Applies a `PATCH` merge patch to one status page, writing only the members it changed.
 * A removed `title` falls back to `name`, as on create; the slug is checked for uniqueness
 * only when the patch changes it.
 *
 * @param ctx - The request, after `requireApiKey("status-pages:write")`.
 * @returns The updated page with its attachments; a 404 for a page outside the team, before
 *   the body is read.
 */
async function patchStatusPage(ctx: RequestContext): Promise<Response> {
	let { statusPageId } = s.parse(STATUS_PAGE_ID_PARAMS, ctx.params);
	let existing = await ctx.models.statusPages.inTeam(ctx.apiTeam.id).find(statusPageId);
	if (!existing)
		return apiProblems.notFound({ detail: "Status page not found", instance: problemInstance() });

	let update = await readApiUpdate(ctx.request, writableStatusPage(existing), WRITABLE_STATUS_PAGE);
	if (update instanceof Response) return update;
	let { value, changed } = update;

	if (changed.has("slug") && (await ctx.models.statusPages.isSlugTaken(value.slug, existing.id))) {
		return apiProblems.conflict({ detail: "Slug is already in use", instance: problemInstance() });
	}

	let changes: Partial<InsertStatusPage> = {};
	if (changed.has("name")) changes.name = value.name;
	if (changed.has("slug")) changes.slug = value.slug;
	if (changed.has("title")) changes.title = value.title ?? value.name;
	if (changed.has("description")) changes.description = value.description ?? null;
	if (changed.has("logoUrl")) changes.logo_url = value.logoUrl ?? null;
	if (changed.has("customDomain")) changes.custom_domain = value.customDomain ?? null;
	if (changed.has("isPublic")) changes.is_public = value.isPublic;
	if (changed.has("showOverallStatus")) changes.show_overall_status = value.showOverallStatus;

	if (Object.keys(changes).length > 0)
		unwrap(await ctx.models.statusPages.update(statusPageId, changes));

	let statusPage = await loadWithAttachments(ctx.models, ctx.apiTeam.id, statusPageId);
	if (!statusPage)
		return apiProblems.internalError({
			detail: "Failed to load updated status page",
			instance: problemInstance(),
		});
	return apiSuccess({ statusPage });
}

export default createController(statusPageRoutes, {
	middleware: [catchValidationError()],
	actions: {
		/** GET /api/v1/status-pages/:statusPageId — a status page with its attachment id lists. */
		statusPageShow: {
			middleware: [requireApiKey("status-pages:read")],
			handler: async (ctx) => {
				let { statusPageId } = s.parse(STATUS_PAGE_ID_PARAMS, ctx.params);
				let statusPage = await loadWithAttachments(ctx.models, ctx.apiTeam.id, statusPageId);
				if (!statusPage)
					return apiProblems.notFound({
						detail: "Status page not found",
						instance: problemInstance(),
					});
				return apiSuccess({ statusPage });
			},
		},

		/** PATCH /api/v1/status-pages/:statusPageId — merge-patches a status page's own fields. */
		statusPagePatch: {
			middleware: [requireApiKey("status-pages:write")],
			handler: patchStatusPage,
		},

		/** PUT /api/v1/status-pages/:statusPageId — updates a status page's own fields. */
		statusPageUpdate: {
			middleware: [requireApiKey("status-pages:write")],
			handler: async (ctx) => {
				let { statusPageId } = s.parse(STATUS_PAGE_ID_PARAMS, ctx.params);
				let existing = await ctx.models.statusPages.inTeam(ctx.apiTeam.id).find(statusPageId);
				if (!existing)
					return apiProblems.notFound({
						detail: "Status page not found",
						instance: problemInstance(),
					});

				let result = await validate(ctx.request, UPDATE_STATUS_PAGE_BODY);
				if (isFailure(result)) {
					return apiProblems.validationError({
						instance: problemInstance(),
						extensions: { errors: issuesFrom(result.error) },
					});
				}

				if (
					result.data.slug !== undefined &&
					(await ctx.models.statusPages.isSlugTaken(result.data.slug, existing.id))
				) {
					return apiProblems.conflict({
						detail: "Slug is already in use",
						instance: problemInstance(),
					});
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

				if (Object.keys(changes).length > 0)
					unwrap(await ctx.models.statusPages.update(statusPageId, changes));

				let statusPage = await loadWithAttachments(ctx.models, ctx.apiTeam.id, statusPageId);
				if (!statusPage)
					return apiProblems.internalError({
						detail: "Failed to load updated status page",
						instance: problemInstance(),
					});
				return apiSuccess({ statusPage });
			},
		},

		/** DELETE /api/v1/status-pages/:statusPageId — deletes a status page and its attachments. */
		statusPageDestroy: {
			middleware: [requireApiKey("status-pages:write")],
			handler: async (ctx) => {
				let { statusPageId } = s.parse(STATUS_PAGE_ID_PARAMS, ctx.params);
				let existing = await ctx.models.statusPages.inTeam(ctx.apiTeam.id).find(statusPageId);
				if (!existing)
					return apiProblems.notFound({
						detail: "Status page not found",
						instance: problemInstance(),
					});

				unwrap(await ctx.models.statusPages.delete(statusPageId));
				return apiSuccess({ deleted: true });
			},
		},

		/** PUT /api/v1/status-pages/:statusPageId/monitors — replaces attached monitors/cron jobs. */
		statusPageMonitors: {
			middleware: [requireApiKey("status-pages:write")],
			handler: async (ctx) => {
				let { statusPageId } = s.parse(STATUS_PAGE_ID_PARAMS, ctx.params);
				let statusPage = await ctx.models.statusPages.inTeam(ctx.apiTeam.id).find(statusPageId);
				if (!statusPage)
					return apiProblems.notFound({
						detail: "Status page not found",
						instance: problemInstance(),
					});

				let result = await validate(ctx.request, UPDATE_ATTACHMENTS_BODY);
				if (isFailure(result)) {
					return apiProblems.validationError({
						instance: problemInstance(),
						extensions: { errors: issuesFrom(result.error) },
					});
				}

				/** A repeated id names one attachment, so it is counted once when checking ownership. */
				let monitorIds = [...new Set(result.data.monitorIds)];
				let cronJobIds = [...new Set(result.data.cronJobIds)];

				if (monitorIds.length > 0) {
					let found = await ctx.models.monitors.findManyInTeam(ctx.apiTeam.id, monitorIds);
					if (found.length !== monitorIds.length) {
						return apiProblems.notFound({
							detail: "One or more monitors not found",
							instance: problemInstance(),
						});
					}
				}

				if (cronJobIds.length > 0) {
					let found = await ctx.models.cronJobMonitors.inTeamWithIds(ctx.apiTeam.id, cronJobIds);
					if (found.length !== cronJobIds.length) {
						return apiProblems.notFound({
							detail: "One or more cron jobs not found",
							instance: problemInstance(),
						});
					}
				}

				await ctx.models.statusPages.setMonitors(statusPageId, monitorIds);
				await ctx.models.statusPages.setCronJobs(statusPageId, cronJobIds);

				return apiSuccess({
					statusPage: serializeStatusPage(statusPage),
					monitors: monitorIds.map((id) => encodeId("mon", id)),
					cronJobs: cronJobIds.map((id) => encodeId("cron", id)),
				});
			},
		},
	},
});
