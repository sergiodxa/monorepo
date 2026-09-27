/**
 * `POST /tenants/:tenantId/subjects` — creates a subject with its claimed
 * identifiers, standard profile claims and declared attributes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";
import type { CreateSubjectResult } from "~/database/subjects";

import { parseBody } from "~/app/http/lib/parse-body";
import { managementProblem } from "~/app/http/lib/problem";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import routes from "~/routes/management";

let ProfileSchema = s.object({
	name: s.optional(s.nullable(s.string())),
	givenName: s.optional(s.nullable(s.string())),
	familyName: s.optional(s.nullable(s.string())),
	nickname: s.optional(s.nullable(s.string())),
	preferredUsername: s.optional(s.nullable(s.string())),
	picture: s.optional(s.nullable(s.string())),
	locale: s.optional(s.nullable(s.string())),
	zoneinfo: s.optional(s.nullable(s.string())),
});

let CreateSubjectBodySchema = s.object({
	identifiers: s.optional(
		s.array(s.object({ kind: s.enum_(["email", "username"] as const), value: s.string() })),
	),
	profile: s.optional(ProfileSchema),
	attributes: s.optional(s.record(s.string(), s.any())),
});

/** Maps every `createSubject` refusal onto its own `problem+json` response. */
function createSubjectFailure(result: Exclude<CreateSubjectResult, { ok: true }>): Response {
	switch (result.reason) {
		case "invalid-identifier":
			return managementProblem("invalidIdentifier", {
				detail: `"${result.value}" is not a valid ${result.kind}.`,
			});
		case "identifier-taken":
			return managementProblem("identifierTaken", {
				detail: `"${result.value}" is already claimed by another subject.`,
			});
		case "duplicate-username":
			return managementProblem("duplicateUsername");
		case "unknown-attribute":
			return managementProblem("unknownAttribute", {
				detail: `"${result.key}" has not been declared for this tenant.`,
			});
	}
}

/**
 * Builds the `subjectsCreate` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.subjectsCreate, createSubjectsCreateAction(options));
 */
export function createSubjectsCreateAction(options: ManagementControllerOptions) {
	return createAction(routes.subjectsCreate, {
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

			let parsed = parseBody(CreateSubjectBodySchema, await ctx.request.json().catch(() => null));
			if (!parsed.ok) return parsed.response;

			let result = await ctx.tenantStub.createSubject(parsed.data);
			if (!result.ok) return createSubjectFailure(result);

			return json(
				{ subjectId: result.subjectId, identifiers: result.identifiers },
				{ status: 201 },
			);
		},
	});
}
