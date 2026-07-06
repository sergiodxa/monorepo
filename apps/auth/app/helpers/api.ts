/**
 * API authorization helper for the auth app. Verifies a Bearer access token
 * against the server's JWKS and resolves the calling OAuth client, using a
 * week-long KV cache (populated in the background) to avoid repeated database
 * lookups, so API routes can authenticate machine-to-machine requests.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TimingCollector } from "@edgefirst-dev/server-timing";

import { env, waitUntil } from "cloudflare:workers";

import type { Database } from "~/db/index";
import type { SelectClient } from "~/db/schema";

import Client from "~/models/client";
import { getSigningKey } from "~/modules/jwks";
import { OIDCProvider } from "~/modules/oauth2";

export async function authorize(db: Database, collector: TimingCollector, request: Request) {
	let authorization = request.headers.get("Authorization");
	if (!authorization) return null;

	let [type, token] = authorization.split(" ");
	if (type !== "Bearer" || !token) return null;

	let jwks = await collector.measure("JWT", "getSigningKey", async () => {
		return await getSigningKey();
	});

	let jwt = await OIDCProvider.AccessToken.verify(token, jwks, {
		issuer: "auth.sergiodxa.com",
		audience: "auth.sergiodxa.com",
	});

	let cacheKey = `clients:${jwt.subject}`;

	let cached = await collector.measure("cache", "authorize.cacheLookup", () => {
		return env.KV.get<SelectClient>(cacheKey, "json");
	});

	if (cached) return cached;

	let client = await collector.measure("db", "authorize.findClientById", async () =>
		Client.findById(db, jwt.subject),
	);

	if (client) {
		waitUntil(
			env.KV.put(
				cacheKey,
				JSON.stringify(client),
				{ expirationTtl: 60 * 60 * 24 * 7 }, // Cache for 7 days
			),
		);
	}

	return client ?? null;
}
