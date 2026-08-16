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

import { unauthorized } from "@pkg/http/response/json";
import { JWK } from "@pkg/jwt";
import { TimingCollector } from "@pkg/server-timing";
import { getServiceContainer } from "@pkg/service-container";
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
 * Shape a cached client entry must have to be used.
 *
 * Only `id` is required and unknown keys are stripped, because this cache is shared with
 * another worker serving the same API: an entry written there carries that worker's whole
 * client row, one written here carries nothing else, and the id is all either side reads.
 */
const CachedClientSchema = s.object({ id: s.string() });

/** KV key a resolved client is cached under. Shared at runtime; do not reshape it. */
function clientCacheKey(clientId: string): string {
	return `clients:${clientId}`;
}

/**
 * Verifies a request's bearer token and resolves the client it was issued to.
 *
 * The token must verify against this server's own keys **and** name this server as its
 * audience, which is true only of a `client_credentials` token: a person's access token
 * is issued for the relying party's client id, so an end-user token can never read the
 * machine API. The resolved client is cached in KV for a week, which is what keeps a hot
 * API path off the database — and is also how long a deleted client keeps working, the
 * behavior this cache has always had.
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
 * Requires a valid client-credentials bearer token, publishing `ctx.apiClient` and
 * `ctx.timing` for the endpoint behind it.
 *
 * A refusal is a bare `401 {"error":"Unauthorized"}` with no detail about which check
 * failed: every legitimate caller is a machine holding a working credential, so a more
 * specific message would only ever be read by someone probing.
 */
export function requireApiClient(): Middleware {
	return async (ctx, next) => {
		let collector = new TimingCollector();
		ctx.timing = collector;

		let client = await collector.measure("auth", "authorize", async () => {
			return await resolveClient(collector, ctx.request);
		});

		if (!client) {
			ctx.logger.info("api_unauthorized");
			let headers = new Headers();
			collector.toHeaders(headers);
			return unauthorized({ error: "Unauthorized" }, { headers });
		}

		ctx.apiClient = client;

		// Written after the endpoint has answered, so its own measurements are included.
		// Every response under `/api` is constructed by this app, so its headers are
		// mutable.
		let response = await next();
		collector.toHeaders(response.headers);
		return response;
	};
}

export default requireApiClient;
