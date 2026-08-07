/**
 * Access to the ES256 key pair every token this server issues is signed with. The
 * keys live in R2 rather than in code or in the database, because each key file is
 * the only copy behind the published JWKS: every worker issuing tokens for this
 * issuer must read the same file, or tokens stop verifying for relying parties.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JWT } from "@edgefirst-dev/jwt";

import { JWK } from "@edgefirst-dev/jwt";
import { R2FileStorage } from "@edgefirst-dev/r2-file-storage";
import { env } from "cloudflare:workers";

/**
 * Loads the signing key pairs from the R2 bucket, generating and storing them on the
 * very first call.
 *
 * Never call this against an empty bucket in production: a freshly generated key
 * would replace nothing but would sign tokens no relying party's cached JWKS can
 * verify.
 *
 * @returns Every key pair the JWKS publishes, newest usable key first.
 */
export async function getSigningKey(): Promise<JWK.KeyPair[]> {
	// The R2 storage adapter is typed against its own, older copy of the Workers
	// types, whose `R2Bucket.get` declares a narrower return than the one this worker
	// is generated with. The binding is the same object at runtime.
	// @ts-expect-error
	return await JWK.signingKeys(new R2FileStorage(env.R2));
}

/**
 * Signs a JWT with the current ES256 key, which is the only algorithm this server
 * advertises and the only one relying parties are configured to accept.
 *
 * @param jwt - The token to sign.
 * @returns The compact-serialized, signed token.
 */
export async function sign(jwt: JWT): Promise<string> {
	return await jwt.sign(JWK.Algoritm.ES256, await getSigningKey());
}
