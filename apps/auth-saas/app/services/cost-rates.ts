/**
 * The rate card: what a unit of platform consumption costs, in cents, and the pure
 * function that turns a set of measured quantities into a priced total. Prices live in
 * cents per unit — real per-unit infrastructure cost sits far below a cent, and converting
 * to dollars at the point of measurement is a 100x error that is easy to make and hard to
 * notice later — so every quantity this module prices stays in cents until a caller
 * further up chooses to render dollars.
 *
 * Every rate here prices consumption as though the account carried no included free
 * allowance, which keeps `line = max(0, units) × rate` correct as the platform's own
 * included allowances change: a future allowance subtracts from `units` before it ever
 * reaches this module, rather than living in the rate itself.
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

/**
 * The dated rate-card version every measurement is stamped with. A price correction adds
 * a new version rather than rewriting one already recorded, so a period spanning both
 * versions prices each group of measurements under the card that applied to it.
 */
export const RATE_CARD_VERSION = "2026-09-28";

/**
 * Cents per unit for every metered resource, at Workers Paid overage prices. **Key order is the
 * order stored measurements position quantities by**: append new resources, never reorder or
 * prune. The retired `d1Rows`, split into reads and writes, holds its position priced at zero.
 */
export const COST_RATE_CARD = defineRateCard({
	workerRequests: centsPerUnit(Workers.REQUESTS),
	workerCpuMs: centsPerUnit(Workers.CPU_MS),
	doRequests: centsPerUnit(DurableObjects.REQUESTS),
	doDurationMs: DurableObjects.centsPerActiveMs(),
	doRowsRead: centsPerUnit(DurableObjects.SQLITE_ROWS_READ),
	doRowsWritten: centsPerUnit(DurableObjects.SQLITE_ROWS_WRITTEN),
	doStorageGbDays: centsPerGbDay(DurableObjects.SQLITE_STORAGE),
	d1Rows: 0,
	d1StorageGbDays: centsPerGbDay(D1.STORAGE),
	kvReads: centsPerUnit(KV.READS),
	kvMutations: centsPerUnit(KV.WRITES),
	kvStorageGbDays: centsPerGbDay(KV.STORAGE),
	analyticsPoints: AnalyticsEngine.billedCentsPerUnit(AnalyticsEngine.DATA_POINTS_WRITTEN),
	analyticsQueries: AnalyticsEngine.billedCentsPerUnit(AnalyticsEngine.READ_QUERIES),
	queueOperations: centsPerUnit(Queues.OPERATIONS),
	emailSent: centsPerUnit(EmailService.EMAILS_SENT),
	d1RowsRead: centsPerUnit(D1.ROWS_READ),
	d1RowsWritten: centsPerUnit(D1.ROWS_WRITTEN),
	r2ClassAOperations: centsPerUnit(R2.CLASS_A_OPERATIONS),
	r2ClassBOperations: centsPerUnit(R2.CLASS_B_OPERATIONS),
	workerLogEvents: centsPerUnit(Workers.LOG_EVENTS_WRITTEN),
});

/** Every resource, in the order recorded measurements position their quantities by. */
export const COST_RESOURCES = COST_RATE_CARD.resources;

/** One resource this rate card prices. */
export type CostResource = RateCardResource<typeof COST_RATE_CARD>;

/** How much of each resource a unit of work consumed. */
export type CostQuantities = RateCardQuantities<CostResource>;

/** Cents per unit of every resource. Analytics Engine prices at zero until it is invoiced. */
export const RATES = COST_RATE_CARD.rates;

/**
 * A zeroed set of quantities, one field per {@link COST_RESOURCES} entry, so accumulating
 * consumption is a plain sum against a value that already has every field a caller might
 * add to.
 *
 * @example
 * let quantities = createCostQuantities();
 * quantities.doRowsWritten += 1;
 */
export function createCostQuantities(): CostQuantities {
	return COST_RATE_CARD.zero();
}

/**
 * Prices a set of quantities against {@link RATES}, resource by resource. A quantity
 * missing from `quantities` prices at zero, and a negative one prices at zero rather than
 * crediting the total, keeping `max(0, units) × rate` true for every line.
 *
 * @param quantities - However much of each resource was consumed; a partial set is fine.
 * @returns The whole total, in cents, summed across every resource.
 * @example priceCostQuantities({ doRowsWritten: 3, workerRequests: 1 });
 */
export function priceCostQuantities(quantities: Partial<CostQuantities>): number {
	return COST_RATE_CARD.price(quantities);
}

/**
 * Modelled Worker CPU milliseconds per invocation, by handler class. No API lets a
 * request read its own CPU time, so this is calibrated by hand against the CPU figure
 * the infrastructure bill reports each month, rather than measured per call.
 */
export const MODELLED_CPU_MS_PER_HANDLER: Record<"fetch" | "queue" | "scheduled", number> = {
	fetch: 8,
	queue: 8,
	scheduled: 8,
};

/**
 * Modelled Workers Logs events per invocation, by handler class: the invocation log
 * Cloudflare writes for every invocation once `observability` is enabled, plus the one
 * wide event the invocation's own logger emits. Calibrated against the log-event count
 * the infrastructure bill reports, the same way the modelled CPU is.
 */
export const MODELLED_LOG_EVENTS_PER_HANDLER: Record<"fetch" | "queue" | "scheduled", number> = {
	fetch: 2,
	queue: 2,
	scheduled: 2,
};

/**
 * Modelled mean row size in bytes, including indexes, for the tables the daily storage
 * sweep prices. No per-tenant storage figure exists to read — Durable Object storage is
 * billed per database, not per row — so a tenant's footprint is estimated from its own
 * row counts and these means rather than measured directly.
 */
export const MODELLED_MEAN_ROW_BYTES = {
	directory: 500,
	audit: 200,
};
