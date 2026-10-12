/**
 * The worker's one logging configuration. Every log the dashboard router, the tenant
 * Durable Object, and the cron handler open carries this `service`, so a query across
 * workers can group this deployment's records under one name.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createLogger } from "@sdxc/logger";

export const logger = createLogger({ service: "auth-saas" });
