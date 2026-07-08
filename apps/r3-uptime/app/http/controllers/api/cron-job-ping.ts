/**
 * Public cron-job ping endpoint: `POST /api/v1/cron-jobs/:cronJobId/ping`. Unlike the
 * rest of the app, this route is intentionally unauthenticated — a scheduled job's
 * `curl` call is the entire integration, per `docs/cron-job-monitoring.md` ("the
 * system provides a unique ping endpoint"). The monitor's own id is the ping-URL
 * identifier; treat it as a bearer secret. Rate-limited to one ping per minute per
 * monitor.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { conflict, created, notFound, tooManyRequests } from "@pkg/http/response/json";
import { getServiceContainer } from "@pkg/service-container";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import CronJobMonitor from "~/app/data/cron-job";
import routes from "~/routes/web";

/** Minimum time between accepted pings for a single monitor. */
const RATE_LIMIT_MS = 60_000;

/** POST /api/v1/cron-jobs/:cronJobId/ping */
export default createAction(routes.api.cronJobPing, async (ctx) => {
	let db = getServiceContainer().get(Database);

	let { cronJobId } = s.parse(s.object({ cronJobId: s.string() }), ctx.params);
	let monitor = await CronJobMonitor.findById(db, cronJobId);
	if (!monitor) return notFound({ error: "Not Found" });

	if (monitor.enabled_at === null) return conflict({ error: "Cron job is disabled" });

	if (monitor.last_ping_at !== null && Date.now() - monitor.last_ping_at < RATE_LIMIT_MS) {
		return tooManyRequests({ error: "Rate limit exceeded. Max 1 ping per minute." });
	}

	let deadline =
		monitor.next_expected_at === null
			? null
			: monitor.next_expected_at + monitor.grace_period_seconds * 1000;
	let wasOnTime = deadline === null || Date.now() <= deadline;

	await CronJobMonitor.recordPing(db, monitor, wasOnTime, {
		sourceIp:
			ctx.request.headers.get("CF-Connecting-IP") ?? ctx.request.headers.get("X-Forwarded-For"),
		userAgent: ctx.request.headers.get("User-Agent"),
	});

	return created({ wasOnTime });
});
