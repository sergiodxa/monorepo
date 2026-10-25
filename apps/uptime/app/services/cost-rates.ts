/**
 * The rate card: cents per unit of every resource the cost ledger meters, derived from
 * Cloudflare's list prices in `@sdxc/cloudflare-pricing`, plus the quantities this app
 * models because nothing measures them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RateCardQuantities, RateCardResource } from "@sdxc/cloudflare-pricing";

import { centsPerGbDay, centsPerUnit, defineRateCard } from "@sdxc/cloudflare-pricing";
import * as AnalyticsEngine from "@sdxc/cloudflare-pricing/analytics-engine";
import * as D1 from "@sdxc/cloudflare-pricing/d1";
import * as DurableObjects from "@sdxc/cloudflare-pricing/durable-objects";
import * as EmailService from "@sdxc/cloudflare-pricing/email-service";
import * as KV from "@sdxc/cloudflare-pricing/kv";
import * as Queues from "@sdxc/cloudflare-pricing/queues";
import * as R2 from "@sdxc/cloudflare-pricing/r2";
import * as Workers from "@sdxc/cloudflare-pricing/workers";

/** The rate card this module currently states. Carried on every measurement it prices. */
export const RATE_CARD_VERSION = "2026-10-20";

/**
 * Cents per Browser Run wall-clock second at Workers Paid overage ($0.09/hour ÷ 3600).
 * Appended rather than imported from `@sdxc/cloudflare-pricing` because that package has no
 * Browser Run meter yet; the figure is Cloudflare's published rate.
 */
const BROWSER_SECOND_CENTS = 2.5e-3;

/**
 * The rate card, at Workers Paid overage rates. **Key order is the Analytics Engine `double`
 * order** ({@link COST_RESOURCES}): a resource may be appended but never reordered or removed
 * without orphaning every point already written.
 */
export const COST_RATE_CARD = defineRateCard({
	workerRequest: centsPerUnit(Workers.REQUESTS),
	workerCpuMs: centsPerUnit(Workers.CPU_MS),
	queueOperation: centsPerUnit(Queues.OPERATIONS),
	d1RowRead: centsPerUnit(D1.ROWS_READ),
	d1RowWritten: centsPerUnit(D1.ROWS_WRITTEN),
	d1StorageGbDay: centsPerGbDay(D1.STORAGE),
	kvRead: centsPerUnit(KV.READS),
	/** Write, delete, and list price the same. */
	kvMutation: centsPerUnit(KV.WRITES),
	kvStorageGbDay: centsPerGbDay(KV.STORAGE),
	doRequest: centsPerUnit(DurableObjects.REQUESTS),
	/** One millisecond of one active object, at the 128 MB Cloudflare bills every object for. */
	doDurationMs: DurableObjects.centsPerActiveMs(),
	/** Analytics Engine prices at zero until Cloudflare invoices it, while the ledger keeps counting. */
	aeDataPoint: AnalyticsEngine.billedCentsPerUnit(AnalyticsEngine.DATA_POINTS_WRITTEN),
	aeQuery: AnalyticsEngine.billedCentsPerUnit(AnalyticsEngine.READ_QUERIES),
	emailSent: centsPerUnit(EmailService.EMAILS_SENT),
	doSqliteStorageGbDay: centsPerGbDay(DurableObjects.SQLITE_STORAGE),
	doRowRead: centsPerUnit(DurableObjects.SQLITE_ROWS_READ),
	doRowWritten: centsPerUnit(DurableObjects.SQLITE_ROWS_WRITTEN),
	/** Workers Logs events: the worker enables `observability`, and every invocation writes one. */
	workerLogEvent: centsPerUnit(Workers.LOG_EVENTS_WRITTEN),
	/** Browser Run session time a browser flow opened. */
	browserSecond: BROWSER_SECOND_CENTS,
	/**
	 * R2 Standard Class A — Put/List for flow Performance traces. Appended past
	 * the nineteen resources that fill one Analytics Engine point; the ledger writes them
	 * on a second point tagged `blob4 = "r2"` (see {@link COST_AE_CORE_COUNT}).
	 */
	r2ClassAOperations: centsPerUnit(R2.CLASS_A_OPERATIONS),
	/** R2 Standard Class B — Get/Head for flow Performance-trace downloads. */
	r2ClassBOperations: centsPerUnit(R2.CLASS_B_OPERATIONS),
	/** R2 Standard storage for live flow Performance traces, as GB-days. */
	r2StorageGbDay: centsPerGbDay(R2.STORAGE),
});

/** Cents per unit of every resource the ledger counts. */
export const RATES = COST_RATE_CARD.rates;

/** A resource the ledger can be asked to count. */
export type CostResource = RateCardResource<typeof COST_RATE_CARD>;

/** Every resource, in the order recorded data points position their `double` fields by. */
export const COST_RESOURCES = COST_RATE_CARD.resources;

/**
 * How many leading {@link COST_RESOURCES} fit in one Analytics Engine data point together
 * with the priced total (20 doubles). Resources past this index ride a second point.
 */
export const COST_AE_CORE_COUNT = 19;

/** How many units of each resource one unit of work consumed. */
export type CostQuantities = RateCardQuantities<CostResource>;

/** A fresh, fully-zeroed set of quantities — every resource present, so pricing is a sum. */
export function createCostQuantities(): CostQuantities {
	return COST_RATE_CARD.zero();
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
	return COST_RATE_CARD.price(quantities);
}

/**
 * The Worker handler classes the CPU model is banded by — also the prefix of every
 * recorded `source`, so a data point says which band priced its CPU.
 */
export type WorkerHandler = "fetch" | "queue" | "scheduled";

/**
 * Milliseconds of Worker CPU charged per unit of work, by handler class. Modelled, not
 * measured, since the runtime exposes no API for a request's own CPU time: the bands are
 * the hand-derived expected cost per handler, calibrated monthly against the real `cpuTime` Cloudflare reports.
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
