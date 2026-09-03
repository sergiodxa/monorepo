/**
 * Public entry point for the logger package, exporting the immediate,
 * batched, and request-scoped logger implementations.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { Logger as ImmediateLogger } from "./logger.js";

export * from "./logger.js";
export * from "./types.js";
export { Logger as BatchedLogger } from "./batched-logger.js";
export { Logger as RequestLogger } from "./request-logger.js";

/**
 * Singleton instance of Logger for immediate logging outside of request context.
 */
export let logger = new ImmediateLogger();
