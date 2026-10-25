/**
 * The Token structure of RFC 9577 §2.2.1 and the `Authorization: PrivateToken` credentials
 * that carry it. A token's field sizes depend on its type, so only the types RFC 9578
 * registers decode; a greased or unknown type fails as unsupported.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Bytes } from "@sdxc/crypto";
import type { Result } from "@sdxc/result";

import { Base64Url, concatBytes } from "@sdxc/crypto";
import { failure, isFailure, success } from "@sdxc/result";

import { PrivacyPassError } from "./errors.js";
import { Cursor, uint16 } from "./lib/wire.js";

/** Token type `0x0001`, VOPRF(P-384, SHA-384), verifiable only with the issuer's private key. */
export const VOPRF_TOKEN_TYPE = 0x0001;

/** Token type `0x0002`, Blind RSA (2048-bit), verifiable with the issuer's public key. */
export const BLIND_RSA_TOKEN_TYPE = 0x0002;

/** Bytes of the client nonce and of the challenge digest, fixed for every token type. */
const NONCE_LENGTH = 32;

/** `Nid` and `Nk` from RFC 9578 §8.2 for each registered token type. */
const SIZES = new Map<number, { keyId: number; authenticator: number }>([
	[VOPRF_TOKEN_TYPE, { keyId: 32, authenticator: 48 }],
	[BLIND_RSA_TOKEN_TYPE, { keyId: 32, authenticator: 256 }],
]);

/** The scheme name, compared case-insensitively as RFC 9110 §11.1 requires. */
const SCHEME = "privatetoken";

/** An auth-param: a token name, `=`, then a token or a quoted-string value. */
const AUTH_PARAM = /^([!#$%&'*+\-.^_`|~0-9A-Za-z]+)[ \t]*=[ \t]*(?:"((?:[^"\\]|\\.)*)"|([^\s,"]+))/;

/** A decoded token. */
export interface Token {
	tokenType: number;
	/** The client's random nonce, unique per token; double-spend checks key on it. */
	nonce: Bytes;
	/** `SHA-256` of the TokenChallenge the token answers. */
	challengeDigest: Bytes;
	/** `SHA-256` of the issuer key that signed it. */
	tokenKeyId: Bytes;
	/** The issuer's signature or MAC over the preceding fields. */
	authenticator: Bytes;
}

/**
 * Decodes a token of a registered type.
 *
 * @param bytes - The encoded Token
 * @returns The fields, or `unsupported-token-type` for an unregistered type and
 * `malformed-token` for one whose length does not match its type
 */
export function parseToken(bytes: Uint8Array): Result<Token, PrivacyPassError> {
	let cursor = new Cursor(bytes);
	let tokenType = cursor.uint16();
	if (tokenType === null) return malformed("The token ends before its type");

	let sizes = SIZES.get(tokenType);
	if (sizes === undefined) {
		return failure(
			new PrivacyPassError("unsupported-token-type", `Token type ${tokenType} is not registered`),
		);
	}

	let nonce = cursor.bytes(NONCE_LENGTH);
	let challengeDigest = cursor.bytes(NONCE_LENGTH);
	let tokenKeyId = cursor.bytes(sizes.keyId);
	let authenticator = cursor.bytes(sizes.authenticator);
	if (nonce === null || challengeDigest === null || tokenKeyId === null || authenticator === null) {
		return malformed("The token ends before its authenticator");
	}
	if (!cursor.done) return malformed("The token has bytes after its authenticator");
	return success({ tokenType, nonce, challengeDigest, tokenKeyId, authenticator });
}

/**
 * Encodes a token, the inverse of {@link parseToken}.
 *
 * @param token - The fields
 * @returns The structure a client sends
 */
export function encodeToken(token: Token): Bytes {
	return concatBytes(tokenAuthenticatorInput(token), token.authenticator);
}

/**
 * The bytes the issuer signed: every field before the authenticator.
 *
 * @param token - The token
 * @returns `token_type || nonce || challenge_digest || token_key_id`
 */
export function tokenAuthenticatorInput(token: Omit<Token, "authenticator">): Bytes {
	return concatBytes(uint16(token.tokenType), token.nonce, token.challengeDigest, token.tokenKeyId);
}

/**
 * Reads the `token` parameter of `PrivateToken` credentials and decodes it, ignoring any
 * other parameter as RFC 9577 §2.2.2 requires.
 *
 * @param authorization - The `Authorization` header value, or `null` when the request sent none
 * @returns The token, `missing-token` when the header is absent, of another scheme or has no
 * `token`, and the failure of {@link parseToken} otherwise
 * @example parseAuthorization(request.headers.get("Authorization"))
 */
export function parseAuthorization(authorization: string | null): Result<Token, PrivacyPassError> {
	let encoded = readTokenParameter(authorization);
	if (encoded === null) {
		return failure(new PrivacyPassError("missing-token", "The request carries no PrivateToken"));
	}
	let bytes = Base64Url.decode(encoded);
	if (isFailure(bytes)) return malformed("The token is not base64url", bytes.error);
	return parseToken(bytes.data);
}

/**
 * The raw `token` parameter, or `null` when the credentials are another scheme or lack it.
 *
 * @param authorization - The `Authorization` header value
 * @returns The parameter's value, unquoted
 */
function readTokenParameter(authorization: string | null): string | null {
	if (authorization === null) return null;
	let header = authorization.trim();
	let space = header.search(/[ \t]/);
	if (space === -1 || header.slice(0, space).toLowerCase() !== SCHEME) return null;

	let rest = header.slice(space).trimStart();
	while (rest !== "") {
		let match = AUTH_PARAM.exec(rest);
		if (match === null) return null;
		let value = match[2] === undefined ? match[3]! : match[2].replace(/\\(.)/g, "$1");
		if (match[1]!.toLowerCase() === "token") return value;
		rest = rest.slice(match[0].length).replace(/^[ \t]*,?[ \t]*/, "");
	}
	return null;
}

/**
 * The failure for a token whose bytes do not fit its type.
 *
 * @param message - What was wrong
 * @param cause - The decoding failure, when one caused it
 * @returns The failure
 */
function malformed(message: string, cause?: Error): Result<never, PrivacyPassError> {
	return failure(
		new PrivacyPassError("malformed-token", message, cause === undefined ? undefined : { cause }),
	);
}
