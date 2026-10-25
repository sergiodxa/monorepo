/**
 * Converts between JSContact and vCard 4.0 (RFC 6350) as RFC 9555 specifies, updated for
 * JSContact 2.0 by RFC 9982: vCard text and jCard (RFC 7095) both read into one in-memory
 * card that converts to and from a Card.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { JCard, JCardProperty, VCard, VCardProperty, VCardValue } from "./lib/vcard/model.js";

export { VCardParseError } from "./lib/errors.js";
export { fromVCard } from "./lib/vcard/from-vcard.js";
export { readJCard, writeJCard } from "./lib/vcard/model.js";
export { parseVCard, stringifyVCard } from "./lib/vcard/text.js";
export { toVCard } from "./lib/vcard/to-vcard.js";

/** The media type of vCard text (RFC 6350 §10.1). */
export const VCARD_MEDIA_TYPE = "text/vcard;charset=utf-8";

/** The media type of a jCard document (RFC 7095 §6). */
export const JCARD_MEDIA_TYPE = "application/vcard+json";
