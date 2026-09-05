/**
 * Public entry point for the logger package: the worker's configuration, the wide event it
 * opens per invocation, and the accessor for the log the running invocation is recorded in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { Logger } from "./create-logger.js";
export type { Sample } from "./sample.js";

export { createLogger } from "./create-logger.js";
export { currentLog } from "./current.js";
export { Log } from "./log.js";
