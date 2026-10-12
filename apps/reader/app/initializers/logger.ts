/**
 * The worker's logging configuration, stated once and handed to the router's middleware
 * chain. Every log line this worker emits carries the same `service`, so a query against
 * the platform's logs selects this app rather than a mix of whatever ran on the account.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createLogger } from "@sdxc/logger";

export const logger = createLogger({ service: "reader" });
