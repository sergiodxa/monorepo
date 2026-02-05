import { getLoggerFromContext, type BatchedLogger } from "@pkg/logger";

import { getContext } from "./context-storage";

export function logger(): BatchedLogger {
	return getLoggerFromContext(getContext());
}
