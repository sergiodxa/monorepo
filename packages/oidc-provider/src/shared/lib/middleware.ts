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
 * Types an inline middleware callback against the router's request context.
 *
 * The current fetch-router `Middleware` type takes a single context-transform
 * parameter (defaulting to no transform); values a middleware attaches to the
 * context are declared through `declare module "remix/router"`
 * augmentations, so this helper only needs to contextually type `context`/`next`.
 * @param middleware - The middleware callback to type and return.
 * @returns The same middleware, typed as a `Middleware`.
 * @example
 * export default middleware((context, next) => { context.foo = 1; return next(); });
 */
export default function middleware(middleware: Middleware): Middleware {
	return middleware;
}
