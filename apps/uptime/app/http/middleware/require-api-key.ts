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

import ApiKey from "~/app/data/api-key";
import Team from "~/app/data/team";
import { hashApiKey } from "~/app/services/api-key";
import { apiProblems, problemInstance } from "~/app/services/api-problems";

declare module "remix/router" {
	interface RequestContext {
		apiKey: SelectApiKey;
		apiTeam: SelectTeam;
	}
}

const BEARER_PATTERN = /^Bearer\s+(.+)$/i;

/**
 * Requires a valid `Authorization: Bearer <key>` header carrying `scope`.
 *
 * @param scope The scope the calling route requires.
 * @returns Middleware responding 401 for a missing/invalid/expired key, 403 for a
 * valid key missing `scope`, otherwise forwarding to the handler with
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
		if (!key)
			return apiProblems.unauthorized({
				detail: "Invalid or missing API key",
				instance: problemInstance(),
			});

		let keyHash = await hashApiKey(key);
		let apiKey = await ApiKey.findByHash(ctx.db, keyHash);
		if (!apiKey)
			return apiProblems.unauthorized({
				detail: "Invalid or missing API key",
				instance: problemInstance(),
			});

		if (apiKey.expires_at !== null && apiKey.expires_at < Date.now()) {
			return apiProblems.unauthorized({
				detail: "Invalid or missing API key",
				instance: problemInstance(),
			});
		}

		let team = await Team.findByIdOrSlug(ctx.db, apiKey.team_id);
		if (!team)
			return apiProblems.unauthorized({
				detail: "Invalid or missing API key",
				instance: problemInstance(),
			});

		await ApiKey.touchLastUsedAt(ctx.db, apiKey.id);

		if (!apiKey.scopes.includes(scope)) {
			return apiProblems.forbidden({
				detail: `API key does not have ${scope} scope`,
				instance: problemInstance(),
			});
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
