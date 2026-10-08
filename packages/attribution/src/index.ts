/**
 * Public surface of the attribution package: reading a touch off a request, classifying a
 * referrer, and flattening touches into checkout metadata or `utm_*` fields, with the shapes a
 * touch is made of.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { ClassifyReferrerOptions } from "./referrer.js";
export type { ReadTouchOptions } from "./touch.js";
export type { Attribution, Channel, Click, Referrer, ReferrerKind, Touch, Utm } from "./types.js";

export { toCampaign, toMetadata, toUtmParams } from "./metadata.js";
export { classifyReferrer } from "./referrer.js";
export { normalizeValue, readTouch } from "./touch.js";
