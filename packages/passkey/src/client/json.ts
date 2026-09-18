/**
 * Translates between the JSON a server exchanges and the buffers the
 * credentials API insists on.
 *
 * Browsers have gained `parseCreationOptionsFromJSON` and `toJSON` for exactly
 * this, and they are used wherever present; the hand-written path keeps the
 * same two calls working on browsers that shipped WebAuthn before them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Bytes } from "@sdxc/crypto";

import { Base64Url } from "@sdxc/crypto";
import { isFailure } from "@sdxc/result";

/**
 * Decodes a base64url field of the options a server issued.
 *
 * @param value Field value.
 * @returns The bytes.
 * @throws {RangeError} If the value is not base64url.
 */
function bytes(value: string): Bytes {
	let decoded = Base64Url.decode(value);
	if (isFailure(decoded)) throw new RangeError("Options carry a value that is not base64url");
	return decoded.data;
}

/**
 * Rewrites credential descriptors with binary ids.
 *
 * @param descriptors Descriptors as the server wrote them.
 * @returns Descriptors the credentials API accepts.
 */
function descriptors(
	list: PublicKeyCredentialDescriptorJSON[] | undefined,
): PublicKeyCredentialDescriptor[] | undefined {
	return list?.map((descriptor) => ({
		id: bytes(descriptor.id),
		type: "public-key",
		transports: descriptor.transports as AuthenticatorTransport[] | undefined,
	}));
}

/**
 * Converts registration options into the form `navigator.credentials.create` takes.
 *
 * @param json Options as the server issued them.
 * @returns The same options with binary fields decoded.
 * @throws {RangeError} If a base64url field will not decode.
 */
export function toCreationOptions(
	json: PublicKeyCredentialCreationOptionsJSON,
): PublicKeyCredentialCreationOptions {
	if (typeof PublicKeyCredential.parseCreationOptionsFromJSON === "function") {
		return PublicKeyCredential.parseCreationOptionsFromJSON(json);
	}

	return {
		...json,
		challenge: bytes(json.challenge),
		user: { ...json.user, id: bytes(json.user.id) },
		excludeCredentials: descriptors(json.excludeCredentials),
	} as PublicKeyCredentialCreationOptions;
}

/**
 * Converts authentication options into the form `navigator.credentials.get` takes.
 *
 * @param json Options as the server issued them.
 * @returns The same options with binary fields decoded.
 * @throws {RangeError} If a base64url field will not decode.
 */
export function toRequestOptions(
	json: PublicKeyCredentialRequestOptionsJSON,
): PublicKeyCredentialRequestOptions {
	if (typeof PublicKeyCredential.parseRequestOptionsFromJSON === "function") {
		return PublicKeyCredential.parseRequestOptionsFromJSON(json);
	}

	return {
		...json,
		challenge: bytes(json.challenge),
		allowCredentials: descriptors(json.allowCredentials),
		userVerification: json.userVerification as UserVerificationRequirement | undefined,
	} as PublicKeyCredentialRequestOptions;
}

/**
 * Serializes a newly created credential for the registration endpoint.
 *
 * @param credential Credential the browser produced.
 * @returns The response as JSON.
 */
export function toRegistrationResponse(credential: PublicKeyCredential): RegistrationResponseJSON {
	if (typeof credential.toJSON === "function") {
		return credential.toJSON() as RegistrationResponseJSON;
	}

	let response = credential.response as AuthenticatorAttestationResponse;

	return {
		id: credential.id,
		rawId: Base64Url.encode(credential.rawId),
		type: credential.type,
		authenticatorAttachment: credential.authenticatorAttachment ?? undefined,
		clientExtensionResults:
			credential.getClientExtensionResults() as AuthenticationExtensionsClientOutputsJSON,
		response: {
			clientDataJSON: Base64Url.encode(response.clientDataJSON),
			attestationObject: Base64Url.encode(response.attestationObject),
			authenticatorData: Base64Url.encode(response.getAuthenticatorData()),
			publicKeyAlgorithm: response.getPublicKeyAlgorithm(),
			transports: response.getTransports(),
		},
	};
}

/**
 * Serializes an assertion for the authentication endpoint.
 *
 * @param credential Credential the browser produced.
 * @returns The response as JSON.
 */
export function toAuthenticationResponse(
	credential: PublicKeyCredential,
): AuthenticationResponseJSON {
	if (typeof credential.toJSON === "function") {
		return credential.toJSON() as AuthenticationResponseJSON;
	}

	let response = credential.response as AuthenticatorAssertionResponse;

	return {
		id: credential.id,
		rawId: Base64Url.encode(credential.rawId),
		type: credential.type,
		authenticatorAttachment: credential.authenticatorAttachment ?? undefined,
		clientExtensionResults:
			credential.getClientExtensionResults() as AuthenticationExtensionsClientOutputsJSON,
		response: {
			clientDataJSON: Base64Url.encode(response.clientDataJSON),
			authenticatorData: Base64Url.encode(response.authenticatorData),
			signature: Base64Url.encode(response.signature),
			userHandle: response.userHandle ? Base64Url.encode(response.userHandle) : undefined,
		},
	};
}
