/**
 * The overview's metrics: the four numbers its tabs show and the series its chart draws for
 * each, current and previous period, with the incident and the collector outage marked where
 * they fall, so the range picker and the tabs answer from one model.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The metrics the overview's tabs switch between. */
export type MetricId = "uptime" | "latency" | "errors" | "incidents";

/** The ranges the overview's picker offers. */
export type RangeId = "24h" | "7d" | "30d" | "90d";

/** Every metric, in tab order; the first is the default. */
export const METRIC_IDS: readonly MetricId[] = ["uptime", "latency", "errors", "incidents"];

/** Every range, in picker order. */
export const RANGE_IDS: readonly RangeId[] = ["24h", "7d", "30d", "90d"];

/** The range the overview opens on. */
export const DEFAULT_RANGE: RangeId = "24h";

/** How many buckets each range draws, and how long one bucket is in hours. */
export const RANGE_BUCKETS: Record<RangeId, { count: number; hours: number }> = {
	"24h": { count: 24, hours: 1 },
	"7d": { count: 28, hours: 6 },
	"30d": { count: 30, hours: 24 },
	"90d": { count: 45, hours: 48 },
};

/** One metric's numbers for the stat tab: the value, its change and whether up is good. */
export interface MetricSummary {
	value: number;
	change: number;
	trend: "up" | "down" | "flat";
	/** A rise is bad news, so the delta draws red when it goes up. */
	invert: boolean;
}

/** The headline figure of each metric over the selected range. */
export const SUMMARIES: Record<MetricId, MetricSummary> = {
	uptime: { value: 0.9982, change: -0.0011, trend: "down", invert: false },
	latency: { value: 212, change: 38, trend: "up", invert: true },
	errors: { value: 0.0042, change: 0.0031, trend: "up", invert: true },
	incidents: { value: 3, change: 2, trend: "up", invert: true },
};

/** What one chart draws: the period's values, the previous period's, and the marked spans. */
export interface MetricSeries {
	/** `null` where the collector recorded nothing. */
	current: (number | null)[];
	previous: number[];
	/** The bucket range the open incident covers. */
	incident: readonly [number, number];
	/** The bucket range no data arrived for. */
	gap: readonly [number, number];
	/** The value axis, from zero or a floor up to a ceiling that clears every value. */
	domain: readonly [number, number];
}

/** A small deterministic wobble, so the series look measured without a random source. */
function wobble(index: number, seed: number): number {
	return Math.sin(index * 1.7 + seed) * 0.6 + Math.sin(index * 0.45 + seed * 2) * 0.4;
}

/** The value one metric reads in a calm bucket, and how far it wanders. */
const BASELINES: Record<MetricId, { base: number; spread: number; peak: number }> = {
	uptime: { base: 99.97, spread: 0.02, peak: 97.8 },
	latency: { base: 180, spread: 16, peak: 860 },
	errors: { base: 0.18, spread: 0.06, peak: 4.1 },
	incidents: { base: 0.6, spread: 0.6, peak: 3 },
};

/** The value axis each metric draws on. */
const DOMAINS: Record<MetricId, readonly [number, number]> = {
	uptime: [97, 100],
	latency: [0, 1000],
	errors: [0, 5],
	incidents: [0, 4],
};

/**
 * Builds a metric's series over a range: calm buckets that wobble around the baseline, the
 * open incident rising to its peak over the last few buckets, and a stretch two thirds of
 * the way back where the collector was down.
 *
 * @param metric The metric the selected tab names.
 * @param range The range the picker names.
 * @returns The current and previous series with the spans to mark.
 */
export function metricSeries(metric: MetricId, range: RangeId): MetricSeries {
	let { count } = RANGE_BUCKETS[range];
	let { base, spread, peak } = BASELINES[metric];
	let incident = [count - 4, count - 1] as const;
	let gapStart = Math.round(count * 0.3);
	let gap = [gapStart, gapStart + Math.max(1, Math.round(count * 0.08))] as const;
	let round = (value: number) =>
		metric === "incidents" ? Math.max(0, Math.round(value)) : Number(value.toFixed(2));

	let current: (number | null)[] = [];
	let previous: number[] = [];
	for (let index = 0; index < count; index++) {
		let calm = base + wobble(index, 1) * spread;
		let rise =
			index >= incident[0] ? (index - incident[0] + 1) / (incident[1] - incident[0] + 1) : 0;
		let value = calm + (peak - calm) * rise;
		current.push(index >= gap[0] && index <= gap[1] ? null : round(value));
		previous.push(round(base + wobble(index, 4) * spread * 0.8));
	}

	return { current, previous, incident, gap, domain: DOMAINS[metric] };
}

/**
 * A sparkline's value axis from zero to half again its peak, so a steady service draws a calm
 * line and a spike reads as one; a series with no values gets a unit axis.
 */
export function sparklineDomain(values: readonly (number | null)[]): [number, number] {
	let peak = Math.max(0, ...values.map((value) => value ?? 0));
	return [0, peak === 0 ? 1 : peak * 1.5];
}
