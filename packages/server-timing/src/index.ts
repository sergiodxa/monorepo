/**
 * Server-Timing measurement for HTTP handlers.
 *
 * A request-scoped collector times the slow parts of a response — database reads, cache
 * lookups, upstream calls — and renders them as the `Server-Timing` header, so a slow
 * response can be attributed from the browser's network panel without extra tooling.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export { TimingCollector } from "./timing-collector.js";
