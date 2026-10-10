/**
 * The history a DNS monitor keeps: one row per check, carrying the per-record counters and the
 * slowest query's latency. Rows are written by `dnsMonitors.recordCheckResult`, which keeps a
 * check's history and its monitor's cached fields moving together.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";

import { createModel } from "@sdxc/data-model";

import { dnsMonitorResults } from "~/database/schema";

/** Most-recent results shown on a monitor's detail page. */
const RESULT_HISTORY_LIMIT = 50;

export const DnsMonitorResults = createModel(dnsMonitorResults, {
	scopes: {
		forMonitor: (query, monitorId: string) => query.where({ dns_monitor_id: monitorId }),
	},

	methods: {
		/** A monitor's most recent check results, newest first, capped at what a detail page shows. */
		recent(monitorId: string, limit: number = RESULT_HISTORY_LIMIT) {
			return this.forMonitor(monitorId).orderBy("checked_at", "desc").limit(limit).all();
		},
	},
});

/** A DNS check's history row, as reads return it. */
export type DnsMonitorResult = ModelRow<typeof DnsMonitorResults>;

export default DnsMonitorResults;
