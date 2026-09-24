/**
 * The receiving side of one-click unsubscribe: HMAC-signed tokens that let an
 * unsubscribe URL name the recipient and list with no session and no stored row, and
 * a recognizer for the RFC 8058 POST a mailbox provider sends to that URL.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { Base64Url, Hex, hmac } from "@sdxc/crypto";
import { failure, isFailure, success } from "@sdxc/result";

import { InvalidUnsubscribeTokenError, MailError } from "./errors.js";
import { isValidAddress } from "./lib/address.js";

export { InvalidUnsubscribeTokenError } from "./errors.js";

/**
 * Prefixed to every signed payload unless a caller names its own, so a MAC made here
 * authenticates only an unsubscribe even when the secret also signs something else.
 */
const DEFAULT_PURPOSE = "unsubscribe:v1:";

/** Length of the hex SHA-256 MAC that opens every token, which is what lets it need no separator. */
const SIGNATURE_LENGTH = 64;

/** Control characters, which the payload uses as its field separator. */
const CONTROL_CHARACTERS = /\p{Cc}/u;

/** Types for the unsubscribe token helpers. */
export namespace UnsubscribeToken {
	/** What a verified token authorizes. */
	export interface Claims {
		/** Who is unsubscribing: an opaque id, never an email address, since the token lands in URLs and logs. */
		subject: string;
		/** What they are unsubscribing from, matching the app's own list or email-kind name. */
		list: string;
		/** When the token was signed; `null` for a token whose payload names only the list and subject. */
		issuedAt: Date | null;
	}

	/** Options both signing and verifying accept; they must agree for a token to verify. */
	export interface Options {
		/**
		 * Domain-separation prefix for the MAC, so a secret shared with sessions or webhooks
		 * cannot be used to mint an unsubscribe token.
		 * @default "unsubscribe:v1:"
		 */
		purpose?: string;
	}

	/** Options for signing a token. */
	export interface SignOptions extends Options {
		/** When the link stops working; omitted means never, since providers may POST long after delivery. */
		expiresAt?: Date;
	}
}

/**
 * Serializes the claims as `list:subject`, followed by the issue time and optional
 * expiry in Unix seconds on their own lines. The list holds no colon and neither field
 * a control character, so the first colon and each line break split it unambiguously.
 */
function encodePayload(
	claims: { subject: string; list: string },
	issuedAt: Date,
	expiresAt?: Date,
): string {
	let lines = [`${claims.list}:${claims.subject}`, String(Math.floor(issuedAt.getTime() / 1000))];
	if (expiresAt) lines.push(String(Math.floor(expiresAt.getTime() / 1000)));
	return lines.join("\n");
}

/**
 * Reads a payload back, or `null` when it is malformed or expired at `now`. A payload
 * with only `list:subject` verifies with a `null` issue time and no expiry.
 */
function decodePayload(payload: string, now: Date): UnsubscribeToken.Claims | null {
	let [head = "", issued, expires, ...rest] = payload.split("\n");
	if (rest.length > 0) return null;

	let separator = head.indexOf(":");
	let list = head.slice(0, separator);
	let subject = head.slice(separator + 1);
	if (separator <= 0 || !subject) return null;

	let issuedAt = issued === undefined ? null : fromSeconds(issued);
	if (issuedAt === undefined) return null;
	if (expires !== undefined) {
		let expiresAt = fromSeconds(expires);
		if (!expiresAt || now >= expiresAt) return null;
	}

	return { subject, list, issuedAt };
}

/** Parses a decimal Unix-seconds field, or `undefined` for anything else. */
function fromSeconds(value: string): Date | undefined {
	if (!/^\d+$/.test(value)) return undefined;
	return new Date(Number(value) * 1000);
}

/**
 * Signs an unsubscribe token: the hex HMAC-SHA-256 followed by the base64url payload, so
 * the whole token is one URL path segment that needs no escaping. The subject must be
 * an opaque id; an email address is refused because the token travels in URLs and logs.
 *
 * @param secret - The app's unsubscribe secret; rotating it invalidates every delivered link.
 * @param claims - The recipient's opaque id and the list they leave.
 * @param options - An expiry, and the purpose prefix the verifier must also use.
 * @returns The token, or a `MailError` for unusable claims or a failed signature.
 * @example let token = await signUnsubscribeToken(env.UNSUBSCRIBE_SECRET, { subject: member.id, list: "digest" });
 */
export async function signUnsubscribeToken(
	secret: string,
	claims: { subject: string; list: string },
	options: UnsubscribeToken.SignOptions = {},
): Promise<Result<string, MailError>> {
	if (!claims.list || claims.list.includes(":") || CONTROL_CHARACTERS.test(claims.list)) {
		return failure(new MailError("An unsubscribe list must be a non-empty name without colons."));
	}
	if (!claims.subject || CONTROL_CHARACTERS.test(claims.subject)) {
		return failure(new MailError("An unsubscribe subject must be a non-empty opaque id."));
	}
	if (isValidAddress({ email: claims.subject })) {
		return failure(new MailError("An unsubscribe subject must be an opaque id, not an address."));
	}

	let payload = encodePayload(claims, new Date(), options.expiresAt);
	let purpose = options.purpose ?? DEFAULT_PURPOSE;
	let mac = await hmac.sign(secret, `${purpose}${payload}`);
	if (isFailure(mac)) {
		return failure(new MailError("Failed to sign the unsubscribe token.", { cause: mac.error }));
	}

	return success(`${Hex.encode(mac.data)}${Base64Url.encode(payload)}`);
}

/**
 * Verifies a token from an unsubscribe URL in constant time and returns what it
 * authorizes. Every way a token can be unusable arrives as the same error, so the
 * endpoint answers them alike.
 *
 * @param secret - The secret the token was signed with.
 * @param token - The path segment from the unsubscribe URL.
 * @param options - The purpose prefix the token was signed with.
 * @returns The claims, or an `InvalidUnsubscribeTokenError`.
 */
export async function verifyUnsubscribeToken(
	secret: string,
	token: string,
	options: UnsubscribeToken.Options = {},
): Promise<Result<UnsubscribeToken.Claims, InvalidUnsubscribeTokenError>> {
	let signature = token.slice(0, SIGNATURE_LENGTH);
	let encoded = token.slice(SIGNATURE_LENGTH);
	if (signature.length < SIGNATURE_LENGTH || !encoded) {
		return failure(new InvalidUnsubscribeTokenError());
	}

	let decoded = Base64Url.decode(encoded);
	if (isFailure(decoded)) return failure(new InvalidUnsubscribeTokenError());

	let payload = new TextDecoder().decode(decoded.data);
	let purpose = options.purpose ?? DEFAULT_PURPOSE;
	let valid = await hmac.verify(secret, `${purpose}${payload}`, signature);
	if (isFailure(valid)) return failure(new InvalidUnsubscribeTokenError({ cause: valid.error }));
	if (!valid.data) return failure(new InvalidUnsubscribeTokenError());

	let claims = decodePayload(payload, new Date());
	if (!claims) return failure(new InvalidUnsubscribeTokenError());
	return success(claims);
}

/**
 * Reports whether a parsed form body is RFC 8058's `List-Unsubscribe=One-Click`, which
 * is how an endpoint tells the mailbox provider's POST, which reads no response body,
 * from a person pressing the confirmation page's button.
 *
 * @param form - The request's parsed form data, URL-encoded or multipart.
 * @returns `true` only for the exact field and value RFC 8058 defines.
 */
export function isOneClickUnsubscribe(form: FormData): boolean {
	return form.get("List-Unsubscribe") === "One-Click";
}
