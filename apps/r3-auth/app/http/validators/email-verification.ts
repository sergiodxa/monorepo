/**
 * Schemas for the verification endpoint: the query string a link carries, and the form the
 * confirmation page posts back. They exist so a token that could not have been issued here
 * is refused before it reaches the store: the endpoint is unauthenticated and reachable by
 * anybody, so the cheapest possible rejection is the right one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";

/**
 * Shape of a token this server issues: base64url over 32 random bytes, unpadded.
 * Anchored and length-exact so a malformed value never becomes a lookup — a shape
 * check only, proving nothing until the store confirms the token was issued.
 */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** The verification link's query string. */
export const VerifyEmailQuerySchema = s.object({
	token: s.string().refine((value) => TOKEN_PATTERN.test(value), "Invalid token"),
});

/**
 * The confirmation form's body, which carries the same token the page was opened with.
 *
 * The token travels as a hidden field, keeping it off the request URL that a `Referer`
 * header or access log would otherwise capture.
 */
export const VerifyEmailFormSchema = s.object({
	token: s.string().refine((value) => TOKEN_PATTERN.test(value), "Invalid token"),
});
