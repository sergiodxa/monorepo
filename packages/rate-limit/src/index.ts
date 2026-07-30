/**
 * Public surface of the rate limit package: the adapter contract and its four
 * backends, the decision they answer with, and the serialization of that decision
 * into response headers. The route middleware lives behind `./middleware`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { Adapter, RateLimitDecision } from "./types";
export type { RateLimitBackend, RateLimitErrorOptions } from "./rate-limit-error";
export type { MemoryAdapterOptions } from "./memory";
export type { CloudflareAdapterOptions, RateLimiterBinding } from "./cloudflare";
export type { KVAdapterOptions, RateLimitKVNamespace } from "./kv";
export type { DataTableAdapterOptions, RateLimitHitRow } from "./data-table";

export { RateLimitError } from "./rate-limit-error";
export { applyRateLimitHeaders, rateLimitHeaders } from "./headers";
export { MemoryAdapter } from "./memory";
export { CloudflareAdapter } from "./cloudflare";
export { KVAdapter } from "./kv";
export { DataTableAdapter, RATE_LIMIT_HITS_SCHEMA_SQL, rateLimitHits } from "./data-table";
