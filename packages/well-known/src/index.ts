/**
 * Shared rules for the documents served under `/.well-known/` (RFC 8615): the format
 * description every document subpath fills in, the URL placement rule, and the error
 * every reader returns. Each document lives in its own subpath.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { WellKnownFormat, WellKnownPlacement } from "./format.js";

export { WellKnownParseError } from "./parse-error.js";
export { wellKnownUrl } from "./well-known-url.js";
