import { Logger as ImmediateLogger } from "./logger";

export * from "./logger";
export * from "./types";
export { createBatchedLoggerMiddleware } from "./middleware";
export { Logger as BatchedLogger } from "./batched-logger";
export { Logger as RequestLogger } from "./request-logger";

/**
 * Singleton instance of Logger for immediate logging outside of request context.
 */
export let logger = new ImmediateLogger();
