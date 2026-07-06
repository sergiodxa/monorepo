/**
 * Helper that resolves the current request's RequestLogger from the async context
 * storage, giving loaders, actions, and services a single accessor for structured
 * per-request logging without threading the logger through function arguments.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { RequestLogger } from "@pkg/logger";

import { getContext } from "./context-storage";

/**
 * Get the RequestLogger for the current request.
 * Must be called within a request context.
 */
export function logger(): RequestLogger {
	return RequestLogger.getFromContext(getContext());
}
