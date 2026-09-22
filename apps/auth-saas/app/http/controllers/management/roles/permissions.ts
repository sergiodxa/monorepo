/**
 * The tenant-wide permission catalog: `GET /permissions` lists it, `POST
 * /permissions` declares a new one, and `DELETE /permissions?key=` removes
 * one, dropping every role's grant of it in the same call.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";
import type { DefinePermissionResult, RemovePermissionResult } from "~/database/roles";

import {
	permissionNotFound,
	rolesEntitlementRequired,
} from "~/app/http/controllers/management/roles/shared";
import { parseBody } from "~/app/http/lib/parse-body";
import { problem } from "~/app/http/lib/problem";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import routes from "~/routes/management";

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

/**
 * Builds the `permissionsList` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.permissionsList, createPermissionsListAction(options));
 */
export function createPermissionsListAction(options: ManagementControllerOptions) {
	return createAction(routes.permissionsList, {
		middleware: mountedMiddleware(options, "read"),
		handler: async (ctx) => {
			let refused = requireScope(ctx.managementCaller, "members:write");
			if (refused) return refused;

			let result = await ctx.tenantStub.listPermissions();

			return json(result.permissions, { status: 200 });
		},
	});
}

let DefinePermissionBodySchema = s.object({
	key: s.string(),
	name: s.string(),
	description: s.string(),
});

/** Maps every `definePermission` refusal onto its own `problem+json` response. */
function definePermissionFailure(result: Exclude<DefinePermissionResult, { ok: true }>): Response {
	if (result.reason === "entitlement-required") return rolesEntitlementRequired();

	if (result.reason === "reserved-key") {
		return problem({
			type: "https://docs.example.com/errors/reserved-key",
			title: "This key is reserved for the platform's own management-API permissions",
			status: 400,
			detail: 'A tenant\'s own permission key may not begin "auth:".',
		});
	}

	return problem({
		type: "https://docs.example.com/errors/duplicate-permission",
		title: "This tenant already has a permission under this key",
		status: 409,
	});
}

/**
 * Builds the `permissionsDefine` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.permissionsDefine, createPermissionsDefineAction(options));
 */
export function createPermissionsDefineAction(options: ManagementControllerOptions) {
	return createAction(routes.permissionsDefine, {
		middleware: mountedMiddleware(options, "write"),
		handler: async (ctx) => {
			let refused = requireScope(ctx.managementCaller, "members:write");
			if (refused) return refused;

			let parsed = parseBody(
				DefinePermissionBodySchema,
				await ctx.request.json().catch(() => null),
			);
			if (!parsed.ok) return parsed.response;

			let result = await ctx.tenantStub.definePermission({
				...parsed.data,
				actor: ctx.managementCaller.actor,
			});
			if (!result.ok) return definePermissionFailure(result);

			return json(result.permission, { status: 201 });
		},
	});
}

let RemovePermissionQuerySchema = s.object({ key: s.string() });

/** Maps every `removePermission` refusal onto its own `problem+json` response. */
function removePermissionFailure(result: Exclude<RemovePermissionResult, { ok: true }>): Response {
	if (result.reason === "not-found") return permissionNotFound();
	return rolesEntitlementRequired();
}

/**
 * Builds the `permissionsRemove` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.permissionsRemove, createPermissionsRemoveAction(options));
 */
export function createPermissionsRemoveAction(options: ManagementControllerOptions) {
	return createAction(routes.permissionsRemove, {
		middleware: mountedMiddleware(options, "write"),
		handler: async (ctx) => {
			let refused = requireScope(ctx.managementCaller, "members:write");
			if (refused) return refused;

			let query = parseBody(RemovePermissionQuerySchema, Object.fromEntries(ctx.url.searchParams));
			if (!query.ok) return query.response;

			let result = await ctx.tenantStub.removePermission({
				key: query.data.key,
				actor: ctx.managementCaller.actor,
			});
			if (!result.ok) return removePermissionFailure(result);

			return new Response(null, { status: 204 });
		},
	});
}
