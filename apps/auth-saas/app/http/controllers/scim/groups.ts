/**
 * `/scim/v2/Groups` and `/scim/v2/Groups/{id}`: create, read, replace, patch,
 * delete and list, each resolving its own bearer token against a connection
 * inside the tenant object and translating between the wire shape and
 * `scim.ts`'s own RPC input and output.
 *
 * `createScimGroupsController` builds all six actions against one
 * `RateLimit` binding, the same shape `createScimUsersController` takes, so
 * a test can hand in a fake limiter. Every action here is gated on the full
 * entitlement check — a group carries no `active` state, so the
 * billing-state carve-out a user's deactivation and deletion get has no
 * group-side counterpart.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { scimGate } from "~/app/http/middleware/scim-gate";
import {
	parseGroupPatchOperations,
	parseScimGroupResource,
	parseScimListQuery,
} from "~/app/http/scim/request";
import {
	groupToScim,
	scimError,
	scimFailure,
	scimJson,
	scimListResponse,
} from "~/app/http/scim/response";
import routes from "~/routes/tenant";

/** Parses and requires the `:id` path param every single-resource group route matches. */
function groupId(ctx: { params: Record<string, string | undefined> }): string {
	return s.parse(s.object({ id: s.string() }), ctx.params).id;
}

/**
 * Builds the six `/scim/v2/Groups*` actions, gated on the given `RateLimit`
 * binding.
 *
 * @param limiter - The write budget this connection's resource routes share.
 * @returns The six actions, ready for `router.map`.
 */
export function createScimGroupsController(limiter: RateLimit) {
	let gate = scimGate(limiter);

	return {
		/** Creates a group and its starting membership in one call. */
		create: createAction(routes.scimGroupsCreate, {
			middleware: [gate],
			handler: async (ctx) => {
				let body = await ctx.request.json().catch(() => null);
				let parsed = parseScimGroupResource(body);
				if (!parsed.ok) {
					return scimError({
						status: 400,
						scimType: "invalidValue",
						detail: "The request body is not a valid SCIM Group resource.",
					});
				}

				let result = await ctx.tenantStub.scimProvisionGroup({
					token: ctx.scimToken,
					resource: parsed.resource,
				});
				if (!result.ok) return scimFailure(result);

				return scimJson(groupToScim(result.representation), 201);
			},
		}),

		/** A page of this connection's groups, filtered and paged per its own query. */
		list: createAction(routes.scimGroupsList, {
			middleware: [gate],
			handler: async (ctx) => {
				let query = parseScimListQuery(ctx.url);
				let result = await ctx.tenantStub.scimReadGroupPage({ token: ctx.scimToken, ...query });
				if (!result.ok) return scimFailure(result);

				return scimJson(scimListResponse(result, groupToScim), 200);
			},
		}),

		/** Reads one group this connection provisioned. */
		read: createAction(routes.scimGroupsRead, {
			middleware: [gate],
			handler: async (ctx) => {
				let id = groupId(ctx);
				let result = await ctx.tenantStub.scimReadGroup({ token: ctx.scimToken, id });
				if (!result.ok) return scimFailure(result);

				return scimJson(groupToScim(result.representation), 200);
			},
		}),

		/** Replaces a group's display name and whole membership set. */
		replace: createAction(routes.scimGroupsReplace, {
			middleware: [gate],
			handler: async (ctx) => {
				let id = groupId(ctx);
				let body = await ctx.request.json().catch(() => null);
				let parsed = parseScimGroupResource(body);
				if (!parsed.ok) {
					return scimError({
						status: 400,
						scimType: "invalidValue",
						detail: "The request body is not a valid SCIM Group resource.",
					});
				}

				let result = await ctx.tenantStub.scimReplaceGroup({
					token: ctx.scimToken,
					id,
					resource: parsed.resource,
				});
				if (!result.ok) return scimFailure(result);

				return scimJson(groupToScim(result.representation), 200);
			},
		}),

		/**
		 * Applies a group PATCH: a `displayName` change, a membership `add`
		 * with a value array, or a membership `remove` naming one subject.
		 */
		patch: createAction(routes.scimGroupsPatch, {
			middleware: [gate],
			handler: async (ctx) => {
				let id = groupId(ctx);
				let body = await ctx.request.json().catch(() => null);
				let translated = parseGroupPatchOperations(body);
				if (!translated.ok) {
					return scimError({
						status: 400,
						scimType: "invalidPath",
						detail:
							translated.index !== undefined
								? `Operation ${translated.index} is not one of the supported PATCH forms.`
								: "The request body is not a valid SCIM PATCH request.",
					});
				}

				let result = await ctx.tenantStub.scimPatchGroup({
					token: ctx.scimToken,
					id,
					operations: translated.operations,
				});
				if (!result.ok) return scimFailure(result);

				return scimJson(groupToScim(result.representation), 200);
			},
		}),

		/** Deletes a group, its membership and its mappings. */
		delete: createAction(routes.scimGroupsDelete, {
			middleware: [gate],
			handler: async (ctx) => {
				let id = groupId(ctx);
				let result = await ctx.tenantStub.scimDeleteGroup({ token: ctx.scimToken, id });
				if (!result.ok) return scimFailure(result);

				return new Response(null, { status: 204 });
			},
		}),
	};
}
