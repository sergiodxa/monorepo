/**
 * The identifier sub-resource under a subject: `POST .../:subjectId/identifiers` adds one,
 * `POST /tenants/:tenantId/subjects/identifiers/verify` spends a ticket that alone names its
 * subject, `.../identifiers/primary` moves the primary, and `DELETE .../identifiers?value=`
 * removes one by its value, since no identifier carries an id of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";
import type {
	AddIdentifierResult,
	RemoveIdentifierResult,
	SetPrimaryIdentifierResult,
	VerifyIdentifierResult,
} from "~/database/subjects";

import { subjectIdParam, subjectNotFound } from "~/app/http/controllers/management/subjects/shared";
import { operationInputProblem } from "~/app/http/lib/parse-body";
import { managementProblem } from "~/app/http/lib/problem";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import {
	SUBJECT_IDENTIFIERS_ADD,
	SUBJECT_IDENTIFIERS_REMOVE,
	SUBJECT_IDENTIFIERS_SET_PRIMARY,
	SUBJECT_IDENTIFIERS_VERIFY,
} from "~/app/http/openapi/subjects";
import routes from "~/routes/management";

/** An identifier named in a route's own path or body that this subject does not hold. */
function identifierNotFound(): Response {
	return managementProblem("notFound", {
		detail: "No such identifier exists for this subject.",
	});
}

function mountedMiddleware(options: ManagementControllerOptions, bucket: "read" | "write") {
	return [
		managementAuth({
			issuer: options.issuer,
			resolveDashboardSubjectId: options.resolveDashboardSubjectId,
		}),
		managementTenant(options.resolveStub),
		managementRateLimit(options.limiter, { bucket }),
	];
}

/** Maps every `addIdentifier` refusal onto its own `problem+json` response. */
function addIdentifierFailure(result: Exclude<AddIdentifierResult, { ok: true }>): Response {
	switch (result.reason) {
		case "not-found":
			return subjectNotFound();
		case "invalid-identifier":
			return managementProblem("invalidIdentifier", {
				detail: "The given identifier is not valid.",
			});
		case "identifier-taken":
			return managementProblem("identifierTaken", {
				detail: "This identifier is already claimed by another subject.",
			});
		case "username-already-set":
			return managementProblem("usernameAlreadySet");
		case "rate-limited":
			return managementProblem("rateLimited", {
				detail: `Too many verification emails have been sent to this address. Try again in ${result.retryAfterSeconds} seconds.`,
			});
	}
}

/**
 * Builds the `subjectIdentifiersAdd` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.subjectIdentifiersAdd, createSubjectIdentifiersAddAction(options));
 */
export function createSubjectIdentifiersAddAction(options: ManagementControllerOptions) {
	return createAction(routes.subjectIdentifiersAdd, {
		middleware: mountedMiddleware(options, "write"),
		handler: async (ctx) => {
			let refused = requireScope(ctx, "subjects:write");
			if (refused) return refused;

			let subjectId = subjectIdParam(ctx);

			let input = await SUBJECT_IDENTIFIERS_ADD.parse(ctx.request, ctx.params);
			if (isFailure(input)) return operationInputProblem(input.error);

			let result = await ctx.tenantStub.addIdentifier({
				subjectId,
				...input.data.body,
				actor: { kind: "admin" },
			});
			if (!result.ok) return addIdentifierFailure(result);

			let { cost: _cost, ok: _ok, ...body } = result;
			return json(body, { status: 201 });
		},
	});
}

/**
 * Maps every `verifyIdentifier` refusal onto its own `problem+json` response. Each
 * reason is its own problem type.
 */
function verifyIdentifierFailure(result: Exclude<VerifyIdentifierResult, { ok: true }>): Response {
	if (result.reason === "expired-ticket") return managementProblem("expiredTicket");
	return managementProblem("invalidVerificationTicket");
}

/**
 * Builds the `subjectIdentifiersVerify` action. Mounted at the tenant's own
 * subject collection rather than under one subject's path, since the ticket
 * alone resolves which subject and identifier it belongs to.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.subjectIdentifiersVerify, createSubjectIdentifiersVerifyAction(options));
 */
export function createSubjectIdentifiersVerifyAction(options: ManagementControllerOptions) {
	return createAction(routes.subjectIdentifiersVerify, {
		middleware: mountedMiddleware(options, "write"),
		handler: async (ctx) => {
			let refused = requireScope(ctx, "subjects:write");
			if (refused) return refused;

			let input = await SUBJECT_IDENTIFIERS_VERIFY.parse(ctx.request, ctx.params);
			if (isFailure(input)) return operationInputProblem(input.error);

			let result = await ctx.tenantStub.verifyIdentifier(input.data.body);
			if (!result.ok) return verifyIdentifierFailure(result);

			return json({ subjectId: result.subjectId, promotedPrimary: result.promotedPrimary });
		},
	});
}

/** Maps every `setPrimaryIdentifier` refusal onto its own `problem+json` response. */
function setPrimaryIdentifierFailure(
	result: Exclude<SetPrimaryIdentifierResult, { ok: true }>,
): Response {
	if (result.reason === "not-found") return identifierNotFound();

	return managementProblem("unverified");
}

/**
 * Builds the `subjectIdentifiersSetPrimary` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(
 * 	routes.subjectIdentifiersSetPrimary,
 * 	createSubjectIdentifiersSetPrimaryAction(options),
 * );
 */
export function createSubjectIdentifiersSetPrimaryAction(options: ManagementControllerOptions) {
	return createAction(routes.subjectIdentifiersSetPrimary, {
		middleware: mountedMiddleware(options, "write"),
		handler: async (ctx) => {
			let refused = requireScope(ctx, "subjects:write");
			if (refused) return refused;

			let subjectId = subjectIdParam(ctx);

			let input = await SUBJECT_IDENTIFIERS_SET_PRIMARY.parse(ctx.request, ctx.params);
			if (isFailure(input)) return operationInputProblem(input.error);

			let result = await ctx.tenantStub.setPrimaryIdentifier({
				subjectId,
				value: input.data.body.value,
				actor: { kind: "admin" },
			});
			if (!result.ok) return setPrimaryIdentifierFailure(result);

			return new Response(null, { status: 204 });
		},
	});
}

/** Maps every `removeIdentifier` refusal onto its own `problem+json` response. */
function removeIdentifierFailure(result: Exclude<RemoveIdentifierResult, { ok: true }>): Response {
	if (result.reason === "not-found") return identifierNotFound();

	return managementProblem("lastVerifiedIdentifier");
}

/**
 * Builds the `subjectIdentifiersRemove` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.subjectIdentifiersRemove, createSubjectIdentifiersRemoveAction(options));
 */
export function createSubjectIdentifiersRemoveAction(options: ManagementControllerOptions) {
	return createAction(routes.subjectIdentifiersRemove, {
		middleware: mountedMiddleware(options, "write"),
		handler: async (ctx) => {
			let refused = requireScope(ctx, "subjects:write");
			if (refused) return refused;

			let subjectId = subjectIdParam(ctx);
			let input = await SUBJECT_IDENTIFIERS_REMOVE.parse(ctx.request, ctx.params);
			if (isFailure(input)) return operationInputProblem(input.error);

			let result = await ctx.tenantStub.removeIdentifier({
				subjectId,
				value: input.data.query.value,
				actor: { kind: "admin" },
			});
			if (!result.ok) return removeIdentifierFailure(result);

			return json({ promotedPrimary: result.promotedPrimary, notify: result.notify });
		},
	});
}
