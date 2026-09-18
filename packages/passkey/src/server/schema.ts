/**
 * Schemas for the two ceremony responses a browser posts back.
 *
 * A WebAuthn response reaches the server as untrusted JSON, so it is parsed
 * into the exact fields verification reads before any byte of it is decoded.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";

/** Shape of a `navigator.credentials.create()` result serialized to JSON. */
export const RegistrationResponse = s.object({
	id: s.string(),
	rawId: s.string(),
	type: s.string(),
	authenticatorAttachment: s.optional(s.string()),
	response: s.object({
		clientDataJSON: s.string(),
		attestationObject: s.string(),
		transports: s.optional(s.array(s.string())),
	}),
});

/** Shape of a `navigator.credentials.get()` result serialized to JSON. */
export const AuthenticationResponse = s.object({
	id: s.string(),
	rawId: s.string(),
	type: s.string(),
	authenticatorAttachment: s.optional(s.string()),
	response: s.object({
		clientDataJSON: s.string(),
		authenticatorData: s.string(),
		signature: s.string(),
		userHandle: s.optional(s.string()),
	}),
});
