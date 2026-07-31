/**
 * The rate card: every unit price the cost ledger prices a measurement with, plus the few
 * quantities the platform exposes no way to measure and this app therefore models
 * (ADR-007 §2). Prices are **cents**, because cents is the unit Polar's Cost Insights
 * takes and converting dollars at the reporting boundary invites a 100× error exactly
 * where it would be hardest to notice.
 *
 * Versioned and never edited in place: {@link RATE_CARD_VERSION} rides on every recorded
 * data point and every reported event, so a cost figure can always be traced back to the
 * prices that produced it, and a Cloudflare price change adds a version rather than
 * retroactively restating history.
 *
 * Every rate is the Workers Paid **overage** rate with no included quota netted off. That
 * answers "what would this customer cost me if I had no free tier", which is the only
 * version of the number that stays true as the platform grows — and it makes the relation
 * to the real invoice computable: `invoice_line = max(0, units − included) × rate`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The rate card this module currently states. Carried on every measurement it prices. */
export const RATE_CARD_VERSION = "2026-07-31";

/**
 * Cents per unit, at Workers Paid overage rates.
 *
 * **The key order is the Analytics Engine `double` order** (see {@link COST_RESOURCES}):
 * recorded data points position quantities by it, so a resource may be appended but never
 * reordered or removed without orphaning every point already written.
 *
 * `emailSent` is priced at Resend's $0.90/1,000 rather than Cloudflare's $0.35/1,000,
 * because Resend is the transport `app/services/alerts.ts` actually sends through. Price
 * what the code does; changing the transport is a new rate card version.
 */
export const RATES = {
	workerRequest: 3.0e-5, // $0.30 / M
	workerCpuMs: 2.0e-6, // $0.02 / M ms
	queueOperation: 4.0e-5, // $0.40 / M
	d1RowRead: 1.0e-7, // $0.001 / M
	d1RowWritten: 1.0e-4, // $1.00 / M
	d1StorageGbDay: 2.5, // $0.75 / GB-month ÷ 30
	kvRead: 5.0e-5, // $0.50 / M
	kvMutation: 5.0e-4, // $5.00 / M — write, delete and list share the rate
	kvStorageGbDay: 1.667, // $0.50 / GB-month ÷ 30
	doRequest: 1.5e-5, // $0.15 / M
	doDurationMs: 1.5625e-7, // $12.50 / M GB-s at the fixed 128 MB allocation
	aeDataPoint: 2.5e-5, // $0.25 / M
	aeQuery: 1.0e-4, // $1.00 / M
	emailSent: 9.0e-2, // $0.90 / 1,000 — Resend, the actual transport
} as const;

/** A resource the ledger can be asked to count. */
export type CostResource = keyof typeof RATES;

/**
 * Every resource, in the order recorded data points position their `double` fields by.
 *
 * Derived from {@link RATES} rather than repeated, so adding a resource is one edit and
 * the writer and the reader can never disagree about which `double` is which. Object key
 * order is insertion order for string keys, which is what makes this stable — so the rule
 * on {@link RATES} is that its literal may be appended to and never reordered.
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
 * Prices quantities against this rate card, in **cents**.
 *
 * The same function prices a ledger flush and re-prices a stored data point at read time,
 * which is the point of storing quantities rather than money: a rate-card correction can
 * be re-applied across the whole retained window.
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
 * Milliseconds of Worker CPU charged per unit of work, by handler class.
 *
 * **Modelled, not measured, and it cannot be otherwise**: the Workers runtime exposes no
 * API for a request's own CPU time, so this is the only quantity on the card that no
 * amount of instrumentation would turn into a measurement. The bands are ADR-002 §9's
 * expected column — a check job at 3 ms, an inbound request at 8 ms (i18next
 * initialisation dominates it), a cron delivery at 1 ms.
 *
 * Reconciliation calibrates them: `workersInvocationsAdaptive` reports a real `cpuTime`,
 * and a monthly comparison against it is what a corrected rate card version is for. CPU
 * is ≤2% of any total, so the residual uncertainty this leaves is bounded.
 */
export const MODELLED_CPU_MS: Record<WorkerHandler, number> = {
	fetch: 8,
	queue: 3,
	scheduled: 1,
};

/**
 * Bytes per gigabyte, as Cloudflare bills storage: decimal, not binary.
 */
export const BYTES_PER_GB = 1_000_000_000;

/**
 * Modelled mean size of one stored `monitor_results` row, in bytes, including the indexes
 * that cover it.
 *
 * Storage is the one D1 figure no per-statement observation reports, so the daily estimate
 * is `rows × this`, prorated by the day it covers. The row is nine small columns and a
 * uuid primary key; the indexes roughly double it.
 */
export const D1_MEAN_ROW_BYTES = 200;

/**
 * Modelled KV storage per team with monitors, in bytes: the handful of dashboard cache
 * entries a team's own page views keep warm, plus its owner's session.
 *
 * Immaterial by two orders of magnitude — a few kilobytes at 1.667 cents per GB-day is
 * around 1e-8 cents a day — and counted anyway so the resource is not silently absent
 * when reconciliation checks the KV namespace's own metrics.
 */
export const KV_MEAN_BYTES_PER_TEAM = 8_192;
