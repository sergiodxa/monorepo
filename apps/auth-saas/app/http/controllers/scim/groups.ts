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

import { isFailure } from "@sdxc/result";
import {
	errorResponse,
	listResponse,
	parseGroup,
	parseListQuery,
	readBody,
	scimResponse,
} from "@sdxc/scim";
import { parsePatch } from "@sdxc/scim/patch";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { scimGate } from "~/app/http/middleware/scim-gate";
import { groupToScim, scimFailure } from "~/app/http/scim/response";
import { SCIM_GROUP_DEFINITIONS, SCIM_MAX_PAGE_SIZE } from "~/database/scim-resources";
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
				let body = await readBody(ctx.request);
				if (isFailure(body)) return errorResponse(body.error);
				let group = parseGroup(body.data);
				if (isFailure(group)) return errorResponse(group.error);

				let result = await ctx.tenantStub.scimProvisionGroup({
					token: ctx.scimToken,
					resource: group.data,
				});
				if (!result.ok) return scimFailure(result);

				return scimResponse(groupToScim(result.representation, ctx.url), { status: 201 });
			},
		}),

		/** A page of this connection's groups, filtered and paged per its own query. */
		list: createAction(routes.scimGroupsList, {
			middleware: [gate],
			handler: async (ctx) => {
				let query = parseListQuery(ctx.url, {
					maxCount: SCIM_MAX_PAGE_SIZE,
					attributes: SCIM_GROUP_DEFINITIONS,
				});
				if (isFailure(query)) return errorResponse(query.error);

				let result = await ctx.tenantStub.scimReadGroupPage({
					token: ctx.scimToken,
					query: query.data,
				});
				if (!result.ok) return scimFailure(result);

				return listResponse({ ...result, resources: result.representations }, (representation) =>
					groupToScim(representation, ctx.url),
				);
			},
		}),

		/** Reads one group this connection provisioned. */
		read: createAction(routes.scimGroupsRead, {
			middleware: [gate],
			handler: async (ctx) => {
				let id = groupId(ctx);
				let result = await ctx.tenantStub.scimReadGroup({ token: ctx.scimToken, id });
				if (!result.ok) return scimFailure(result);

				return scimResponse(groupToScim(result.representation, ctx.url));
			},
		}),

		/** Replaces a group's display name and whole membership set. */
		replace: createAction(routes.scimGroupsReplace, {
			middleware: [gate],
			handler: async (ctx) => {
				let id = groupId(ctx);
				let body = await readBody(ctx.request);
				if (isFailure(body)) return errorResponse(body.error);
				let group = parseGroup(body.data);
				if (isFailure(group)) return errorResponse(group.error);

				let result = await ctx.tenantStub.scimReplaceGroup({
					token: ctx.scimToken,
					id,
					resource: group.data,
				});
				if (!result.ok) return scimFailure(result);

				return scimResponse(groupToScim(result.representation, ctx.url));
			},
		}),

		/**
		 * Applies a group PATCH operation by operation: a `displayName` change,
		 * or members added, replaced or removed, each touching only the rows it
		 * names.
		 */
		patch: createAction(routes.scimGroupsPatch, {
			middleware: [gate],
			handler: async (ctx) => {
				let id = groupId(ctx);
				let body = await readBody(ctx.request);
				if (isFailure(body)) return errorResponse(body.error);
				let operations = parsePatch(body.data);
				if (isFailure(operations)) return errorResponse(operations.error);

				let result = await ctx.tenantStub.scimPatchGroup({
					token: ctx.scimToken,
					id,
					operations: operations.data,
				});
				if (!result.ok) return scimFailure(result);

				return scimResponse(groupToScim(result.representation, ctx.url));
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
