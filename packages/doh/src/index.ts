/**
 * Typed DNS-over-HTTPS lookups for runtimes with no DNS socket, such as Cloudflare Workers:
 * `resolve` returns records typed per query type and distinct failures for NXDOMAIN,
 * SERVFAIL and transport errors, beside the TXT and CNAME checks domain verification needs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { DoH } from "./types.js";

export {
	DoHError,
	NameNotFoundError,
	RecordDataError,
	ResponseCodeError,
	ServerFailureError,
	TransportError,
} from "./errors.js";
export { parseRecordData } from "./parse-record-data.js";
export { resolve } from "./resolve.js";
export { CLOUDFLARE, GOOGLE } from "./resolvers.js";
export { checkCname, verifyTxtRecord } from "./verify.js";
