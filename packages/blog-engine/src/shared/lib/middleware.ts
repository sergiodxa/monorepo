/**
 * Tiny identity helper that contextually types an inline middleware callback against
 * the router's `Middleware` type, so inline middleware get `context`/`next` typing
 * without a manual annotation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Middleware } from "remix/router";

/**
 * Types an inline middleware callback against the router's request context.
 * Context values a middleware attaches are declared via `declare module
 * "remix/router"` augmentations, so this only needs to type `context`/`next`.
 * @param middleware - The middleware function to type.
 * @returns The same middleware, typed as a `Middleware`.
 */
export default function middleware(middleware: Middleware): Middleware {
	return middleware;
}
