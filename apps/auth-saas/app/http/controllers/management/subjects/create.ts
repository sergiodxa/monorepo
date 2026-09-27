/**
 * `POST /tenants/:tenantId/subjects` — creates a subject with its claimed
 * identifiers, standard profile claims and declared attributes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";
import type { CreateSubjectResult } from "~/database/subjects";

import { operationInputProblem } from "~/app/http/lib/parse-body";
import { managementProblem } from "~/app/http/lib/problem";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementIdempotency } from "~/app/http/middleware/management-idempotency";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import { SUBJECTS_CREATE } from "~/app/http/openapi/subjects";
import routes from "~/routes/management";

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
			managementIdempotency,
		],
		handler: async (ctx) => {
			let refused = requireScope(ctx, "subjects:write");
			if (refused) return refused;

			let input = await SUBJECTS_CREATE.parse(ctx.request, ctx.params);
			if (isFailure(input)) return operationInputProblem(input.error);

			let result = await ctx.tenantStub.createSubject(input.data.body);
			if (!result.ok) return createSubjectFailure(result);

			return json(
				{ subjectId: result.subjectId, identifiers: result.identifiers },
				{ status: 201 },
			);
		},
	});
}
