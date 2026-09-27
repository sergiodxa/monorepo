/**
 * `/scim/v2/Users` and `/scim/v2/Users/{id}`: create, read, replace, patch,
 * delete and list, each resolving its own bearer token against a connection
 * inside the tenant object and translating between the wire shape and
 * `scim.ts`'s own RPC input and output.
 *
 * `createScimUsersController` builds all six actions against one `RateLimit`
 * binding rather than each action reaching `cloudflare:workers` for it
 * itself, so a test can hand in a fake limiter the same way
 * `rate-limit.test.ts` already does for `checkRateLimit`. A `DELETE` and a
 * pure `active: false` `PATCH` are admitted whatever this tenant's billing
 * state, so those two actions gate on the token and the write budget only,
 * enforcing the entitlement themselves, conditionally, once their own
 * handler has seen what the request actually asks for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Patch } from "@sdxc/scim/patch";

import { isFailure } from "@sdxc/result";
import {
	errorResponse,
	listResponse,
	parseListQuery,
	parseUser,
	readBody,
	ScimError,
	scimResponse,
} from "@sdxc/scim";
import { parsePatch } from "@sdxc/scim/patch";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { SCIM_FEATURE, scimGate } from "~/app/http/middleware/scim-gate";
import { scimFailure, userToScim } from "~/app/http/scim/response";
import {
	SCIM_MAX_PAGE_SIZE,
	SCIM_USER_DEFINITIONS,
	SCIM_USER_EXTENSIONS,
} from "~/database/scim-resources";
import routes from "~/routes/tenant";

/** Parses and requires the `:id` path param every single-resource user route matches. */
function userId(ctx: { params: Record<string, string | undefined> }): string {
	return s.parse(s.object({ id: s.string() }), ctx.params).id;
}

/** Whether a PATCH value sets `active` to false, reading Entra ID's `"False"` string too. */
function isFalse(value: unknown): boolean {
	return value === false || (typeof value === "string" && value.toLowerCase() === "false");
}

/**
 * Whether every operation only sets `active` to false — through `path: "active"`, or a
 * path-less value holding `active` alone, as Okta sends it. Such a PATCH is the
 * deactivation providers send in place of `DELETE`.
 */
function isPureDeactivation(operations: Patch.Operation[]): boolean {
	return (
		operations.length > 0 &&
		operations.every((operation) => {
			if (operation.op === "remove") return false;
			if (operation.path === null) {
				let value = operation.value as Record<string, unknown>;
				let keys = Object.keys(value);
				return (
					keys.length === 1 &&
					keys[0]?.toLowerCase() === "active" &&
					isFalse(Object.values(value)[0])
				);
			}
			let { attribute, filter, subAttribute } = operation.path;
			return (
				attribute.attribute.toLowerCase() === "active" &&
				attribute.subAttribute === null &&
				filter === null &&
				subAttribute === null &&
				isFalse(operation.value)
			);
		})
	);
}

/**
 * Builds the six `/scim/v2/Users*` actions, gated on the given `RateLimit`
 * binding.
 *
 * @param limiter - The write budget this connection's resource routes share.
 * @returns The six actions, ready for `router.map`.
 */
