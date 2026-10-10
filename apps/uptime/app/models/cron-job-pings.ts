/**
 * The pings a cron-job monitor received, one row per accepted request to its ping URL. Rows
 * are written by `cronJobMonitors.recordPing`, which moves the monitor's status with them, and
 * the daily retention sweep removes those older than {@link PING_RETENTION_DAYS}.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";

import { createModel } from "@sdxc/data-model";

import { cronJobPings } from "~/database/schema";

/** Most-recent pings shown on a monitor's detail page. */
const PING_HISTORY_LIMIT = 50;

/** Ping-history retention window, per `docs/cron-job-monitoring.md`. */
export const PING_RETENTION_DAYS = 365;

export const CronJobPings = createModel(cronJobPings, {
	scopes: {
		forMonitor: (query, monitorId: string) => query.where({ cron_job_monitor_id: monitorId }),
	},

	methods: {
		/** A monitor's most recent pings, newest first, capped at what a detail page shows. */
		recent(monitorId: string) {
			return this.forMonitor(monitorId)
				.orderBy("created_at", "desc")
				.limit(PING_HISTORY_LIMIT)
				.all();
		},
	},
});

/** A received ping, as reads return it. */
export type CronJobPing = ModelRow<typeof CronJobPings>;

export default CronJobPings;
