/**
 * The worker's logging configuration, stated once so the router and the job dispatcher open
 * their records under the same `service` and a query can group the two halves of one
 * submission — the request that accepted it and the job that mailed the confirmation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createLogger } from "@sdxc/logger";

export const logger = createLogger({ service: "demo" });