export function createScimUsersController(limiter: RateLimit) {
	let gate = scimGate(limiter);
	let lifecycleGate = scimGate(limiter, { requireEntitlement: false });

	return {
		/**
		 * Creates or adopts a user. A folded address matching a subject this
		 * connection has not yet linked adopts it rather than minting a second
		 * one, and either way answers `201` with the representation.
		 */
		create: createAction(routes.scimUsersCreate, {
			middleware: [gate],
			handler: async (ctx) => {
				let body = await readBody(ctx.request);
				if (isFailure(body)) return errorResponse(body.error);
				let user = parseUser(body.data, { extensions: SCIM_USER_EXTENSIONS });
				if (isFailure(user)) return errorResponse(user.error);

				let result = await ctx.tenantStub.scimProvisionUser({
					token: ctx.scimToken,
					resource: user.data,
				});
				if (!result.ok) return scimFailure(result);

				return scimResponse(userToScim(result.representation, ctx.url), { status: 201 });
			},
		}),

		/** A page of this connection's users, filtered and paged per its own query. */
		list: createAction(routes.scimUsersList, {
			middleware: [gate],
			handler: async (ctx) => {
				let query = parseListQuery(ctx.url, {
					maxCount: SCIM_MAX_PAGE_SIZE,
					attributes: SCIM_USER_DEFINITIONS,
				});
				if (isFailure(query)) return errorResponse(query.error);

				let result = await ctx.tenantStub.scimReadUserPage({
					token: ctx.scimToken,
					query: query.data,
				});
				if (!result.ok) return scimFailure(result);

				return listResponse({ ...result, resources: result.representations }, (representation) =>
					userToScim(representation, ctx.url),
				);
			},
		}),

		/** Reads one user this connection provisioned. */
		read: createAction(routes.scimUsersRead, {
			middleware: [gate],
			handler: async (ctx) => {
				let id = userId(ctx);
				let result = await ctx.tenantStub.scimReadUser({ token: ctx.scimToken, id });
				if (!result.ok) return scimFailure(result);

				return scimResponse(userToScim(result.representation, ctx.url));
			},
		}),

		/**
		 * Replaces a user's mapped attributes wholesale. `If-Match` and
		 * `meta.version` are ignored — `etag.supported` is `false`, since
		 * requests to one tenant are already serialized by the object.
		 */
		replace: createAction(routes.scimUsersReplace, {
			middleware: [gate],
			handler: async (ctx) => {
				let id = userId(ctx);
				let body = await readBody(ctx.request);
				if (isFailure(body)) return errorResponse(body.error);
				let user = parseUser(body.data, { extensions: SCIM_USER_EXTENSIONS });
				if (isFailure(user)) return errorResponse(user.error);

				let result = await ctx.tenantStub.scimReplaceUser({
					token: ctx.scimToken,
					id,
					resource: user.data,
				});
				if (!result.ok) return scimFailure(result);

				return scimResponse(userToScim(result.representation, ctx.url));
			},
		}),

		/**
		 * Applies a PATCH to the user's current representation. A patch whose
		 * every operation sets `active` to `false` — the deactivation most
		 * providers send in place of `DELETE` — is admitted whatever this
		 * tenant's billing state; anything that also touches another attribute
		 * still needs the entitlement, since it is provisioning as much as a
		 * create or a replace.
		 */
		patch: createAction(routes.scimUsersPatch, {
			middleware: [lifecycleGate],
			handler: async (ctx) => {
				let id = userId(ctx);
				let body = await readBody(ctx.request);
				if (isFailure(body)) return errorResponse(body.error);
				let operations = parsePatch(body.data);
				if (isFailure(operations)) return errorResponse(operations.error);

				if (!isPureDeactivation(operations.data)) {
					let { entitled } = await ctx.tenantStub.hasEntitlement({ feature: SCIM_FEATURE });
					if (!entitled) {
						return errorResponse(
							new ScimError(403, "SCIM provisioning is not entitled for this tenant."),
						);
					}
				}

				let result = await ctx.tenantStub.scimPatchUser({
					token: ctx.scimToken,
					id,
					operations: operations.data,
				});
				if (!result.ok) return scimFailure(result);

				return scimResponse(userToScim(result.representation, ctx.url));
			},
		}),

		/**
		 * Deletes a user per the connection's own policy. Admitted whatever this
		 * tenant's billing state — this handler never asks `hasEntitlement`,
		 * because a lapsed invoice is a poor reason to leave an ex-employee's
		 * account open.
		 */
		delete: createAction(routes.scimUsersDelete, {
			middleware: [lifecycleGate],
			handler: async (ctx) => {
				let id = userId(ctx);
				let result = await ctx.tenantStub.scimDeleteUser({ token: ctx.scimToken, id });
				if (!result.ok) return scimFailure(result);

				return new Response(null, { status: 204 });
			},
		}),
	};
}
