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

/**
 * The dated rate-card version every measurement is stamped with. A price correction adds
 * a new version rather than rewriting one already recorded, so a period spanning both
 * versions prices each group of measurements under the card that applied to it.
 */
export const RATE_CARD_VERSION = "2026-09-20";

/**
 * The resource order every recorded measurement positions its fields by. Appended to as a
 * new resource is metered, never reordered or pruned — reordering would orphan every point
 * already stored under the position a resource used to hold.
 */
export const COST_RESOURCES = [
	"workerRequests",
	"workerCpuMs",
	"doRequests",
	"doDurationMs",
	"doRowsRead",
	"doRowsWritten",
	"doStorageGbDays",
	"d1Rows",
	"d1StorageGbDays",
	"kvReads",
	"kvMutations",
	"kvStorageGbDays",
	"analyticsPoints",
	"analyticsQueries",
	"queueOperations",
	"emailSent",
] as const;

/** One resource this rate card prices. */
export type CostResource = (typeof COST_RESOURCES)[number];

/** How much of each resource a unit of work consumed. */
export type CostQuantities = Record<CostResource, number>;

/**
 * Cents per unit for every resource the platform meters: Worker requests and CPU
 * milliseconds; Durable Object requests, duration and SQLite rows read, written and
 * stored (as GB-days held); D1 rows and storage; KV reads, mutations and storage;
 * analytics points and queries; queue operations; and email sent.
 */
export const RATES: CostQuantities = {
	workerRequests: 3.0e-5,
	workerCpuMs: 2.0e-6,
	doRequests: 1.5e-5,
	doDurationMs: 1.5625e-7,
	doRowsRead: 1.0e-7,
	doRowsWritten: 1.0e-4,
	doStorageGbDays: 0.667,
	d1Rows: 1.0e-4,
	d1StorageGbDays: 2.5e-2,
	kvReads: 5.0e-5,
	kvMutations: 5.0e-4,
	kvStorageGbDays: 1.667e-2,
	analyticsPoints: 2.5e-5,
	analyticsQueries: 1.0e-4,
	queueOperations: 4.0e-5,
	emailSent: 3.5e-2,
};

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
	let quantities = {} as CostQuantities;
	for (let resource of COST_RESOURCES) quantities[resource] = 0;
	return quantities;
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
	let cents = 0;

	for (let resource of COST_RESOURCES) {
		let units = quantities[resource] ?? 0;
		cents += Math.max(0, units) * RATES[resource];
	}

	return cents;
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
 * Modelled mean row size in bytes, including indexes, for the tables the daily storage
 * sweep prices. No per-tenant storage figure exists to read — Durable Object storage is
 * billed per database, not per row — so a tenant's footprint is estimated from its own
 * row counts and these means rather than measured directly.
 */
export const MODELLED_MEAN_ROW_BYTES = {
	directory: 500,
	audit: 200,
};
