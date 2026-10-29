/**
 * The worker's logging configuration, stated once so every log the router opens
 * carries the same `service` and a query across workers has something to group by.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createLogger } from "@sdxc/logger";

export const logger = createLogger({ service: "sdxc" });
