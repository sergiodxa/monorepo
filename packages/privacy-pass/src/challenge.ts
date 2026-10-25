/**
 * The TokenChallenge structure of RFC 9577 §2.1.1 and the `WWW-Authenticate` value that
 * carries it: an origin names the issuer, the redemption context and the origins a token
 * may be spent at, and a client's token commits to the SHA-256 digest of those bytes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Bytes } from "@sdxc/crypto";
import type { Result } from "@sdxc/result";

import { concatBytes } from "@sdxc/crypto";
import { failure, isFailure, success } from "@sdxc/result";

import { PrivacyPassError } from "./errors.js";
import { Cursor, toPaddedBase64Url, uint16 } from "./lib/wire.js";

/** The only non-empty redemption context length RFC 9577 §2.1.1 allows. */
const CONTEXT_LENGTH = 32;

/** The largest value a two-byte length prefix holds. */
const MAX_UINT16 = 0xffff;

/**
 * A server name as RFC 9577 §2.1.1.1 writes it: a URI authority with an optional port and
 * no userinfo, in printable ASCII with no comma, since commas separate `origin_info` names.
 */
const SERVER_NAME = /^[!-+\--~]+$/;

/** A challenge's fields, decoded. */
export interface TokenChallenge {
	/** The issuance protocol, `0x0002` for Blind RSA. */
	tokenType: number;
	/** The issuer allowed to issue tokens for this challenge, such as `issuer.example.com`. */
	issuerName: string;
	/**
	 * Empty, or 32 bytes the origin chose; a client caches tokens per context, so a fresh
	 * context per challenge forces a freshly issued token.
	 */
	redemptionContext: Uint8Array;
	/** The origins a token may be spent at; empty for a cross-origin token. */
	originInfo: readonly string[];
}

/** What {@link formatChallenge} writes into one `PrivateToken` challenge. */
export interface ChallengeParameters {
	/** The encoded TokenChallenge. */
	challenge: Uint8Array;
	/** The issuer key a client requests its token under, encoded as its token type defines. */
	tokenKey: Uint8Array;
	/** Seconds the origin accepts a token for this challenge, sent as `max-age`. */
	maxAge?: number;
}

/**
 * Encodes a challenge's fields into the bytes its digest and its `challenge` parameter
 * are computed from.
 *
 * @param challenge - The fields
 * @returns The structure, or `invalid-challenge` for a context that is neither empty nor 32
 * bytes, a token type outside 16 bits, or a name that is not a server name
 * @example encodeTokenChallenge({ tokenType: 2, issuerName: "issuer.example.com", redemptionContext: new Uint8Array(), originInfo: [] })
 */
export function encodeTokenChallenge(challenge: TokenChallenge): Result<Bytes, PrivacyPassError> {
	let { tokenType, issuerName, redemptionContext, originInfo } = challenge;
	if (!Number.isInteger(tokenType) || tokenType < 0 || tokenType > MAX_UINT16) {
		return invalid(`Token type ${tokenType} does not fit in two bytes`);
	}
	if (redemptionContext.length !== 0 && redemptionContext.length !== CONTEXT_LENGTH) {
		return invalid(`A redemption context is 0 or 32 bytes, not ${redemptionContext.length}`);
	}
	for (let name of [issuerName, ...originInfo]) {
		if (!SERVER_NAME.test(name) || name.includes("@")) {
			return invalid(`"${name}" is not a server name`);
		}
	}

	let issuer = new TextEncoder().encode(issuerName);
	let origins = new TextEncoder().encode(originInfo.join(","));
	if (issuer.length > MAX_UINT16 || origins.length > MAX_UINT16) {
		return invalid("The issuer name or origin list is longer than 65535 bytes");
	}

	return success(
		concatBytes(
			uint16(tokenType),
			uint16(issuer.length),
			issuer,
			new Uint8Array([redemptionContext.length]),
			redemptionContext,
			uint16(origins.length),
			origins,
		),
	);
}

/**
 * Decodes a TokenChallenge, holding it to the same rules {@link encodeTokenChallenge}
 * writes by.
 *
 * @param bytes - The encoded structure
 * @returns The fields, or `invalid-challenge` for a truncated, padded or out-of-rule one
 */
export function parseTokenChallenge(bytes: Uint8Array): Result<TokenChallenge, PrivacyPassError> {
	let cursor = new Cursor(bytes);
	let tokenType = cursor.uint16();
	let issuer = cursor.vector(2);
	let redemptionContext = cursor.vector(1);
	let origins = cursor.vector(2);
	if (tokenType === null || issuer === null || redemptionContext === null || origins === null) {
		return invalid("The challenge ends before its last field");
	}
	if (!cursor.done) return invalid("The challenge has bytes after its last field");

	let originText = new TextDecoder().decode(origins);
	let challenge: TokenChallenge = {
		tokenType,
		issuerName: new TextDecoder().decode(issuer),
		redemptionContext,
		originInfo: originText === "" ? [] : originText.split(","),
	};
	let check = encodeTokenChallenge(challenge);
	return isFailure(check) ? check : success(challenge);
}

/**
 * Writes one `PrivateToken` challenge for a `WWW-Authenticate` header. Join several with
 * `", "` to offer more than one issuer or token type, most preferred first.
 *
 * @param parameters - The encoded challenge, the issuer key and the acceptance window
 * @returns The challenge text
 * @example response.headers.set("WWW-Authenticate", formatChallenge({ challenge, tokenKey, maxAge: 300 }))
 */
export function formatChallenge(parameters: ChallengeParameters): string {
	let text = `PrivateToken challenge="${toPaddedBase64Url(parameters.challenge)}", token-key="${toPaddedBase64Url(parameters.tokenKey)}"`;
	return parameters.maxAge === undefined ? text : `${text}, max-age=${parameters.maxAge}`;
}

/**
 * The failure for a challenge outside RFC 9577's rules.
 *
 * @param message - What was wrong
 * @returns The failure
 */
function invalid(message: string): Result<never, PrivacyPassError> {
	return failure(new PrivacyPassError("invalid-challenge", message));
}
