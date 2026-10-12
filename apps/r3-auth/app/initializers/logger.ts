/**
 * The worker's logging configuration, stated once and handed to the two places every
 * invocation passes through: the router's middleware chain and the job dispatcher. Every
 * record this worker emits carries the same `service`, so a query can group by it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createLogger } from "@sdxc/logger";

export const logger = createLogger({ service: "auth" });
