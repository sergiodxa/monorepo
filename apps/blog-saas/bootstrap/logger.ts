/**
 * The worker's logging configuration, stated once and attached at the two places every
 * invocation passes through — the dashboard router and the job dispatcher — and opened
 * directly by the tenant Durable Object, so each log names the same service.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { createLogger } from "@sdxc/logger";

export const logger = createLogger({ service: "blog-saas" });
