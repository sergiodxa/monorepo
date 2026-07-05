/**
 * Tiny identity helper that contextually types an inline middleware callback against
 * the router's `Middleware` type, so inline middleware get `context`/`next` typing
 * without a manual annotation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Middleware } from "remix/fetch-router";

/**
 * Types an inline middleware callback against the router's request context.
 *
 * The current fetch-router `Middleware` type takes a single context-transform
 * parameter (defaulting to no transform); values a middleware attaches to the
 * context are declared through `declare module "remix/fetch-router"` augmentations,
 * so this helper only needs to contextually type `context`/`next`.
 * @param middleware - The middleware function to type.
 * @returns The same middleware, typed as a `Middleware`.
 */
export default function middleware(middleware: Middleware): Middleware {
	return middleware;
}
