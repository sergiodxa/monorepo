/**
 * The WebPKI reading of CAA records (RFC 8659, RFC 8657): what a record asks of a CA, the
 * RRset that applies to a name, and whether a CA may issue for it, kept apart from the DNS
 * reading at the package root so every CAA answer stays as small as the record itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { CAA } from "./caa/types.js";

export { evaluateCaa } from "./caa/evaluate.js";
export { mayIssue } from "./caa/may-issue.js";
export { parseCaaProperty } from "./caa/property.js";
export { findRelevantCaa } from "./caa/relevant-set.js";
