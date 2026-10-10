/**
 * The history a TCP monitor keeps: one row per check with its status and connect latency.
 * Rows are written by `tcpMonitors.recordCheckResult`, which keeps a check's history and its
 * monitor's cached fields moving together.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";

import { createModel } from "@sdxc/data-model";

import { tcpMonitorResults } from "~/database/schema";

/** Most-recent results shown on a monitor's detail page. */
const RESULT_HISTORY_LIMIT = 50;

export const TcpMonitorResults = createModel(tcpMonitorResults, {
	scopes: {
		forMonitor: (query, monitorId: string) => query.where({ tcp_monitor_id: monitorId }),
	},

	methods: {
		/** A monitor's most recent check results, newest first, capped at what a detail page shows. */
		recent(monitorId: string, limit: number = RESULT_HISTORY_LIMIT) {
			return this.forMonitor(monitorId).orderBy("checked_at", "desc").limit(limit).all();
		},
	},
});

/** A TCP check's history row, as reads return it. */
export type TcpMonitorResult = ModelRow<typeof TcpMonitorResults>;

export default TcpMonitorResults;
