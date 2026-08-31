/**
 * The identity provider every auth role in this app talks to, held as one instance
 * so its discovery document and key set are fetched once per isolate and shared
 * through KV across them. Exists because the browser login, the service-to-service
 * reads, and the ID-token verification all measure themselves against one issuer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Issuer } from "@pkg/auth/issuer";
import { Cache } from "@pkg/kv-cache";
import { env, waitUntil } from "cloudflare:workers";

/** The provider this app's accounts live at, and the `iss` its tokens carry. */
export const AUTH_ISSUER = "https://auth.sergiodxa.com";

/** Reused for the life of the isolate, so a second read of the metadata is free. */
let instance: Issuer | null = null;

/**
 * The shared issuer, backed by the KV namespace so a cold isolate reads a document
 * another one already paid for rather than fetching discovery and the JWKS again.
 *
 * @returns The issuer every relying party, service client, and verifier is built on.
 * @example let keys = await issuer().keys();
 */
export function issuer(): Issuer {
	instance ??= new Issuer(AUTH_ISSUER, {
		cache: new Cache.KVStore(env.KV, (promise) => waitUntil(promise)),
	});

	return instance;
}
