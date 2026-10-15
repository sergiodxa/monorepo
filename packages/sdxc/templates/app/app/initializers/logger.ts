/**
 * The logger every request and job writes through. The router and the job dispatcher both
 * attach it, so their records carry the same `service` and one query finds both halves of
 * the work a request started.
 */

import { createLogger } from "sdxc/logger";

/** The Worker's one logger; read the invocation's log through `ctx.log`. */
export const logger = createLogger({ service: "worker" });
