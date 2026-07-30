/**
 * Signing secret handling: the `whsec_` convention stripped, the base64 body
 * decoded, and the receiver's rotation list resolved into key material.
 *
 * Senders hand out secrets with and without the prefix, and a secret used as raw
 * text instead of decoded bytes produces signatures nobody else can verify, so
 * both normalizations happen here once, before any key is imported.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Bytes } from "@pkg/crypto";
import type { Result } from "@pkg/result";

import { failure, isFailure, success } from "@pkg/result";

import { InvalidSecretError } from "./errors";
import { decodeBase64 } from "./lib/base64";

/** Prefix senders put on a symmetric signing secret, per the specification. */
const SECRET_PREFIX = "whsec_";

/**
 * How a caller supplies signing secrets to `verify()`.
 *
 * Both fields are optional in the type and at least one must resolve to a usable
 * secret at runtime: an endpoint whose secret is unset fails closed instead of
 * accepting whatever arrives.
 */
export interface SecretOptions {
	/**
	 * Signing secret shared with the sender, base64, with or without the `whsec_`
	 * prefix.
	 */
	secret?: string;

	/**
	 * Signing secrets to try, for the receiver's own rotation: a delivery verifies
	 * when any one of them matches, so a new secret can be introduced before the
	 * old one is retired. Combined with `secret` when both are given.
	 */
	secrets?: readonly string[];
}

/**
 * Decodes one secret into the key bytes the HMAC is computed with.
 *
 * The `whsec_` prefix is stripped when present, then the remainder is base64
 * decoded, which is what every specification implementation keys with. A secret
 * that is not base64 is a configuration error rather than a second key format,
 * because guessing between the two would make signatures unverifiable elsewhere.
 *
 * @param secret Secret as the sender issued it.
 * @returns Key bytes, or `InvalidSecretError` for a missing, empty, or non-base64 secret.
 * @example
 * decodeSecret("whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw"); // success(24 bytes)
 */
export function decodeSecret(secret: string): Result<Bytes, InvalidSecretError> {
	// The type says `string`, but secrets come from environment bindings that are
	// routinely typed optimistically, so an unset one is handled rather than thrown.
	if (typeof secret !== "string" || secret.length === 0) {
		return failure(new InvalidSecretError("no secret was provided"));
	}

	let encoded = secret.startsWith(SECRET_PREFIX) ? secret.slice(SECRET_PREFIX.length) : secret;
	if (encoded.length === 0) return failure(new InvalidSecretError("the secret is empty"));

	let decoded = decodeBase64(encoded);
	if (isFailure(decoded)) return failure(new InvalidSecretError("the secret is not base64"));
	if (decoded.data.length === 0) return failure(new InvalidSecretError("the secret is empty"));

	return success(decoded.data);
}

/**
 * Resolves the configured secrets into the key material to try, in order.
 *
 * `secret` is tried before `secrets` so the primary secret decides the common
 * case. Every configured secret must decode: one unusable entry fails the whole
 * call, because a silently skipped secret is how a rotation stops working without
 * anyone noticing.
 *
 * @param options Secret configuration as passed to `verify()`.
 * @returns Key material for each configured secret, or `InvalidSecretError` when none is usable.
 * @example
 * resolveSecrets({ secrets: [current, previous] }); // success([bytes, bytes])
 */
export function resolveSecrets(options: SecretOptions): Result<Bytes[], InvalidSecretError> {
	let configured = [
		...(options.secret === undefined ? [] : [options.secret]),
		...(options.secrets ?? []),
	];

	if (configured.length === 0) {
		return failure(new InvalidSecretError("no secret was provided"));
	}

	let keys: Bytes[] = [];
	for (let secret of configured) {
		let decoded = decodeSecret(secret);
		if (isFailure(decoded)) return decoded;
		keys.push(decoded.data);
	}

	return success(keys);
}
