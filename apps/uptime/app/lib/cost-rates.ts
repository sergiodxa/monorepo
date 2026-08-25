/**
 * The rate card: unit prices the cost ledger meters against, plus the handful of
 * quantities the platform exposes no way to measure and this app models instead
 * (ADR-007 §2). Prices are in **cents** — Polar's Cost Insights takes cents, and
 * converting dollars at the reporting boundary invites a 100× error easy to miss.
 * {@link RATE_CARD_VERSION} tags every recorded point and event, so a price change
 * adds a new version instead of rewriting history. Every rate prices usage as if
 * the customer had no free tier, which stays true as the platform grows and keeps
 * `invoice_line = max(0, units − included) × rate` computable.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The rate card this module currently states. Carried on every measurement it prices. */
export const RATE_CARD_VERSION = "2026-08-02";

/**
 * Cents per unit, at Workers Paid overage rates. **Key order is the Analytics Engine
 * `double` order** ({@link COST_RESOURCES}): a resource may be appended but never
 * reordered or removed without orphaning every point already written.
 */
export const RATES = {
	workerRequest: 3.0e-5,
	workerCpuMs: 2.0e-6,
	queueOperation: 4.0e-5,
	d1RowRead: 1.0e-7,
	d1RowWritten: 1.0e-4,
	/** $0.75 per GB-month, amortized to a day. */
	d1StorageGbDay: 2.5,
	kvRead: 5.0e-5,
	/** $5.00 per million; write, delete, and list price the same. */
	kvMutation: 5.0e-4,
	/** $0.50 per GB-month, amortized to a day. */
	kvStorageGbDay: 1.667,
	doRequest: 1.5e-5,
	/** $12.50 per million GB-seconds, at the fixed 128 MB allocation. */
	doDurationMs: 1.5625e-7,
	aeDataPoint: 2.5e-5,
	aeQuery: 1.0e-4,
	/** $0.35 per 1,000, beyond the 3,000 messages Workers Paid includes monthly. */
	emailSent: 3.5e-2,
} as const;

/** A resource the ledger can be asked to count. */
export type CostResource = keyof typeof RATES;

/**
 * Every resource, in the order recorded data points position their `double` fields by.
 * Derived from {@link RATES} rather than repeated, so adding a resource is one edit,
 * and object key order for string keys keeps this list stable across reads.
 */
export const COST_RESOURCES: readonly CostResource[] = Object.keys(RATES) as CostResource[];

/** How many units of each resource one unit of work consumed. */
export type CostQuantities = Record<CostResource, number>;

/** A fresh, fully-zeroed set of quantities — every resource present, so pricing is a sum. */
export function createCostQuantities(): CostQuantities {
	let quantities = {} as CostQuantities;
	for (let resource of COST_RESOURCES) quantities[resource] = 0;
	return quantities;
}

/**
 * Prices quantities against this rate card, in **cents**. Storing quantities rather
 * than money means the same function prices a ledger flush and re-prices a stored
 * point at read time, so a rate-card correction can be re-applied retroactively.
 *
 * @param quantities - Units consumed, from {@link createCostQuantities}.
 * @returns The total cost in cents.
 */
export function priceCostQuantities(quantities: CostQuantities): number {
	let cents = 0;
	for (let resource of COST_RESOURCES) cents += quantities[resource] * RATES[resource];
	return cents;
}

/**
 * The Worker handler classes the CPU model is banded by — also the prefix of every
 * recorded `source`, so a data point says which band priced its CPU.
 */
export type WorkerHandler = "fetch" | "queue" | "scheduled";

/**
 * Milliseconds of Worker CPU charged per unit of work, by handler class. Modelled, not
 * measured, since the runtime exposes no API for a request's own CPU time: the bands are
 * ADR-002 §9's expected column, calibrated monthly against the real `cpuTime` Cloudflare reports.
 */
export const MODELLED_CPU_MS: Record<WorkerHandler, number> = {
	fetch: 8,
	queue: 3,
	scheduled: 1,
};

/** Bytes per gigabyte, decimal (10^9) — the convention Cloudflare bills storage by. */
export const BYTES_PER_GB = 1_000_000_000;

/**
 * Modelled mean size of one stored `monitor_results` row, in bytes, including the
 * indexes that roughly double it. Storage is the one D1 figure no per-statement
 * observation reports, so the daily estimate is `rows × this`, prorated by the day.
 */
export const D1_MEAN_ROW_BYTES = 200;

/**
 * Modelled KV storage per team with monitors, in bytes: the handful of dashboard
 * cache entries a team's page views keep warm, plus its owner's session. Immaterial
 * by two orders of magnitude, yet counted so reconciliation finds it present in the KV namespace's own metrics.
 */
export const KV_MEAN_BYTES_PER_TEAM = 8_192;
