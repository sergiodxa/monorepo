/**
 * `PATCH /tenants/:tenantId/subjects/:subjectId` — applies an RFC 7396 merge patch
 * to a subject's profile columns and the attributes an administrator may set: `null`
 * clears a profile column and removes an attribute.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";
import type {
	AttributeValue,
	DescribeSubjectResult,
	UpdateSubjectResult,
} from "~/database/subjects";

import { subjectIdParam, subjectNotFound } from "~/app/http/controllers/management/subjects/shared";
import { patchResource } from "~/app/http/lib/merge-patch";
import { managementProblem } from "~/app/http/lib/problem";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import routes from "~/routes/management";

/** The profile claims an administrator writes, each absent when the subject holds none. */
const PROFILE_KEYS = [
	"name",
	"givenName",
	"familyName",
	"nickname",
	"preferredUsername",
	"picture",
	"locale",
	"zoneinfo",
] as const;

/**
 * A subject's writable projection: the shape a patched subject must have. Every member
 * is optional because an absent claim or attribute is how a merge patch clears one.
 */
let WritableSubjectSchema = s.object({
	profile: s.optional(
		s.object({
			name: s.optional(s.string()),
			givenName: s.optional(s.string()),
			familyName: s.optional(s.string()),
			nickname: s.optional(s.string()),
			preferredUsername: s.optional(s.string()),
			picture: s.optional(s.string()),
			locale: s.optional(s.string()),
			zoneinfo: s.optional(s.string()),
		}),
	),
	attributes: s.optional(s.record(s.string(), s.union([s.string(), s.number(), s.boolean()]))),
});

/**
 * Projects a described subject onto {@link WritableSubjectSchema}, leaving out every
 * `null`, which a merge patch cannot hold as a value.
 */
function writableSubject(subject: Extract<DescribeSubjectResult, { ok: true }>) {
	let profile: Record<string, string> = {};
	for (let key of PROFILE_KEYS) {
		let value = subject.profile[key];
		if (typeof value === "string") profile[key] = value;
	}

	let attributes: Record<string, Exclude<AttributeValue, null>> = {};
	for (let [key, value] of Object.entries(subject.attributes)) {
		if (value !== null) attributes[key] = value;
	}

	return { profile, attributes };
}

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

			let described = await ctx.tenantStub.describeSubject({
				subjectId,
				audience: { kind: "admin" },
			});
			if (!described.ok) return subjectNotFound();

			let patched = await patchResource(
				ctx.request,
				writableSubject(described),
				WritableSubjectSchema,
			);
			if (!patched.ok) return patched.response;

			let changes = patched.changes as {
				profile?: Record<string, string | null>;
				attributes?: Record<string, AttributeValue>;
			};

			let result = await ctx.tenantStub.updateSubject({
				subjectId,
				profile: changes.profile,
				attributes: changes.attributes,
				actor: { kind: "admin" },
			});
			if (!result.ok) return updateSubjectFailure(result);

			return new Response(null, { status: 204 });
		},
	});
}
