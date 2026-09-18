/**
 * Verifies an authentication ceremony against a stored credential.
 *
 * The signature covers the authenticator data followed by the hash of the
 * client data, which is what ties one assertion to one challenge, and the
 * signature counter is what catches a credential that has been cloned.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { concatBytes, sha256 } from "@sdxc/crypto";
import { failure, isFailure, success } from "@sdxc/result";

import type { PasskeyError } from "../errors.js";

import {
	CounterError,
	CredentialMismatchError,
	MalformedResponseError,
	SignatureError,
} from "../errors.js";
import { CredentialKey } from "../lib/cose.js";

import type { Expectations } from "./verify.js";

import { check, decodeField } from "./verify.js";

/** The credential fields an assertion is checked against. */
export interface StoredPasskey {
	/** Credential id, base64url, as registration returned it. */
	id: string;
	/** COSE public key, base64url, as registration returned it. */
	publicKey: string;
	/** Signature counter last recorded for this credential. */
	counter: number;
}

/** What an accepted assertion says about the credential that produced it. */
export interface AuthenticatedPasskey {
	/** Credential id that signed, base64url. */
	id: string;
	/** Counter to record, which the next assertion must exceed. */
	counter: number;
	/** User handle the authenticator carries, present for a discoverable credential. */
	userHandle: string | null;
	/** Whether the authenticator checked a biometric or PIN. */
	userVerified: boolean;
	/** Whether the credential is currently synced across the person's devices. */
	backedUp: boolean;
}

/** The fields of an authentication response verification reads. */
export interface AuthenticationResponse {
	id: string;
	response: {
		clientDataJSON: string;
		authenticatorData: string;
		signature: string;
		userHandle?: string;
	};
}

/**
 * Verifies an assertion and reports the counter to store.
 *
 * A counter of zero on both sides is the documented behavior of authenticators
 * that keep none, so only a counter that fails to advance past a non-zero
 * stored value is treated as a clone.
 *
 * @param response Parsed authentication response.
 * @param passkey Credential the assertion claims to come from.
 * @param expected What the response has to agree with.
 * @returns What to record about the assertion, or the first check that failed.
 */
export async function verifyAuthentication(
	response: AuthenticationResponse,
	passkey: StoredPasskey,
	expected: Expectations,
): Promise<Result<AuthenticatedPasskey, PasskeyError>> {
	if (response.id !== passkey.id) return failure(new CredentialMismatchError());

	let clientDataJSON = decodeField(response.response.clientDataJSON, "clientDataJSON");
	if (isFailure(clientDataJSON)) return clientDataJSON;

	let authenticatorData = decodeField(response.response.authenticatorData, "authenticatorData");
	if (isFailure(authenticatorData)) return authenticatorData;

	let signature = decodeField(response.response.signature, "signature");
	if (isFailure(signature)) return signature;

	let publicKey = decodeField(passkey.publicKey, "publicKey");
	if (isFailure(publicKey)) return publicKey;

	let checked = await check(clientDataJSON.data, authenticatorData.data, expected);
	if (isFailure(checked)) return checked;

	let key = await CredentialKey.import(publicKey.data);
	if (isFailure(key)) return key;

	let clientDataHash = await sha256(clientDataJSON.data);
	if (isFailure(clientDataHash)) {
		return failure(new MalformedResponseError("client data is unhashable"));
	}

	let signed = concatBytes(authenticatorData.data, clientDataHash.data);
	if (!(await key.data.verify(signature.data, signed))) return failure(new SignatureError());

	if (checked.data.counter > 0 || passkey.counter > 0) {
		if (checked.data.counter <= passkey.counter) {
			return failure(new CounterError(passkey.counter, checked.data.counter));
		}
	}

	return success({
		id: response.id,
		counter: checked.data.counter,
		userHandle: response.response.userHandle ?? null,
		userVerified: checked.data.userVerified,
		backedUp: checked.data.backedUp,
	});
}
