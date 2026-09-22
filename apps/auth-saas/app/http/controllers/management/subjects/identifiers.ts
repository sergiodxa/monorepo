/**
 * The identifier sub-resource under a subject: `POST .../identifiers` adds one,
 * `POST .../identifiers/verify` spends a verification ticket, `POST
 * .../identifiers/primary` moves which one is primary, and `DELETE
 * .../identifiers/:value` removes one, addressed by its own value the same way
 * `addIdentifier`/`setPrimaryIdentifier`/`removeIdentifier` already take it —
 * no identifier carries an id of its own in the tenant object's public shapes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";
import type {
	AddIdentifierResult,
	RemoveIdentifierResult,
	SetPrimaryIdentifierResult,
	VerifyIdentifierResult,
} from "~/database/subjects";

import { subjectIdParam, subjectNotFound } from "~/app/http/controllers/management/subjects/shared";
import { parseBody } from "~/app/http/lib/parse-body";
import { problem } from "~/app/http/lib/problem";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import routes from "~/routes/management";

/** An identifier named in a route's own path or body that this subject does not hold. */
function identifierNotFound(): Response {
	return problem({
		type: "https://docs.example.com/errors/not-found",
		title: "No such identifier exists for this subject",
		status: 404,
	});
}

/** Parses and requires the `:value` path param the remove route matches, URL-decoded. */
function identifierValueParam(ctx: { params: Record<string, string | undefined> }): string {
	let raw = s.parse(s.object({ value: s.string() }), ctx.params).value;
	return decodeURIComponent(raw);
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

let AddIdentifierBodySchema = s.object({
	kind: s.enum_(["email", "username"] as const),
	value: s.string(),
});

/** Maps every `addIdentifier` refusal onto its own `problem+json` response. */
function addIdentifierFailure(result: Exclude<AddIdentifierResult, { ok: true }>): Response {
	switch (result.reason) {
		case "not-found":
			return subjectNotFound();
		case "invalid-identifier":
			return problem({
				type: "https://docs.example.com/errors/invalid-identifier",
				title: "The given identifier is not valid",
				status: 400,
			});
		case "identifier-taken":
			return problem({
				type: "https://docs.example.com/errors/identifier-taken",
				title: "This identifier is already claimed by another subject",
				status: 409,
			});
		case "username-already-set":
			return problem({
				type: "https://docs.example.com/errors/username-already-set",
				title: "This subject already holds a username",
				status: 409,
			});
		case "rate-limited":
			return problem({
				type: "https://docs.example.com/errors/rate-limited",
				title: "Too many verification emails have been sent to this address",
				status: 429,
				detail: `Try again in ${result.retryAfterSeconds} seconds.`,
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
			let refused = requireScope(ctx.managementCaller, "subjects:write");
			if (refused) return refused;

			let subjectId = subjectIdParam(ctx);

			let parsed = parseBody(AddIdentifierBodySchema, await ctx.request.json().catch(() => null));
			if (!parsed.ok) return parsed.response;

			let result = await ctx.tenantStub.addIdentifier({
				subjectId,
				...parsed.data,
				actor: { kind: "admin" },
			});
			if (!result.ok) return addIdentifierFailure(result);

			let { cost: _cost, ok: _ok, ...body } = result;
			return json(body, { status: 201 });
		},
	});
}

let VerifyIdentifierBodySchema = s.object({ ticket: s.string() });

/** Maps every `verifyIdentifier` refusal onto its own `problem+json` response. */
function verifyIdentifierFailure(result: Exclude<VerifyIdentifierResult, { ok: true }>): Response {
	return problem({
		type: `https://docs.example.com/errors/${result.reason}`,
		title:
			result.reason === "invalid-ticket"
				? "This verification ticket does not match a pending identifier"
				: "This verification ticket has expired",
		status: 400,
	});
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
			let refused = requireScope(ctx.managementCaller, "subjects:write");
			if (refused) return refused;

			let parsed = parseBody(
				VerifyIdentifierBodySchema,
				await ctx.request.json().catch(() => null),
			);
			if (!parsed.ok) return parsed.response;

			let result = await ctx.tenantStub.verifyIdentifier(parsed.data);
			if (!result.ok) return verifyIdentifierFailure(result);

			return json({ subjectId: result.subjectId, promotedPrimary: result.promotedPrimary });
		},
	});
}

let SetPrimaryIdentifierBodySchema = s.object({ value: s.string() });

/** Maps every `setPrimaryIdentifier` refusal onto its own `problem+json` response. */
function setPrimaryIdentifierFailure(
	result: Exclude<SetPrimaryIdentifierResult, { ok: true }>,
): Response {
	if (result.reason === "not-found") return identifierNotFound();

	return problem({
		type: "https://docs.example.com/errors/unverified",
		title: "An unverified identifier may not become primary",
		status: 409,
	});
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
			let refused = requireScope(ctx.managementCaller, "subjects:write");
			if (refused) return refused;

			let subjectId = subjectIdParam(ctx);

			let parsed = parseBody(
				SetPrimaryIdentifierBodySchema,
				await ctx.request.json().catch(() => null),
			);
			if (!parsed.ok) return parsed.response;

			let result = await ctx.tenantStub.setPrimaryIdentifier({
				subjectId,
				value: parsed.data.value,
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

	return problem({
		type: "https://docs.example.com/errors/last-verified-identifier",
		title: "This subject's last verified identifier may not be removed",
		status: 409,
	});
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
			let refused = requireScope(ctx.managementCaller, "subjects:write");
			if (refused) return refused;

			let subjectId = subjectIdParam(ctx);
			let value = identifierValueParam(ctx);

			let result = await ctx.tenantStub.removeIdentifier({
				subjectId,
				value,
				actor: { kind: "admin" },
			});
			if (!result.ok) return removeIdentifierFailure(result);

			return json({ promotedPrimary: result.promotedPrimary, notify: result.notify });
		},
	});
}
