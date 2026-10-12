/**
 * The worker's logging configuration, stated once and handed to the router's middleware
 * chain. Every log line this worker emits carries the same `service`, so a query against
 * the platform's logs selects this app rather than a mix of whatever ran on the account.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createLogger, currentLog } from "@sdxc/logger";

export const logger = createLogger({ service: "reader" });

/**
 * Sends a render failure to the request's log, as the renderer's `onError`. A Worker discards
 * the default console-based error hook, so without it a page that failed mid-stream leaves no
 * trace.
 *
 * @param error - What the render threw.
 */
export function logRenderFailure(error: unknown): void {
	currentLog()?.fail(error, { render: { failed: true } });
}
