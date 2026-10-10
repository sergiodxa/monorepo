/**
 * Uptime's models, bound per request and per job as `ctx.models`. Each entry imports its
 * module on first use, so an invocation evaluates only the models it touches, the way routes
 * load only the controllers a request reaches.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BoundRegistry } from "@sdxc/data-model";

import { createModels } from "@sdxc/data-model";

import { ACCOUNT_MODELS } from "./entries/accounts";
import { ALERT_MODELS } from "./entries/alerts";
import { CHECK_MODELS } from "./entries/checks";
import { GROWTH_MODELS } from "./entries/growth";
import { MONITOR_MODELS } from "./entries/monitors";

export const models = createModels({
	...ACCOUNT_MODELS,
	...MONITOR_MODELS,
	...CHECK_MODELS,
	...ALERT_MODELS,
	...GROWTH_MODELS,
});

/** The registry bound to one request or job, for code handed `ctx.models`. */
export type UptimeModels = BoundRegistry<typeof models>;
