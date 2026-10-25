/**
 * The RFC 7638 JWK thumbprint: a key's identifier derived from its public members, so a
 * signer and a verifier name the same key without agreeing on a `kid` first. Web Bot
 * Auth and DPoP both identify keys this way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";
import * as jose from "jose";

/**
 * The base64url SHA-256 thumbprint of a key (RFC 7638 §3, and RFC 8037 Appendix A.3 for
 * `OKP` keys). Only the members the key type requires are hashed, so a private JWK and its
 * public half share one thumbprint, and `kid`, `alg` or `use` never change it.
 *
 * @param jwk - A JWK of type `EC`, `RSA`, `OKP` or `oct`, public or private.
 * @returns The thumbprint, or a failure naming the missing or unsupported member.
 * @example await thumbprint({ kty: "OKP", crv: "Ed25519", x: "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo" })
 */
export async function thumbprint(jwk: jose.JWK): Promise<Result<string, Error>> {
	try {
		return success(await jose.calculateJwkThumbprint(jwk, "sha256"));
	} catch (error) {
		return failure(error instanceof Error ? error : new Error(String(error)));
	}
}
