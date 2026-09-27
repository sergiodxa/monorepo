/**
 * `PATCH /tenants/:tenantId/subjects/:subjectId` — writes a subject's profile
 * columns and the attributes an administrator may set.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";
import type { UpdateSubjectResult } from "~/database/subjects";

import { subjectIdParam, subjectNotFound } from "~/app/http/controllers/management/subjects/shared";
import { parseBody } from "~/app/http/lib/parse-body";
import { managementProblem } from "~/app/http/lib/problem";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import routes from "~/routes/management";

let UpdateSubjectBodySchema = s.object({
	profile: s.optional(
		s.object({
			name: s.optional(s.nullable(s.string())),
			givenName: s.optional(s.nullable(s.string())),
			familyName: s.optional(s.nullable(s.string())),
			nickname: s.optional(s.nullable(s.string())),
			preferredUsername: s.optional(s.nullable(s.string())),
			picture: s.optional(s.nullable(s.string())),
			locale: s.optional(s.nullable(s.string())),
			zoneinfo: s.optional(s.nullable(s.string())),
		}),
	),
	attributes: s.optional(s.record(s.string(), s.any())),
});

/** Maps every `updateSubject` refusal onto its own `problem+json` response. */
function updateSubjectFailure(result: Exclude<UpdateSubjectResult, { ok: true }>): Response {
	if (result.reason === "not-found") return subjectNotFound();

	if (result.reason === "unknown-attribute") {
		return managementProblem("unknownAttribute", {
			detail: `"${result.key}" has not been declared for this tenant.`,
		});
	}

	return managementProblem("attributeNotWritable", {
		detail: `"${result.key}" is not writable by an administrator's own call.`,
	});
}

/**
 * Builds the `subjectsUpdate` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.subjectsUpdate, createSubjectsUpdateAction(options));
 */
export function createSubjectsUpdateAction(options: ManagementControllerOptions) {
	return createAction(routes.subjectsUpdate, {
		middleware: [
			managementAuth({
				issuer: options.issuer,
				resolveDashboardSubjectId: options.resolveDashboardSubjectId,
			}),
			managementTenant(options.resolveStub),
			managementRateLimit(options.limiter, { bucket: "write" }),
		],
		handler: async (ctx) => {
			let refused = requireScope(ctx, "subjects:write");
			if (refused) return refused;

			let subjectId = subjectIdParam(ctx);

			let parsed = parseBody(UpdateSubjectBodySchema, await ctx.request.json().catch(() => null));
			if (!parsed.ok) return parsed.response;

			let result = await ctx.tenantStub.updateSubject({
				subjectId,
				...parsed.data,
				actor: { kind: "admin" },
			});
			if (!result.ok) return updateSubjectFailure(result);

			return new Response(null, { status: 204 });
		},
	});
}
