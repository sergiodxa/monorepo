import { Logger } from "./logger";

export * from "./logger";
export * from "./types";
export * from "./middleware";
export * from "./batched-logger";

/**
 * Singleton instance of Logger for immediate logging outside of request context.
 */
export let logger = new Logger();
