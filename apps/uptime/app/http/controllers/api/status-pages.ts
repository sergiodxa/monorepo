/**
 * API v1 collection endpoints for status pages: `GET /api/v1/status-pages` lists a
 * team's pages and `POST /api/v1/status-pages` creates one with a globally-unique
 * slug. Requires `status-pages:read`/`status-pages:write` via `requireApiKey`. Only
 * HTTP-monitor and cron-job attachments are exposed over the API; DNS/TCP
 * attachments have no API surface.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BadRequest, Created } from "@pkg/http/status-code";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import { Database } from "remix/data-table";
import { createController } from "remix/router";

import type { SelectStatusPage } from "~/database/schema";

import StatusPage from "~/app/data/status-page";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { apiError, apiSuccess } from "~/app/services/api-response";
import routes from "~/routes/web";

const SLUG_PATTERN = /^[a-z0-9-]+$/;

/** Maps a status-page row to its public camelCase JSON shape. */
export function serializeStatusPage(page: SelectStatusPage) {
	return {
		id: page.id,
		name: page.name,
		slug: page.slug,
		title: page.title,
		description: page.description,
		logoUrl: page.logo_url,
		customDomain: page.custom_domain,
		isPublic: page.is_public,
		showOverallStatus: page.show_overall_status,
		createdAt: page.created_at,
		updatedAt: page.updated_at,
	};
}

const CreateStatusPageSchema = s.object({
	name: s.string().pipe(checks.minLength(1), checks.maxLength(255)),
	slug: s
		.string()
		.pipe(checks.minLength(1))
		.refine(
			(value: string) => SLUG_PATTERN.test(value),
			"Slug must contain only lowercase letters, numbers, and hyphens",
		),
	title: s.optional(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
	description: s.optional(s.string().pipe(checks.maxLength(500))),
	logoUrl: s.optional(s.string().pipe(checks.url())),
	customDomain: s.optional(s.string().pipe(checks.minLength(1))),
	isPublic: s.defaulted(s.boolean(), true),
	showOverallStatus: s.defaulted(s.boolean(), true),
});

/** Route leaves this controller handles, grouped for a single `router.map()` call. */
export const statusPagesRoutes = {
	statusPagesIndex: routes.api.v1.statusPages.index,
	statusPagesCreate: routes.api.v1.statusPages.create,
};

export default createController(statusPagesRoutes, {
	actions: {
		/** GET /api/v1/status-pages — lists the team's status pages. */
		statusPagesIndex: {
			middleware: [requireApiKey("status-pages:read")],
			handler: async (ctx) => {
				let db = getServiceContainer().get(Database);
				let statusPages = await StatusPage.listByTeam(db, ctx.apiTeam.id);
				return apiSuccess({ statusPages: statusPages.map(serializeStatusPage) });
			},
		},

		/** POST /api/v1/status-pages — creates a status page for the team. */
		statusPagesCreate: {
			middleware: [requireApiKey("status-pages:write")],
			handler: async (ctx) => {
				let result = await validate(ctx.request, CreateStatusPageSchema);
				if (isFailure(result)) {
					return apiError(
						"VALIDATION_ERROR",
						result.error.issues.map((issue) => issue.message).join(", "),
						BadRequest,
					);
				}

				let db = getServiceContainer().get(Database);
				if (await StatusPage.isSlugTaken(db, result.data.slug)) {
					return apiError("VALIDATION_ERROR", "Slug is already in use", BadRequest);
				}

				let statusPage = await StatusPage.create(db, ctx.apiTeam.id, {
					name: result.data.name,
					slug: result.data.slug,
					title: result.data.title ?? result.data.name,
					description: result.data.description ?? null,
					logo_url: result.data.logoUrl ?? null,
					custom_domain: result.data.customDomain ?? null,
					is_public: result.data.isPublic,
					show_overall_status: result.data.showOverallStatus,
				});

				return apiSuccess({ statusPage: serializeStatusPage(statusPage) }, Created);
			},
		},
	},
});
