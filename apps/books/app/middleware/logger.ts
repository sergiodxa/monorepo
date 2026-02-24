import { RequestLogger } from "@pkg/logger";

import { getContext } from "./context-storage";

/**
 * Get the RequestLogger for the current request.
 * Must be called within a request context.
 */
export function logger(): RequestLogger {
	return RequestLogger.getFromContext(getContext());
}
