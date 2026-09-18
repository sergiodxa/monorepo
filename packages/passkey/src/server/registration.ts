/**
 * Verifies a registration ceremony and produces the credential to store.
 *
 * The attestation object is read for the authenticator data it wraps and for
 * the public key inside it; the attestation statement itself is left alone,
 * because a passkey's trust comes from the account that enrolled it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Bytes } from "@sdxc/crypto";
import type { Result } from "@sdxc/result";

import { Base64Url, sha256 } from "@sdxc/crypto";
import { failure, isFailure, success } from "@sdxc/result";

import type { PasskeyError } from "../errors.js";

import { MalformedResponseError, UnsupportedAlgorithmError } from "../errors.js";
import { verifyAttestation } from "../lib/attestation.js";
import { decode } from "../lib/cbor.js";
import { CredentialKey } from "../lib/cose.js";

import type { Expectations } from "./verify.js";

import { check, decodeField } from "./verify.js";

/** Longest credential id the specification permits an authenticator to mint. */
const MAX_CREDENTIAL_ID_BYTES = 1023;

/** A credential a registration produced, in the form to persist. */
export interface RegisteredPasskey {
	/** Credential id, base64url; assertions arrive keyed by this. */
	id: string;
	/** COSE public key, base64url; hand it back to `verifyAuthentication`. */
	publicKey: string;
	/** COSE algorithm the credential signs with. */
	algorithm: number;
	/** Signature counter to start from. */
	counter: number;
	/** Transports the browser reported, which make the next prompt faster. */
	transports: string[];
	/** Model identifier of the authenticator, as a UUID. */
	aaguid: string;
	/** Attestation format that was verified, which is `none` for a passkey. */
	attestation: string;
	/** Whether the authenticator checked a biometric or PIN during enrollment. */
	userVerified: boolean;
	/** Whether the credential may be synced to the person's other devices. */
	syncable: boolean;
	/** Whether the credential is currently synced, so losing the device is survivable. */
	backedUp: boolean;
}

/** The fields of a registration response verification reads. */
export interface RegistrationResponse {
	id: string;
	response: { clientDataJSON: string; attestationObject: string; transports?: string[] };
}

/**
 * Verifies a registration response against the ceremony that issued it.
 *
 * @param response Parsed registration response.
 * @param expected What the response has to agree with.
 * @returns The credential to store, or the first check that failed.
 */
export async function verifyRegistration(
	response: RegistrationResponse,
	expected: Expectations,
): Promise<Result<RegisteredPasskey, PasskeyError>> {
	let clientDataJSON = decodeField(response.response.clientDataJSON, "clientDataJSON");
	if (isFailure(clientDataJSON)) return clientDataJSON;

	let attestationObject = decodeField(response.response.attestationObject, "attestationObject");
	if (isFailure(attestationObject)) return attestationObject;

	let attestation = decode(attestationObject.data);
	if (isFailure(attestation)) return attestation;
	if (!(attestation.data instanceof Map)) {
		return failure(new MalformedResponseError("attestation object is not a map"));
	}

	let authenticatorData = attestation.data.get("authData");
	if (!(authenticatorData instanceof Uint8Array)) {
		return failure(new MalformedResponseError("attestation object carries no authenticator data"));
	}

	let checked = await check(clientDataJSON.data, authenticatorData, expected);
	if (isFailure(checked)) return checked;

	let credential = checked.data.credential;
	if (!credential) {
		return failure(new MalformedResponseError("authenticator data carries no credential"));
	}

	if (credential.id.length > MAX_CREDENTIAL_ID_BYTES) {
		return failure(new MalformedResponseError("credential id is over the permitted length"));
	}

	let id = Base64Url.encode(credential.id);
	if (id !== response.id) {
		return failure(new MalformedResponseError("credential id disagrees with the signed one"));
	}

	let key = await CredentialKey.import(credential.publicKey);
	if (isFailure(key)) return key;

	if (!expected.algorithms.includes(key.data.algorithm)) {
		return failure(new UnsupportedAlgorithmError(key.data.algorithm));
	}

	let clientDataHash = await sha256(clientDataJSON.data);
	if (isFailure(clientDataHash)) {
		return failure(new MalformedResponseError("client data is unhashable"));
	}

	let format = await verifyAttestation(
		attestation.data.get("fmt"),
		attestation.data.get("attStmt"),
		authenticatorData as Bytes,
		clientDataHash.data,
		key.data,
	);
	if (isFailure(format)) return format;

	return success({
		id,
		publicKey: Base64Url.encode(credential.publicKey),
		algorithm: key.data.algorithm,
		counter: checked.data.counter,
		transports: response.response.transports ?? [],
		aaguid: credential.aaguid,
		attestation: format.data,
		userVerified: checked.data.userVerified,
		syncable: checked.data.backupEligible,
		backedUp: checked.data.backedUp,
	});
}
