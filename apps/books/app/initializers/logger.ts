/**
 * The worker's logging configuration, stated once so every log the router opens
 * carries the same `service` and a query across workers has something to group by.
 * The router's `log(logger)` middleware is the only place it attaches: this worker has
 * no job dispatcher and no other entry point.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createLogger } from "@sdxc/logger";

export const logger = createLogger({ service: "books" });
