/**
 * Placeholder for the Cloudflare Workflow that will run a single HTTP monitor check
 * end to end (fetch, content checks, alerts, analytics, usage ingestion — see Phase 2
 * of ADR-001). It exists now, ahead of that phase, only so the `PING` Workflow binding
 * declared in `wrangler.jsonc` has a matching named entrypoint the Workers runtime can
 * boot against; every instance currently fails immediately.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";

import { WorkflowEntrypoint } from "cloudflare:workers";

export namespace Ping {
	export interface WorkflowParams {
		monitorId: string;
	}
}

export class Ping extends WorkflowEntrypoint<Cloudflare.Env> {
	override async run(event: WorkflowEvent<Ping.WorkflowParams>, _step: WorkflowStep) {
		throw new Error(`Ping workflow is not implemented yet (monitorId: ${event.payload.monitorId})`);
	}
}
