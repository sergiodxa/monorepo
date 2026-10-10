/**
 * The member sub-resource under a tenant: `GET .../members` lists them, `POST
 * .../members` grants a subject access at a role — a direct grant rather than
 * an email invitation, since no separate invitation mechanism exists in this
 * codebase today — `PUT .../members/:membershipId` changes a membership's
 * role, and `DELETE .../members/:membershipId` revokes one, each refusing to
 * leave the tenant without an owner.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { NotFound } from "@sdxc/data-model";
import { json } from "@sdxc/http/response";
import { isFailure, unwrap } from "@sdxc/result";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";
import type { Models } from "~/app/models";
import type { MembershipRow } from "~/app/models/memberships";

import {
	membershipIdParam,
	membershipNotFound,
	mountedMiddleware,
	serializeMembership,
} from "~/app/http/controllers/management/tenants/shared";
import { operationInputProblem } from "~/app/http/lib/parse-body";
import { managementProblem } from "~/app/http/lib/problem";
import { requireScope } from "~/app/http/lib/require-scope";
import { TENANT_MEMBERS_CREATE, TENANT_MEMBERS_UPDATE_ROLE } from "~/app/http/openapi/tenants";
import routes from "~/routes/management";

/**
 * Finds a membership by id, scoped to the caller's own tenant — a membership
 * id alone names no tenant of its own, so every read and write here checks
 * this rather than trusting the path segment.
 */
async function findOwnMembership(
	models: Models,
	tenantId: string,
	membershipId: string,
): Promise<MembershipRow | null> {
	return models.memberships.ofTenant(tenantId).find(membershipId);
}

/** The refusal for a write that would leave the tenant without an owner. */
function lastOwner(): Response {
	return managementProblem("lastOwner", {
		detail: "A tenant keeps at least one owner; appoint another owner first.",
	});
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
			let refused = requireScope(ctx, "members:write");
			if (refused) return refused;

			let memberships = await ctx.models.memberships.ofTenant(ctx.managementCaller.tenantId).all();

			return json(memberships.map(serializeMembership), { status: 200 });
		},
	});
}

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
			let refused = requireScope(ctx, "members:write");
			if (refused) return refused;

			let input = await TENANT_MEMBERS_CREATE.parse(ctx.request, ctx.params);
			if (isFailure(input)) return operationInputProblem(input.error);
			let body = input.data.body;

			let membership = unwrap(
				await ctx.models.memberships.create({
					tenant_id: ctx.managementCaller.tenantId,
					subject_id: body.subjectId,
					role: body.role,
				}),
			);

			return json(serializeMembership(membership), { status: 201 });
		},
	});
}

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
			let refused = requireScope(ctx, "members:write");
			if (refused) return refused;

			let membershipId = membershipIdParam(ctx);

			let input = await TENANT_MEMBERS_UPDATE_ROLE.parse(ctx.request, ctx.params);
			if (isFailure(input)) return operationInputProblem(input.error);

			let existing = await findOwnMembership(
				ctx.models,
				ctx.managementCaller.tenantId,
				membershipId,
			);
			if (!existing) return membershipNotFound();

			let updated = await ctx.models.memberships.changeRole(membershipId, input.data.body.role);
			if (isFailure(updated)) {
				if (updated.error instanceof NotFound) return membershipNotFound();
				return lastOwner();
			}

			return json(serializeMembership(updated.data), { status: 200 });
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
			let refused = requireScope(ctx, "members:write");
			if (refused) return refused;

			let membershipId = membershipIdParam(ctx);

			let existing = await findOwnMembership(
				ctx.models,
				ctx.managementCaller.tenantId,
				membershipId,
			);
			if (!existing) return membershipNotFound();

			let deleted = await ctx.models.memberships.revoke(membershipId);
			if (isFailure(deleted)) return lastOwner();

			return new Response(null, { status: 204 });
		},
	});
}
