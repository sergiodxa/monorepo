/**
 * Samples HTTP latency against a URL with bounded concurrency and reports
 * percentiles, so a CLI or script can hold a running app to a response budget.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

/** One timed request against the target. */
export interface HttpSample {
	/** Wall time from dispatch to response headers/body settle, in milliseconds. */
	ms: number;
	/** HTTP status, or `null` when the request failed before a response. */
	status: number | null;
	/** Error message when the request failed. */
	error: string | null;
}

/** Aggregated latency from a run of {@link sampleHttp}. */
export interface HttpReport {
	url: string;
	method: string;
	/** How many requests the run issued (`SampleHttpOptions.requests`). */
	requests: number;
	concurrency: number;
	/** How many of those requests completed without a transport or abort error. */
	ok: number;
	/** How many requests failed (`requests - ok`); assert `0` when every sample must succeed. */
	failures: number;
	/** Successful samples' latencies, sorted ascending. */
	samples: number[];
	min: number | null;
	mean: number | null;
	p50: number | null;
	p95: number | null;
	p99: number | null;
	max: number | null;
}

/** Options for {@link sampleHttp}. */
export interface SampleHttpOptions {
	url: string;
	method?: string;
	requests: number;
	concurrency: number;
	/** Per-request abort after this many milliseconds. */
	timeoutMs: number;
	headers?: HeadersInit;
}

/** Why an HTTP budget check failed. */
export class HttpBudgetError extends Error {
	readonly report: HttpReport;
	readonly field: "p50" | "p95" | "p99" | "mean";
	readonly limitMs: number;
	readonly actualMs: number;

	/**
	 * @param report - Full sample report.
	 * @param field - Which percentile or mean missed.
	 * @param limitMs - Declared budget in milliseconds.
	 * @param actualMs - Observed value in milliseconds.
	 */
	constructor(
		report: HttpReport,
		field: "p50" | "p95" | "p99" | "mean",
		limitMs: number,
		actualMs: number,
	) {
		super(`${field} ${actualMs.toFixed(1)}ms exceeds budget ${limitMs}ms`);
		this.name = "HttpBudgetError";
		this.report = report;
		this.field = field;
		this.limitMs = limitMs;
		this.actualMs = actualMs;
	}
}

/** Percentile / mean ceilings in milliseconds. */
export interface HttpBudgets {
	p50?: number;
	p95?: number;
	p99?: number;
	mean?: number;
}

/**
 * Issues `requests` GETs (or another method) with at most `concurrency` in
 * flight, timing each with `performance.now()`.
 *
 * @param options - URL, counts and per-request timeout.
 */
export async function sampleHttp(options: SampleHttpOptions): Promise<HttpReport> {
	let method = options.method ?? "GET";
	let samples: HttpSample[] = [];
	let next = 0;

	async function worker() {
		while (next < options.requests) {
			let index = next;
			next += 1;
			samples[index] = await oneRequest(options.url, method, options.timeoutMs, options.headers);
		}
	}

	let workers = Array.from({ length: Math.min(options.concurrency, options.requests) }, () =>
		worker(),
	);
	await Promise.all(workers);

	return summarize(options.url, method, options.requests, options.concurrency, samples);
}

/**
 * Holds a report to optional percentile / mean ceilings.
 *
 * @param report - Sample report.
 * @param budgets - Ceilings in milliseconds; omitted fields are unchecked.
 */
export function assertHttpBudgets(
	report: HttpReport,
	budgets: HttpBudgets,
): Result<HttpReport, HttpBudgetError> {
	for (let field of ["mean", "p50", "p95", "p99"] as const) {
		let limit = budgets[field];
		if (limit === undefined) continue;
		let actual = report[field];
		if (actual === null || actual > limit) {
			return failure(new HttpBudgetError(report, field, limit, actual ?? Number.POSITIVE_INFINITY));
		}
	}
	return success(report);
}

/** Percentile of a sorted ascending list; `null` when empty. */
export function percentile(sorted: readonly number[], p: number): number | null {
	if (sorted.length === 0) return null;
	if (sorted.length === 1) return sorted[0] ?? null;
	let rank = (p / 100) * (sorted.length - 1);
	let lower = Math.floor(rank);
	let upper = Math.ceil(rank);
	let low = sorted[lower] ?? 0;
	let high = sorted[upper] ?? low;
	if (lower === upper) return low;
	return low + (high - low) * (rank - lower);
}

async function oneRequest(
	url: string,
	method: string,
	timeoutMs: number,
	headers?: HeadersInit,
): Promise<HttpSample> {
	let controller = new AbortController();
	let timer = setTimeout(() => controller.abort(), timeoutMs);
	let started = performance.now();
	try {
		let response = await fetch(url, { method, headers, signal: controller.signal });
		await response.arrayBuffer();
		return {
			ms: performance.now() - started,
			status: response.status,
			error: null,
		};
	} catch (cause) {
		return {
			ms: performance.now() - started,
			status: null,
			error: cause instanceof Error ? cause.message : String(cause),
		};
	} finally {
		clearTimeout(timer);
	}
}

function summarize(
	url: string,
	method: string,
	requests: number,
	concurrency: number,
	samples: HttpSample[],
): HttpReport {
	let okSamples = samples.filter((sample) => sample.error === null).map((sample) => sample.ms);
	let sorted = [...okSamples].sort((a, b) => a - b);
	let mean =
		sorted.length === 0 ? null : sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
	return {
		url,
		method,
		requests,
		concurrency,
		ok: sorted.length,
		failures: samples.length - sorted.length,
		samples: sorted,
		min: sorted[0] ?? null,
		mean,
		p50: percentile(sorted, 50),
		p95: percentile(sorted, 95),
		p99: percentile(sorted, 99),
		max: sorted.length === 0 ? null : (sorted[sorted.length - 1] ?? null),
	};
}
