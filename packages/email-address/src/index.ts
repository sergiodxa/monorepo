/**
 * Email address parsing and normalization: one address split into the form to deliver
 * to and the form to compare on. The disposable-domain list, mail-server lookups, role
 * accounts and typo suggestions live under their own export paths, so parsing stays small.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { EmailAddress, EmailAddressReason } from "./parse.js";

export { InvalidEmailAddressError, normalizeDomain, parseEmailAddress } from "./parse.js";
