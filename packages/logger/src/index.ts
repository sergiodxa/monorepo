/**
 * Public entry point for the logger package: the worker configuration, the wide event it
 * opens per invocation, and the accessor for the invocation's current log. The batched and
 * request-scoped loggers stay exported until every consumer has moved to the log.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { Logger as ImmediateLogger } from "./logger.js";

export type { Logger as ConfiguredLogger } from "./create-logger.js";
export type { Sample } from "./sample.js";

export { createLogger } from "./create-logger.js";
export { currentLog } from "./current.js";
export { Log } from "./log.js";
export * from "./logger.js";
export { Logger as BatchedLogger } from "./batched-logger.js";
export { Logger as RequestLogger } from "./request-logger.js";

/**
 * Singleton instance of Logger for immediate logging outside of request context.
 */
export let logger = new ImmediateLogger();
