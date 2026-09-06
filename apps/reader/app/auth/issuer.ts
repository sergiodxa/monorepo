/**
 * The identity provider every auth role in this app talks to: the browser sign-in and the
 * ID-token verification measure themselves against one issuer, whose discovery document
 * and key set are read through the KV cache so a cold isolate reuses another one's fetch.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Issuer } from "@sdxc/auth/issuer";
import { Cache } from "@sdxc/kv-cache";
import { env, waitUntil } from "cloudflare:workers";

/** Origin the provider serves its discovery document and every endpoint on. */
const AUTH_ORIGIN = "https://auth.sergiodxa.com";

/**
 * The `iss` the provider writes into every token it signs and publishes as its discovery
 * `issuer`. It is the bare host, and a verification compares it byte for byte, so it
 * stands apart from the origin the documents are served from.
 */
const AUTH_IDENTIFIER = "auth.sergiodxa.com";

/**
 * The shared issuer, backed by KV so the discovery document and key set survive an
 * isolate.
 *
 * @returns The issuer every relying party and verifier is built on.
 * @example let keys = await issuer().keys();
 */
export function issuer(): Issuer {
	return Issuer.for(AUTH_ORIGIN, {
		identifier: AUTH_IDENTIFIER,
		cache: new Cache.KVStore(env.KV, (promise) => waitUntil(promise)),
	});
}
