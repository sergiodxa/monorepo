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

import { Forbidden, Unauthorized } from "@pkg/http/status-code";
import { getServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";

import type { ApiKeyScope, SelectApiKey, SelectTeam } from "~/database/schema";

import ApiKey from "~/app/data/api-key";
import Team from "~/app/data/team";
import { hashApiKey } from "~/app/services/api-key";
import { apiError } from "~/app/services/api-response";

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
		if (!key) return apiError("UNAUTHORIZED", "Invalid or missing API key", Unauthorized);

		let db = getServiceContainer().get(Database);
		let keyHash = await hashApiKey(key);
		let apiKey = await ApiKey.findByHash(db, keyHash);
		if (!apiKey) return apiError("UNAUTHORIZED", "Invalid or missing API key", Unauthorized);

		if (apiKey.expires_at !== null && apiKey.expires_at < Date.now()) {
			return apiError("UNAUTHORIZED", "Invalid or missing API key", Unauthorized);
		}

		let team = await Team.findByIdOrSlug(db, apiKey.team_id);
		if (!team) return apiError("UNAUTHORIZED", "Invalid or missing API key", Unauthorized);

		await ApiKey.touchLastUsedAt(db, apiKey.id);

		if (!apiKey.scopes.includes(scope)) {
			return apiError("FORBIDDEN", `API key does not have ${scope} scope`, Forbidden);
		}

		ctx.apiKey = apiKey;
		ctx.apiTeam = team;

		return next();
	};
}
