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

import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { SCIM_FEATURE, scimGate } from "~/app/http/middleware/scim-gate";
import {
	parseScimListQuery,
	parseScimUserResource,
	parseUserPatchOperations,
} from "~/app/http/scim/request";
import {
	scimError,
	scimFailure,
	scimJson,
	scimListResponse,
	userToScim,
} from "~/app/http/scim/response";
import routes from "~/routes/tenant";

/** Parses and requires the `:id` path param every single-resource user route matches. */
function userId(ctx: { params: Record<string, string | undefined> }): string {
	return s.parse(s.object({ id: s.string() }), ctx.params).id;
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
				let body = await ctx.request.json().catch(() => null);
				let parsed = parseScimUserResource(body);
				if (!parsed.ok) {
					return scimError({
						status: 400,
						scimType: "invalidValue",
						detail: "The request body is not a valid SCIM User resource.",
					});
				}

				let result = await ctx.tenantStub.scimProvisionUser({
					token: ctx.scimToken,
					resource: parsed.resource,
				});
				if (!result.ok) return scimFailure(result);

				return scimJson(userToScim(result.representation), 201);
			},
		}),

		/** A page of this connection's users, filtered and paged per its own query. */
		list: createAction(routes.scimUsersList, {
			middleware: [gate],
			handler: async (ctx) => {
				let query = parseScimListQuery(ctx.url);
				let result = await ctx.tenantStub.scimReadUserPage({ token: ctx.scimToken, ...query });
				if (!result.ok) return scimFailure(result);

				return scimJson(scimListResponse(result, userToScim), 200);
			},
		}),

		/** Reads one user this connection provisioned. */
		read: createAction(routes.scimUsersRead, {
			middleware: [gate],
			handler: async (ctx) => {
				let id = userId(ctx);
				let result = await ctx.tenantStub.scimReadUser({ token: ctx.scimToken, id });
				if (!result.ok) return scimFailure(result);

				return scimJson(userToScim(result.representation), 200);
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
				let body = await ctx.request.json().catch(() => null);
				let parsed = parseScimUserResource(body);
				if (!parsed.ok) {
					return scimError({
						status: 400,
						scimType: "invalidValue",
						detail: "The request body is not a valid SCIM User resource.",
					});
				}

				let result = await ctx.tenantStub.scimReplaceUser({
					token: ctx.scimToken,
					id,
					resource: parsed.resource,
				});
				if (!result.ok) return scimFailure(result);

				return scimJson(userToScim(result.representation), 200);
			},
		}),

		/**
		 * Applies a PATCH's `replace`/`add` operations on named attributes. A
		 * patch whose every operation sets `active` to `false` — the
		 * deactivation most providers send in place of `DELETE` — is admitted
		 * whatever this tenant's billing state; anything that also touches
		 * another attribute still needs the entitlement, since it is
		 * provisioning as much as a create or a replace.
		 */
		patch: createAction(routes.scimUsersPatch, {
			middleware: [lifecycleGate],
			handler: async (ctx) => {
				let id = userId(ctx);
				let body = await ctx.request.json().catch(() => null);
				let translated = parseUserPatchOperations(body);
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

				let isPureDeactivation =
					translated.operations.length > 0 &&
					translated.operations.every(
						(operation) => operation.attribute === "active" && operation.value === false,
					);

				if (!isPureDeactivation) {
					let { entitled } = await ctx.tenantStub.hasEntitlement({ feature: SCIM_FEATURE });
					if (!entitled) {
						return scimError({
							status: 403,
							detail: "SCIM provisioning is not entitled for this tenant.",
						});
					}
				}

				let result = await ctx.tenantStub.scimPatchUser({
					token: ctx.scimToken,
					id,
					operations: translated.operations,
				});
				if (!result.ok) return scimFailure(result);

				return scimJson(userToScim(result.representation), 200);
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
