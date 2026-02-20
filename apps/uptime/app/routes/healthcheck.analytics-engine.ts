import { ok, serviceUnavailable } from "@pkg/http/response/json";
import { isFailure } from "@pkg/result";
import { env } from "cloudflare:workers";

import { queryAnalytics } from "~/services/analytics.server";

interface CountResult {
	count: number;
}

export async function loader() {
	let hasBinding = typeof env.PING_RESULTS?.writeDataPoint === "function";
	if (!hasBinding) {
		return serviceUnavailable({
			status: "error",
			message: "Analytics Engine binding (PING_RESULTS) not configured",
		});
	}

	let result = await queryAnalytics<CountResult>(
		"SELECT count() as count FROM uptime_monitor_results LIMIT 1",
	);

	if (isFailure(result)) {
		return ok({
			status: "degraded",
			binding: true,
			apiConnected: false,
			eventCount: null,
			message: `Write binding available, but read API failed: ${result.error.message}`,
		});
	}

	let eventCount = result.data[0]?.count ?? 0;

	return ok({
		status: "ok",
		binding: true,
		apiConnected: true,
		eventCount,
		message: `Analytics Engine connected, ${eventCount} events recorded`,
	});
}
