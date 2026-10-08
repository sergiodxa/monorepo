/**
 * Domain registration data over RDAP: one `RDAP` client that finds a domain's registry
 * through the IANA bootstrap file and answers its expiry, status, registrar and
 * nameservers, with every failure an `RDAPError` a caller can schedule a retry from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { RDAPErrorCode, RDAPErrorDetails } from "./error.js";

export { RDAPError } from "./error.js";
export { RDAP } from "./rdap.js";
export { EPP_STATUSES } from "./status.js";
