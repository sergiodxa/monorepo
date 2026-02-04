import type { TimingCollector } from "@edgefirst-dev/server-timing";

import { env, waitUntil } from "cloudflare:workers";

import type { Database } from "~/db/index";
import type { SelectClient } from "~/db/schema";

import AccessToken from "~/entities/access-token";
import Client from "~/models/client";
import { getSigningKey } from "~/modules/jwks";

export async function authorize(db: Database, collector: TimingCollector, request: Request) {
	let authorization = request.headers.get("Authorization");
	if (!authorization) return null;

	let [type, token] = authorization.split(" ");
	if (type !== "Bearer" || !token) return null;

	let jwks = await collector.measure("JWT", "getSigningKey", async () => {
		return await getSigningKey();
	});

	let jwt = await AccessToken.verify(token, jwks, {
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
