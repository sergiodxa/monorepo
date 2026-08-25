/**
 * Public entry point for the result package: constructors, type guards,
 * and combinators for working with `Result` values.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { Success, Failure, Result } from "./types.js";
export { success } from "./success.js";
export { failure } from "./failure.js";
export { isSuccess } from "./is-success.js";
export { isFailure } from "./is-failure.js";
export { succeeded } from "./succeeded.js";
export { failed } from "./failed.js";
export { unwrap } from "./unwrap.js";
export { match } from "./match.js";
export { retry, RetryError } from "./retry.js";
export { wrap } from "./wrap.js";
export { partition } from "./partition.js";
