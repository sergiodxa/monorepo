/**
 * The checks registration and authentication share.
 *
 * Both ceremonies prove the same three things before anything specific to
 * either one runs — the browser signed this challenge, on an origin this
 * relying party owns, for this relying party id — so they are decided once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Bytes } from "@sdxc/crypto";
import type { Result } from "@sdxc/result";

import { Base64Url, sha256, timingSafeEqual } from "@sdxc/crypto";
import { failure, isFailure, success } from "@sdxc/result";

import type { PasskeyError } from "../errors.js";
import type { AuthenticatorData } from "../lib/authenticator-data.js";

import {
	ChallengeMismatchError,
	CrossOriginError,
	MalformedResponseError,
	OriginMismatchError,
	RelyingPartyMismatchError,
	UserPresenceError,
	UserVerificationError,
} from "../errors.js";
import { parse as parseAuthenticatorData } from "../lib/authenticator-data.js";
import { parse as parseClientData } from "../lib/client-data.js";

/** What a ceremony's response has to agree with to be accepted. */
export interface Expectations {
	/** `webauthn.create` or `webauthn.get`, whichever ceremony this is. */
	type: string;
	/** Challenge issued for this ceremony, base64url. */
	challenge: string;
	/** Origins whose pages may run a ceremony for this relying party. */
	origins: string[];
	/** Relying party id the credential must be bound to. */
	rpId: string;
	/** Whether the authenticator has to report user verification. */
	requireUserVerification: boolean;
	/** Whether a ceremony run inside a cross-origin frame is accepted. */
	allowCrossOrigin: boolean;
	/** COSE algorithms the relying party offered, which a credential must use one of. */
	algorithms: number[];
}

/**
 * Decodes a base64url field of a ceremony response.
 *
 * @param value Field value as the browser serialized it.
 * @param field Field name the error names, which is a constant, never input.
 * @returns The bytes, or `MalformedResponseError`.
 */
export function decodeField(value: string, field: string): Result<Bytes, MalformedResponseError> {
	let bytes = Base64Url.decode(value);
	if (isFailure(bytes)) return failure(new MalformedResponseError(`${field} is not base64url`));
	return success(bytes.data);
}

/**
 * Runs every check the two ceremonies have in common.
 *
 * @param clientDataJSON Client data bytes the browser signed.
 * @param authenticatorData Authenticator data bytes for the ceremony.
 * @param expected What the response has to agree with.
 * @returns The parsed authenticator data, or the first check that failed.
 */
export async function check(
	clientDataJSON: Bytes,
	authenticatorData: Bytes,
	expected: Expectations,
): Promise<Result<AuthenticatorData, PasskeyError>> {
	let clientData = parseClientData(clientDataJSON);
	if (isFailure(clientData)) return clientData;

	if (clientData.data.type !== expected.type) {
		return failure(new MalformedResponseError("client data is for another ceremony"));
	}

	if (!timingSafeEqual(clientData.data.challenge, expected.challenge)) {
		return failure(new ChallengeMismatchError());
	}

	if (!expected.origins.includes(clientData.data.origin)) {
		return failure(new OriginMismatchError(clientData.data.origin));
	}

	if (clientData.data.crossOrigin && !expected.allowCrossOrigin) {
		return failure(new CrossOriginError());
	}

	let parsed = parseAuthenticatorData(authenticatorData);
	if (isFailure(parsed)) return parsed;

	let rpIdHash = await sha256(expected.rpId);
	if (isFailure(rpIdHash))
		return failure(new MalformedResponseError("relying party id is unhashable"));
	if (!timingSafeEqual(parsed.data.rpIdHash, rpIdHash.data)) {
		return failure(new RelyingPartyMismatchError());
	}

	if (!parsed.data.userPresent) return failure(new UserPresenceError());
	if (expected.requireUserVerification && !parsed.data.userVerified) {
		return failure(new UserVerificationError());
	}

	return success(parsed.data);
}
