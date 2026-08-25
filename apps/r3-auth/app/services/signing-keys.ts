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
 * How long a warm isolate reuses keys before rereading them.
 * Safe because signing and publishing share this cache: an isolate that has not
 * seen a new key is also still publishing the old set, so its tokens keep verifying.
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** The in-flight or completed read a warm isolate is serving. */
interface CachedKeys {
	keys: Promise<JWK.KeyPair[]>;
	readAt: number;
}

let cached: CachedKeys | null = null;

/**
 * Loads the signing key pairs from R2, caching the promise (not its result) so
 * concurrent requests share one read, or on an empty bucket share one minted key.
 * A failed read clears only that same entry, leaving a newer one to keep serving.
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
