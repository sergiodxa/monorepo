import type { Middleware } from "remix/fetch-router";

/**
 * Preserves method and params inference for fetch-router middleware functions.
 *
 * Use this helper to define router middleware functions with explicit method
 * and params typing.
 */
export default function middleware<T extends Middleware>(middleware: T): T {
	return middleware;
}
