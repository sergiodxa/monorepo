/**
 * The results of an HTTP monitor's checks, one row per check keyed by its job id, which is what
 * lets a redelivered check find its own row. The check job writes them; reads page a monitor's
 * results and the stats cards aggregate them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";

import { createModel } from "@sdxc/data-model";

import { monitorResults } from "~/database/schema";

export const MonitorResults = createModel(monitorResults, {
	scopes: {
		ofMonitor: (query, monitorId: string) => query.where({ monitor_id: monitorId }),
	},
});

/** One HTTP check's result, as reads return it. */
export type MonitorResult = ModelRow<typeof MonitorResults>;

export default MonitorResults;
