/**
 * Signed tokens behind a team digest's one-click unsubscribe link. A token names one member's
 * opaque subject id and one optional email under an HMAC, so the link works from a mailbox
 * provider's sessionless POST while carrying no address and nothing a reader could forge.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CryptoError } from "@sdxc/crypto";
import type { Result } from "@sdxc/result";

import { Base64Url, Hex, hmac } from "@sdxc/crypto";
import { isFailure, success } from "@sdxc/result";
import { env } from "cloudflare:workers";

import type { OptionalEmail } from "~/database/schema";

import { absoluteUrl } from "~/app/lib/origin";
import { optionalEmails } from "~/database/schema";
import routes from "~/routes/web";

/**
 * Prefixed to every signed payload, so a MAC made here authenticates only a digest unsubscribe
 * even though the key is the session secret; the colon keeps it apart from anything base64 the
 * session cookie signs.
 */
const PURPOSE = "digest-unsubscribe:v1:";

/** Length of the hex SHA-256 MAC that opens every token, which is what lets it need no separator. */
const SIGNATURE_LENGTH = 64;

/** What a verified token authorizes: turning off one optional email for one member. */
export interface DigestUnsubscribe {
	/** The member's subject id at the auth server. */
	subjectId: string;
	/** The email the member stops receiving. */
	email: OptionalEmail;
}

/**
 * Signs a token for one member and one digest: the hex MAC followed by the base64url of
 * `email:subject`, so the URL stays one path segment that `href()` leaves unescaped.
 *
 * @param unsubscribe - Who stops receiving which email.
 * @returns The token, or the `CryptoError` the runtime raised while signing.
 */
export async function signDigestUnsubscribeToken(
	unsubscribe: DigestUnsubscribe,
): Promise<Result<string, CryptoError>> {
	let payload = `${unsubscribe.email}:${unsubscribe.subjectId}`;
	let mac = await hmac.sign(env.COOKIE_SESSION_SECRET, `${PURPOSE}${payload}`);
	if (isFailure(mac)) return mac;
	return success(`${Hex.encode(mac.data)}${Base64Url.encode(payload)}`);
}

/**
 * Reads a token back, answering `null` for anything malformed, signed with another key, or
 * naming an email that is no longer optional, so every failure closes the same way.
 *
 * @param token - The path segment from the unsubscribe URL.
 * @returns The member and email it authorizes, or `null`.
 */
export async function verifyDigestUnsubscribeToken(
	token: string,
): Promise<DigestUnsubscribe | null> {
	let signature = token.slice(0, SIGNATURE_LENGTH);
	let encoded = token.slice(SIGNATURE_LENGTH);
	if (signature.length < SIGNATURE_LENGTH || !encoded) return null;

	let decoded = Base64Url.decode(encoded);
	if (isFailure(decoded)) return null;

	let payload = new TextDecoder().decode(decoded.data);
	let valid = await hmac.verify(env.COOKIE_SESSION_SECRET, `${PURPOSE}${payload}`, signature);
	if (isFailure(valid) || !valid.data) return null;

	let separator = payload.indexOf(":");
	let email = optionalEmails.find((candidate) => candidate === payload.slice(0, separator));
	let subjectId = payload.slice(separator + 1);
	if (separator < 0 || !email || !subjectId) return null;

	return { subjectId, email };
}

/**
 * Absolute URL of the digest unsubscribe endpoint for a token: the confirmation page under
 * `GET`, and the RFC 8058 one-click target under `POST`.
 *
 * @param token - A token from {@link signDigestUnsubscribeToken}.
 * @returns The URL for both the footer and the `List-Unsubscribe` header.
 */
export function digestUnsubscribeUrl(token: string): string {
	return absoluteUrl(routes.digestUnsubscribe.index.href({ token }));
}
