/**
 * The worker's logging configuration, stated once and handed to the router's middleware
 * chain, so every request — the MCP route included — emits one wide event carrying the
 * same `service`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createLogger } from "@sdxc/logger";

export const logger = createLogger({ service: "blog" });
