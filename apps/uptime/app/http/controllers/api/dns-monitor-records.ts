/**
 * API v1 sub-resource for a DNS monitor's tracked records: list them, and toggle whether a
 * deviation from one alerts. Both leaves ride the existing
 * `dns-monitors:read`/`dns-monitors:write` scopes rather than a pair of their own, because a
 * key that may reconfigure a domain monitor may decide which of its records are watched.
 *
 * Registered as a stub: the routes exist, are typed, and are reachable, and each answers
 * `501 Not Implemented` rather than an empty list — an empty list would tell a caller the
 * monitor tracks nothing, which is a different and false statement.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { NotImplemented } from "@pkg/http/status-code";
import { createController } from "remix/fetch-router";

import requireApiKey from "~/app/http/middleware/require-api-key";
import { apiError } from "~/app/services/api-response";
import routes from "~/routes/web";

/**
 * What every leaf here answers until the records sub-resource is implemented. Named so the
 * two handlers cannot drift into disagreeing about what "not built yet" looks like.
 */
function notImplementedYet(): Response {
	return apiError(
		"NOT_IMPLEMENTED",
		"The DNS monitor records sub-resource is not available yet.",
		NotImplemented,
	);
}

/** Route leaves this controller handles, grouped for a single `router.map()` call. */
export const dnsMonitorRecordsRoutes = {
	dnsMonitorRecordsIndex: routes.api.v1.dnsMonitors.records.index,
	dnsMonitorRecordUpdate: routes.api.v1.dnsMonitors.records.update,
};

export default createController(dnsMonitorRecordsRoutes, {
	actions: {
		/** GET /api/v1/dns-monitors/:dnsMonitorId/records — the monitor's tracked records. */
		dnsMonitorRecordsIndex: {
			middleware: [requireApiKey("dns-monitors:read")],
			handler: () => notImplementedYet(),
		},

		/**
		 * PATCH /api/v1/dns-monitors/:dnsMonitorId/records/:recordId — toggles whether a
		 * deviation from one record alerts. Only `isEnabled` will ever be writable: the
		 * normalized value is the key the diff runs on, so letting a caller edit it would
		 * silently retarget the expectation instead of changing it.
		 */
		dnsMonitorRecordUpdate: {
			middleware: [requireApiKey("dns-monitors:write")],
			handler: () => notImplementedYet(),
		},
	},
});
