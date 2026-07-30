/**
 * The three header names the Standard Webhooks specification defines, written
 * once so the signing and the verifying side can never drift apart.
 *
 * They are spelled lowercase because that is how the specification writes them;
 * lookups through `Headers` are case-insensitive, so a sender using `Webhook-Id`
 * still resolves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Header carrying the unique delivery id, the first field of the signed content. */
export const ID_HEADER = "webhook-id";

/** Header carrying the send time in whole seconds since the epoch. */
export const TIMESTAMP_HEADER = "webhook-timestamp";

/** Header carrying one or more space-separated, scheme-prefixed signatures. */
export const SIGNATURE_HEADER = "webhook-signature";
