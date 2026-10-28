/**
 * Dependency health for this Worker: it has no storage, so the report only
 * stamps the deploy id and confirms the process answered.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { HealthCheck } from "@sdxc/health";
import { env } from "cloudflare:workers";

import type { AppContext } from "~/app/initializers/router";

/** Report answered at `GET /health`; no probes yet — this Worker holds no storage. */
export const health = new HealthCheck<AppContext>({
	serviceId: "apis",
	description: "Package-backed micro-APIs charged with x402",
	releaseId: env.CF_VERSION_METADATA.id,
});
