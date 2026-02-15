import { env } from "cloudflare:workers";

import { queryAnalytics } from "~/services/analytics.server";

interface CountResult {
	count: number;
}

export async function loader() {
	let hasBinding = typeof env.PING_RESULTS?.writeDataPoint === "function";
	if (!hasBinding) {
		return Response.json(
			{
				status: "error",
				message: "Analytics Engine binding (PING_RESULTS) not configured",
			},
			{ status: 503 },
		);
	}

	try {
		let result = await queryAnalytics<CountResult>(
			"SELECT count() as count FROM uptime_monitor_results LIMIT 1",
		);
		let eventCount = result[0]?.count ?? 0;

		return Response.json(
			{
				status: "ok",
				binding: true,
				apiConnected: true,
				eventCount,
				message: `Analytics Engine connected, ${eventCount} events recorded`,
			},
			{ status: 200 },
		);
	} catch (error) {
		let message = error instanceof Error ? error.message : "Unknown error occurred";

		return Response.json(
			{
				status: "degraded",
				binding: true,
				apiConnected: false,
				eventCount: null,
				message: `Write binding available, but read API failed: ${message}`,
			},
			{ status: 200 },
		);
	}
}
