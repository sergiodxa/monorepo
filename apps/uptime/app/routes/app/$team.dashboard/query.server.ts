import type { TFunction } from "i18next";

import { isBefore, subDays } from "date-fns";

import type { Database } from "~/db/index";

export async function getDashboardDataByTeamId(args: {
	db: Database;
	teamId: string;
	locale: string;
	timeZone?: string;
	t: TFunction<"translation", "page.dashboard.table">;
}) {
	// Fetch all monitors and their results from the last day
	let monitors = await args.db.query.monitors.findMany({
		columns: {
			id: true,
			name: true,
			expectedStatus: true,
			degradedAfterMs: true,
		},
		where(fields, operators) {
			return operators.eq(fields.teamId, args.teamId);
		},
		with: {
			results: {
				columns: {
					responseTimeMs: true,
					responseStatus: true,
					completedAt: true,
				},
				where(fields, operators) {
					return operators.and(
						operators.isNotNull(fields.completedAt),
						operators.gte(fields.completedAt, subDays(new Date(), 1)),
					);
				},
			},
		},
	});

	// Infer information from the obtained data
	let monitorsCount = monitors.length;

	let allResults = monitors.flatMap((m) =>
		m.results.map((r) => ({
			...r,
			monitorId: m.id,
			expectedStatus: m.expectedStatus,
			degradedAfterMs: m.degradedAfterMs,
		})),
	);

	// Uptime
	let totalChecks = allResults.length;
	let upChecks = allResults.filter((r) => r.responseStatus === r.expectedStatus).length;
	let uptime = totalChecks > 0 ? upChecks / totalChecks : 1;

	// Slowest endpoint
	let slowestResult = allResults
		.filter((r) => r.completedAt)
		.sort((a, b) => (b.responseTimeMs ?? 0) - (a.responseTimeMs ?? 0))[0];
	let slowestEndpoint = slowestResult
		? {
				responseTimeMs: slowestResult.responseTimeMs,
				monitorName: monitors.find((m) => m.id === slowestResult.monitorId)?.name ?? null,
			}
		: null;

	// Monitors with aggregated data
	let monitorsWithData = monitors.map((m) => {
		let lastResult =
			m.results
				.filter((r) => Boolean(r.completedAt))
				.sort((a, b) => {
					if (!a.completedAt && !b.completedAt) return 0;
					if (!a.completedAt) return 1;
					if (!b.completedAt) return -1;
					return isBefore(a.completedAt, b.completedAt) ? 1 : -1;
				})[0] ?? null;

		let responseTime = lastResult?.responseTimeMs ?? null;
		let avgResponseTime =
			m.results
				.map((r) => r.responseTimeMs)
				.filter(Boolean)
				.reduce((sum, n) => sum + n, 0) / (m.results.length || 1);

		let status = lastResult
			? lastResult.responseStatus !== m.expectedStatus
				? ("down" as const)
				: (responseTime ?? 0) >= m.degradedAfterMs
					? ("degraded" as const)
					: ("up" as const)
			: ("unknown" as const);

		let lastIncident = m.results
			.filter((r) => r.responseStatus !== m.expectedStatus)
			.map((r) => r.completedAt)
			.filter(Boolean)
			.sort((a, b) => (isBefore(a, b) ? 1 : -1))[0];

		let latency = downsample(m.results.map((r) => r.responseTimeMs).filter(Boolean), 100).map(
			(latency) => ({ latency }),
		);

		return {
			id: m.id,
			name: m.name,
			status,
			latency,
			lastIncident: lastIncident
				? lastIncident.toLocaleString(args.locale, {
						timeStyle: "short",
						dateStyle: "short",
						timeZone: args.timeZone ?? "UTC",
					})
				: null,
			responseTime: args.t("responseTime", {
				value: avgResponseTime.toLocaleString(args.locale, {
					style: "unit",
					unit: "millisecond",
					minimumFractionDigits: 0,
					maximumFractionDigits: 0,
				}),
			}),
		};
	});

	return {
		monitorsCount,
		uptime,
		slowestEndpoint,
		monitors: monitorsWithData,
	};
}

function downsample(sample: number[], maxPoints = 20) {
	if (sample.length === 0) {
		return Array.from({ length: maxPoints }).fill(0);
	}

	if (sample.length === 1) {
		return Array.from({ length: maxPoints }).fill(sample[0] ?? 0);
	}

	if (sample.length <= maxPoints) return sample;

	let result: number[] = [];
	let step = sample.length / maxPoints;

	for (let i = 0; i < maxPoints; i++) {
		let start = Math.floor(i * step);
		let end = Math.floor((i + 1) * step);
		let chunk = sample.slice(start, end);
		let avg = chunk.reduce((sum, n) => sum + n, 0) / (chunk.length || 1);
		result.push(avg);
	}

	return result;
}
