/**
 * Identity helper for contextually typing inline router middleware.
 *
 * Lets the provider's middleware modules write a callback without repeating the
 * `Middleware` annotation while keeping `context`/`next` type-safe.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

/**
 * Types an inline middleware callback against the router's request context, avoiding
 * a repeated `Middleware` annotation; context extensions come from `declare module`
 * augmentations elsewhere, so only `context`/`next` need typing here.
 * @param middleware - The middleware callback to type and return.
 * @returns The same middleware, typed as a `Middleware`.
 * @example
 * export default middleware((context, next) => { context.foo = 1; return next(); });
 */
export default function middleware(middleware: Middleware): Middleware {
	return middleware;
}
