/**
 * Route guard factory for the `/api/v1/*` surface. Reads `Authorization: Bearer
 * <key>`, hashes it with the same SHA-256 scheme `app/services/api-key.ts` generates
 * keys with, looks the hash up in `api_keys`, rejects missing/invalid/expired keys,
 * checks the scope the calling route requires, and exposes `ctx.apiKey`/`ctx.apiTeam`
 * for the handler. Every check runs per request, so a revoked or expired key
 * stops working on its very next use.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { currentLog } from "@sdxc/logger";

import type { ApiKeyScope, SelectApiKey, SelectTeam } from "~/database/schema";

import { hashApiKey } from "~/app/services/api-key";
import { apiChallenge } from "~/app/services/api-metadata";
import { apiProblems, problemInstance } from "~/app/services/api-problems";

declare module "remix/router" {
	interface RequestContext {
		apiKey: SelectApiKey;
		apiTeam: SelectTeam;
	}
}

const BEARER_PATTERN = /^Bearer\s+(.+)$/i;

/**
 * The `401` for a request without a usable key. RFC 9110 requires its `WWW-Authenticate`,
 * which points at the API's metadata; a presented key that failed adds `invalid_token`.
 *
 * @param origin - The origin the request reached.
 * @param presented - Whether the request carried a key at all.
 */
function unauthorized(origin: string, presented: boolean): Response {
	return apiProblems.unauthorized(
		{ detail: "Invalid or missing API key", instance: problemInstance() },
		{
			headers: {
				"WWW-Authenticate": apiChallenge(origin, presented ? { error: "invalid_token" } : {}),
			},
		},
	);
}

/**
 * Requires a valid `Authorization: Bearer <key>` header carrying `scope`.
 *
 * @param scope The scope the calling route requires.
 * @returns Middleware responding 401 for a missing/invalid/expired key, 403 for a
 * valid key missing `scope` (both with a Bearer challenge), otherwise forwarding to the handler with
 * `ctx.apiKey`/`ctx.apiTeam` set.
 * @example
 * router.map(routes.api.v1.monitors.index, {
 * 	middleware: [requireApiKey("monitors:read")],
 * 	handler: monitorsIndex,
 * });
 */
export default function requireApiKey(scope: ApiKeyScope): Middleware {
	return async (ctx, next) => {
		let header = ctx.request.headers.get("Authorization");
		let match = header ? BEARER_PATTERN.exec(header) : null;
		let key = match?.[1] ?? null;
		if (!key) return unauthorized(ctx.url.origin, false);

		let keyHash = await hashApiKey(key);
		let apiKey = await ctx.models.apiKeys.findBy({ key_hash: keyHash });
		if (!apiKey) return unauthorized(ctx.url.origin, true);

		if (apiKey.expires_at !== null && apiKey.expires_at < Date.now()) {
			return unauthorized(ctx.url.origin, true);
		}

		let team = await ctx.models.teams.findByIdOrSlug(apiKey.team_id);
		if (!team) return unauthorized(ctx.url.origin, true);

		await ctx.models.apiKeys.markUsed(apiKey.id);

		if (!apiKey.scopes.includes(scope)) {
			return apiProblems.forbidden(
				{ detail: `API key does not have ${scope} scope`, instance: problemInstance() },
				{
					headers: {
						"WWW-Authenticate": apiChallenge(ctx.url.origin, {
							error: "insufficient_scope",
							scope: [scope],
						}),
					},
				},
			);
		}

		ctx.apiKey = apiKey;
		ctx.apiTeam = team;

		/**
		 * Attributes the invocation to the team whose key paid for it, so a machine
		 * request is queryable by team exactly like a browser one, and the endpoints
		 * under this guard record only what they alone know.
		 */
		currentLog()?.set({ team: { id: team.id } });

		return next();
	};
}
