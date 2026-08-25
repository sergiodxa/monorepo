/**
 * Public entry point for the logger package, exporting the immediate,
 * batched, and request-scoped logger implementations.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { Logger as ImmediateLogger } from "./logger";

export * from "./logger";
export * from "./types";
export { Logger as BatchedLogger } from "./batched-logger";
export { Logger as RequestLogger } from "./request-logger";

/**
 * Singleton instance of Logger for immediate logging outside of request context.
 */
export let logger = new ImmediateLogger();
