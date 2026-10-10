/**
 * The history a flow monitor keeps: one row per run with its test counters and first failure.
 * Rows are written by `flowMonitors.recordCheckResult`, which keeps a run's history and its
 * monitor's cached fields moving together.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";

import { createModel } from "@sdxc/data-model";

import { flowMonitorResults } from "~/database/schema";

/** Most-recent results shown on a monitor's detail page. */
const RESULT_HISTORY_LIMIT = 50;

export const FlowMonitorResults = createModel(flowMonitorResults, {
	scopes: {
		forMonitor: (query, monitorId: string) => query.where({ flow_monitor_id: monitorId }),
	},

	methods: {
		/** A monitor's most recent run results, newest first, capped at what a detail page shows. */
		recent(monitorId: string, limit: number = RESULT_HISTORY_LIMIT) {
			return this.forMonitor(monitorId).orderBy("checked_at", "desc").limit(limit).all();
		},
	},
});

/** A flow run's history row, as reads return it. */
export type FlowMonitorResult = ModelRow<typeof FlowMonitorResults>;

export default FlowMonitorResults;
