/**
 * Access to the ES256 key pair every token this server issues is signed with. The
 * keys live in R2 rather than in code or in the database, because each key file is
 * the only copy behind the published JWKS: every worker issuing tokens for this
 * issuer must read the same file, or tokens stop verifying for relying parties.
 *
 * Reading them is a bucket listing, a read per key, and two key imports per key, so
 * a warm isolate holds onto the result and shares it across requests.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JWT } from "@pkg/jwt";

import { JWK } from "@pkg/jwt";
import { env } from "cloudflare:workers";

import { createR2KeyStorage } from "~/app/services/r2-key-storage";

/**
 * How long a warm isolate reuses the keys it has already read.
 *
 * A rotation adds a key, and this is how long an isolate can go on signing with the
 * previous one before it notices. That window is safe because signing and publishing
 * read through this same cache: an isolate that has not seen the new key is also
 * publishing the set it is signing against, so its tokens verify. The bound exists so
 * a rotation becomes live on its own, without waiting for isolates to recycle.
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** The in-flight or completed read a warm isolate is serving. */
interface CachedKeys {
	keys: Promise<JWK.KeyPair[]>;
	readAt: number;
}

let cached: CachedKeys | null = null;

/**
 * Loads the signing key pairs from the R2 bucket, generating and storing them on the
 * very first call.
 *
 * The promise is cached rather than its result, so requests arriving together share
 * one read instead of each starting their own — and, on an empty bucket, so they
 * share the one key that read mints instead of racing to mint several.
 *
 * Never call this against an empty bucket in production: a freshly generated key
 * would replace nothing but would sign tokens no relying party's cached JWKS can
 * verify.
 *
 * @returns Every key pair the JWKS publishes, newest usable key first.
 */
export async function getSigningKey(): Promise<JWK.KeyPair[]> {
	if (cached && Date.now() - cached.readAt < CACHE_TTL_MS) return await cached.keys;

	let entry: CachedKeys = {
		keys: JWK.signingKeys(createR2KeyStorage(env.R2)),
		readAt: Date.now(),
	};
	cached = entry;

	try {
		return await entry.keys;
	} catch (error) {
		// Dropped so the next request reads again, which is what keeps one unreachable
		// bucket from deciding the rest of the window. The identity check leaves a newer
		// entry alone, since a slow failure can outlive its own cache slot.
		if (cached === entry) cached = null;
		throw error;
	}
}

/**
 * Drops the held keys so the next call reads from the bucket.
 *
 * Makes a rotation live immediately, for when waiting out the reuse window is longer
 * than the operator wants to wait.
 */
export function invalidateSigningKeys(): void {
	cached = null;
}

/**
 * Signs a JWT with the current ES256 key, which is the only algorithm this server
 * advertises and the only one relying parties are configured to accept.
 *
 * @param jwt - The token to sign.
 * @returns The compact-serialized, signed token.
 */
export async function sign(jwt: JWT): Promise<string> {
	return await jwt.sign(JWK.Algorithm.ES256, await getSigningKey());
}
