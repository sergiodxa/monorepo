/**
 * Public surface of the rate limit package: the adapter contract and its four
 * backends, the decision they answer with, and the serialization of that decision
 * into response headers. The route middleware lives behind `./middleware`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { Adapter, RateLimitDecision } from "./types.js";
export type { RateLimitBackend, RateLimitErrorOptions } from "./rate-limit-error.js";
export type { MemoryAdapterOptions } from "./memory.js";
export type { CloudflareAdapterOptions, RateLimiterBinding } from "./cloudflare.js";
export type { KVAdapterOptions, RateLimitKVNamespace } from "./kv.js";
export type { DataTableAdapterOptions, RateLimitHitRow } from "./data-table.js";

export { RateLimitError } from "./rate-limit-error.js";
export { applyRateLimitHeaders, rateLimitHeaders } from "./headers.js";
export { MemoryAdapter } from "./memory.js";
export { CloudflareAdapter } from "./cloudflare.js";
export { KVAdapter } from "./kv.js";
export { DataTableAdapter, RATE_LIMIT_HITS_SCHEMA_SQL, rateLimitHits } from "./data-table.js";
