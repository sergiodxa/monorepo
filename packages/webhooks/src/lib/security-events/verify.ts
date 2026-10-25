/**
 * Verification of a received Security Event Token against its issuer's keys, answering
 * the RFC 8935 error code a recipient reports for each way a SET can fail, so push and
 * poll recipients validate SETs by the same rules.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JWK } from "@sdxc/jwt";
import type { Result } from "@sdxc/result";

import { SecurityEventToken } from "@sdxc/jwt";
import { failure, success } from "@sdxc/result";

import type { SecurityEvents } from "../../security-events.js";

import { KeysUnavailableError, SecurityEventError } from "./errors.js";

/** The media type RFC 8417 §7.2 registers for a SET, and the body of an RFC 8935 push. */
export const SET_MEDIA_TYPE = "application/secevent+jwt";

/** jose error codes meaning the key or algorithm is unacceptable for this SET. */
const KEY_ERRORS = new Set([
	"ERR_JWKS_NO_MATCHING_KEY",
	"ERR_JWKS_MULTIPLE_MATCHING_KEYS",
	"ERR_JWS_SIGNATURE_VERIFICATION_FAILED",
	"ERR_JOSE_ALG_NOT_ALLOWED",
	"ERR_JOSE_NOT_SUPPORTED",
	"ERR_JWK_INVALID",
]);

/** jose error codes meaning the token itself is not a well-formed, acceptable SET. */
const REQUEST_ERRORS = new Set([
	"ERR_JWS_INVALID",
	"ERR_JWT_INVALID",
	"ERR_JWT_EXPIRED",
	"ERR_JWT_CLAIM_VALIDATION_FAILED",
]);

/**
 * Verifies a compact-serialized SET. The unverified `iss` picks the keys; an issuer the
 * options do not know fails with `invalid_issuer` before any signature work, a bad
 * signature or algorithm with `invalid_key`, and a missing audience with `invalid_audience`.
 *
 * @param token - The SET as received
 * @param options - Known issuers and their keys, the expected audience, the token class
 * @returns The verified SET, the RFC 8935 error to report, or `KeysUnavailableError`
 * @example let result = await verifySet(raw, { issuers: { [issuer]: jwks }, audience });
 */
export async function verifySet<T extends SecurityEventToken = SecurityEventToken>(
	token: string,
	options: SecurityEvents.VerifyOptions<T>,
): Promise<Result<T, SecurityEventError | KeysUnavailableError>> {
	let issuer = readIssuer(token);
	if (issuer === null) {
		return failure(new SecurityEventError("invalid_request", "The body is not a SET with an iss"));
	}

	let keys = await resolveKeys(options.issuers, issuer);
	if (keys instanceof KeysUnavailableError) return failure(keys);
	if (keys === null) {
		return failure(new SecurityEventError("invalid_issuer", `Not accepting SETs from ${issuer}`));
	}
	if (Array.isArray(keys) && keys.length === 0) {
		return failure(new SecurityEventError("invalid_key", `No keys are held for ${issuer}`));
	}

	let TokenClass = options.token ?? (SecurityEventToken as unknown as SecurityEvents.TokenClass<T>);

	try {
		let verified = await TokenClass.verify(token, keys, {
			issuer,
			audience: options.audience,
			...(options.algorithms === undefined ? {} : { algorithms: options.algorithms }),
		});
		return success(verified);
	} catch (error) {
		return failure(classify(error));
	}
}

/**
 * The SET's `iss`, read before verification only to choose the keys it is verified against.
 *
 * @param token - The SET as received
 * @returns The issuer, or `null` when the token cannot be decoded or names none
 */
function readIssuer(token: string): string | null {
	try {
		let iss = SecurityEventToken.decode(token).payload.iss;
		return typeof iss === "string" && iss !== "" ? iss : null;
	} catch {
		return null;
	}
}

/**
 * The keys of one issuer, from the map or the resolver.
 *
 * @param issuers - What the recipient was configured with
 * @param issuer - The SET's `iss`
 * @returns The keys, `null` for an unknown issuer, or the resolver's failure
 */
async function resolveKeys(
	issuers: SecurityEvents.VerifyOptions["issuers"],
	issuer: string,
): Promise<JWK.VerificationKeys | null | KeysUnavailableError> {
	if (typeof issuers !== "function")
		return Object.hasOwn(issuers, issuer) ? (issuers[issuer] ?? null) : null;
	try {
		return (await issuers(issuer)) ?? null;
	} catch (error) {
		return new KeysUnavailableError(error);
	}
}

/**
 * Maps what verification threw onto the RFC 8935 error a transmitter acts on. A failure
 * jose does not name, such as a remote key set that could not be fetched, says nothing
 * about the SET and becomes `KeysUnavailableError`.
 *
 * @param error - What `verify` threw
 */
function classify(error: unknown): SecurityEventError | KeysUnavailableError {
	let code = readMember(error, "code");
	let message = error instanceof Error ? error.message : "The SET could not be verified";

	if (code !== null && KEY_ERRORS.has(code)) return new SecurityEventError("invalid_key", message);
	if (code === null || !REQUEST_ERRORS.has(code)) return new KeysUnavailableError(error);

	let claim = readMember(error, "claim");
	if (claim === "aud") return new SecurityEventError("invalid_audience", message);
	if (claim === "iss") return new SecurityEventError("invalid_issuer", message);
	return new SecurityEventError("invalid_request", message);
}

/**
 * A string member of a thrown value, where jose errors carry `code` and `claim`.
 *
 * @param error - The thrown value
 * @param name - The member
 */
function readMember(error: unknown, name: string): string | null {
	if (typeof error !== "object" || error === null) return null;
	let value = (error as Record<string, unknown>)[name];
	return typeof value === "string" ? value : null;
}
