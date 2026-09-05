/**
 * Guard for the machine-to-machine API. Verifies the bearer token against this server's
 * own JWKS, confirms it names a registered client, and publishes that client plus a
 * timing collector on the request context. Every response it wraps carries
 * `Server-Timing`, so a slow API call can be attributed without instrumenting each
 * endpoint.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { unauthorized } from "@sdxc/http/response/json";
import { JWK } from "@sdxc/jwt";
import { TimingCollector } from "@sdxc/server-timing";
import { getServiceContainer } from "@sdxc/service-container";
import { env, waitUntil } from "cloudflare:workers";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";

import AccessToken from "~/app/auth/values/access-token";
import { ISSUER } from "~/app/config";
import Client from "~/app/data/client";
import { getSigningKey } from "~/app/services/signing-keys";

declare module "remix/router" {
	interface RequestContext {
		/** The client whose credentials the request presented, published by `requireApiClient`. */
		apiClient: ApiClient;
		/** Measurements taken while answering this request, reported as `Server-Timing`. */
		timing: TimingCollector;
	}
}

/**
 * The calling client, as far as the API needs to know it.
 *
 * Only the id: it is what scopes the per-client caches, and it is the one thing about a
 * client that an endpoint answering for it acts on.
 */
export interface ApiClient {
	id: string;
}

/** How long a resolved client stays cached, matching the subject cache's window. */
const CLIENT_CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;

/**
 * Only `id` is required and unknown keys are stripped, since this cache entry is shared
 * with another worker whose record carries its own whole client row — the id is the
 * only field either side reads.
 */
const CachedClientSchema = s.object({ id: s.string() });

/** KV key a resolved client is cached under, shared at runtime: its shape must stay exactly this. */
function clientCacheKey(clientId: string): string {
	return `clients:${clientId}`;
}

/**
 * The audience check accepts only a `client_credentials` token, since a person's access
 * token carries the relying party's client id as its audience. The resolved client stays
 * cached in KV for a week, so a deleted client keeps answering that long.
 *
 * @returns The calling client, or `null` for a missing, malformed or unverifiable token.
 */
async function resolveClient(
	collector: TimingCollector,
	request: Request,
): Promise<ApiClient | null> {
	let authorization = request.headers.get("Authorization");
	if (!authorization) return null;

	let [scheme, token] = authorization.split(" ");
	if (scheme !== "Bearer" || !token) return null;

	let jwks = await collector.measure("JWT", "getSigningKey", async () => {
		return await getSigningKey();
	});

	let clientId: string;

	try {
		let jwt = await AccessToken.verify(token, jwks, {
			issuer: ISSUER,
			audience: ISSUER,
			algorithms: [JWK.Algorithm.ES256],
		});
		clientId = jwt.subject;
	} catch {
		return null;
	}

	if (!clientId) return null;

	let cacheKey = clientCacheKey(clientId);

	let cached = await collector.measure("cache", "authorize.cacheLookup", async () => {
		return await env.KV.get(cacheKey, "json");
	});

	if (cached !== null && cached !== undefined) {
		let parsed = s.parseSafe(CachedClientSchema, cached);
		if (parsed.success) return { id: parsed.value.id };
	}

	let client = await collector.measure("db", "authorize.findClientById", async () => {
		return await Client.findById(getServiceContainer().get(Database), clientId);
	});

	if (!client) return null;

	waitUntil(
		env.KV.put(cacheKey, JSON.stringify({ id: client.id }), {
			expirationTtl: CLIENT_CACHE_TTL_SECONDS,
		}),
	);

	return { id: client.id };
}

/**
 * A bare `401 {"error":"Unauthorized"}` answers every failure path alike, staying
 * opaque to anyone probing which check tripped it. `Server-Timing` merges in after
 * `next()` resolves, capturing the endpoint's own work.
 */
export function requireApiClient(): Middleware {
	return async (ctx, next) => {
		let collector = new TimingCollector();
		ctx.timing = collector;

		let client = await collector.measure("auth", "authorize", async () => {
			return await resolveClient(collector, ctx.request);
		});

		if (!client) {
			ctx.log.note("api.unauthorized");
			let headers = new Headers();
			collector.toHeaders(headers);
			return unauthorized({ error: "Unauthorized" }, { headers });
		}

		ctx.apiClient = client;
		ctx.log.set({ client: { id: client.id } });

		let response = await next();
		collector.toHeaders(response.headers);
		return response;
	};
}

export default requireApiClient;
