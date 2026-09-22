/**
 * The member sub-resource under a tenant: `GET .../members` lists them, `POST
 * .../members` grants a subject access at a role — a direct grant rather than
 * an email invitation, since no separate invitation mechanism exists in this
 * codebase today — `PUT .../members/:membershipId` changes a membership's
 * role, and `DELETE .../members/:membershipId` revokes one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { json } from "@sdxc/http/response";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";
import type { MembershipRow } from "~/app/models/membership";

import {
	membershipIdParam,
	membershipNotFound,
	mountedMiddleware,
	serializeMembership,
} from "~/app/http/controllers/management/tenants/shared";
import { parseBody } from "~/app/http/lib/parse-body";
import { requireScope } from "~/app/http/lib/require-scope";
import Membership from "~/app/models/membership";
import routes from "~/routes/management";

/**
 * Finds a membership by id, scoped to the caller's own tenant — a membership
 * id alone names no tenant of its own, so every read and write here checks
 * this rather than trusting the path segment.
 */
async function findOwnMembership(
	db: Database,
	tenantId: string,
	membershipId: string,
): Promise<MembershipRow | null> {
	let memberships = await Membership.listByTenant(db, tenantId);
	return memberships.find((membership) => membership.id === membershipId) ?? null;
}

/**
 * Builds the `tenantMembersList` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.tenantMembersList, createTenantMembersListAction(options));
 */
export function createTenantMembersListAction(options: ManagementControllerOptions) {
	return createAction(routes.tenantMembersList, {
		middleware: mountedMiddleware(options, "read"),
		handler: async (ctx) => {
			let refused = requireScope(ctx.managementCaller, "members:write");
			if (refused) return refused;

			let memberships = await Membership.listByTenant(ctx.db, ctx.managementCaller.tenantId);

			return json(memberships.map(serializeMembership), { status: 200 });
		},
	});
}

let CreateMemberBodySchema = s.object({
	subjectId: s.string(),
	role: s.enum_(["owner", "admin", "member"] as const),
});

/**
 * Builds the `tenantMembersCreate` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.tenantMembersCreate, createTenantMembersCreateAction(options));
 */
export function createTenantMembersCreateAction(options: ManagementControllerOptions) {
	return createAction(routes.tenantMembersCreate, {
		middleware: mountedMiddleware(options, "write"),
		handler: async (ctx) => {
			let refused = requireScope(ctx.managementCaller, "members:write");
			if (refused) return refused;

			let parsed = parseBody(CreateMemberBodySchema, await ctx.request.json().catch(() => null));
			if (!parsed.ok) return parsed.response;

			let membership = await Membership.create(ctx.db, {
				tenantId: ctx.managementCaller.tenantId,
				subjectId: parsed.data.subjectId,
				role: parsed.data.role,
			});

			return json(serializeMembership(membership), { status: 201 });
		},
	});
}

let UpdateMemberRoleBodySchema = s.object({ role: s.enum_(["owner", "admin", "member"] as const) });

/**
 * Builds the `tenantMembersUpdateRole` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.tenantMembersUpdateRole, createTenantMembersUpdateRoleAction(options));
 */
export function createTenantMembersUpdateRoleAction(options: ManagementControllerOptions) {
	return createAction(routes.tenantMembersUpdateRole, {
		middleware: mountedMiddleware(options, "write"),
		handler: async (ctx) => {
			let refused = requireScope(ctx.managementCaller, "members:write");
			if (refused) return refused;

			let membershipId = membershipIdParam(ctx);

			let parsed = parseBody(
				UpdateMemberRoleBodySchema,
				await ctx.request.json().catch(() => null),
			);
			if (!parsed.ok) return parsed.response;

			let existing = await findOwnMembership(ctx.db, ctx.managementCaller.tenantId, membershipId);
			if (!existing) return membershipNotFound();

			let updated = await Membership.update(ctx.db, membershipId, parsed.data.role);

			return json(serializeMembership(updated), { status: 200 });
		},
	});
}

/**
 * Builds the `tenantMembersRemove` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.tenantMembersRemove, createTenantMembersRemoveAction(options));
 */
export function createTenantMembersRemoveAction(options: ManagementControllerOptions) {
	return createAction(routes.tenantMembersRemove, {
		middleware: mountedMiddleware(options, "write"),
		handler: async (ctx) => {
			let refused = requireScope(ctx.managementCaller, "members:write");
			if (refused) return refused;

			let membershipId = membershipIdParam(ctx);

			let existing = await findOwnMembership(ctx.db, ctx.managementCaller.tenantId, membershipId);
			if (!existing) return membershipNotFound();

			await Membership.delete(ctx.db, membershipId);

			return new Response(null, { status: 204 });
		},
	});
}
