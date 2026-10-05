/**
 * The package entrypoint: checking and following a URL a stranger chose, which only
 * the public internet needs, beside reading any message's body within a cap, which
 * every runtime boundary needs. Every failure is one `OutboundError`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { CheckOptions } from "./check.js";
export type { OutboundErrorCode } from "./error.js";
export type { Followed, FollowOptions } from "./follow.js";
export type { ReadBytes, ReadOptions, ReadText } from "./read.js";
export type { ResolveHostOptions } from "./resolve.js";

export { checkUrl } from "./check.js";
export { OutboundError } from "./error.js";
export { follow } from "./follow.js";
export { limitBody, readBytes, readText, release } from "./read.js";
export { resolveHost } from "./resolve.js";
