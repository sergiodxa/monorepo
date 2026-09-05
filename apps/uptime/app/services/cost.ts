/**
 * The cost ledger: accumulates the platform operations one unit of work
 * caused, splits them across the teams that caused them, prices them
 * against the rate card, and writes the result to the `uptime_costs`
 * Analytics Engine dataset (ADR-007 §3–§6), which the daily reporting job
 * reads back for Polar. The accumulator is async-local, giving each job
 * in a concurrently-run queue batch its own ledger with no crosstalk.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { AsyncLocalStorage } from "node:async_hooks";

import type { D1StatementObservation } from "@sdxc/data-table-d1";
import type { Log } from "@sdxc/logger";

import { currentLog } from "@sdxc/logger";
import { env } from "cloudflare:workers";

import type { CostQuantities, CostResource, WorkerHandler } from "~/app/lib/cost-rates";

import {
	COST_RESOURCES,
	createCostQuantities,
	MODELLED_CPU_MS,
	priceCostQuantities,
	RATE_CARD_VERSION,
} from "~/app/lib/cost-rates";

/** The dataset recorded points land in, and the one the reporting job reads back. */
const COSTS_DATASET = "uptime_costs";

/**
 * Most data points one Analytics Engine `writeDataPoint` caller may emit per Worker
 * invocation. Only a sweep can approach it; teams past the cap fold into `overflow`, so
 * every team still gets a counted, non-zero data point.
 */
const MAX_DATA_POINTS = 250;

/**
 * Log field each resource's total is reported under, in the dotted lowercase naming the log
 * index shares across workers. Stated for every resource, since a resource with no name here
 * would be priced into `cost.cents` while being invisible to the query that explains it.
 */
const COST_FIELDS: Record<CostResource, string> = {
	workerRequest: "worker_requests",
	workerCpuMs: "cpu_ms",
	queueOperation: "queue_operations",
	d1RowRead: "db_rows_read",
	d1RowWritten: "db_rows_written",
	d1StorageGbDay: "db_storage_gb_day",
	kvRead: "kv_reads",
	kvMutation: "kv_mutations",
	kvStorageGbDay: "kv_storage_gb_day",
	doRequest: "do_requests",
	doDurationMs: "do_duration_ms",
	aeDataPoint: "ae_data_points",
	aeQuery: "ae_queries",
	emailSent: "emails_sent",
};

/**
 * Stand-in team id for cost no team caused — a dead-letter record, a domain-verification
 * sweep with nothing pending. Recording it lets the reporting job show how much spend
 * went unattributed, which is a number worth watching.
 */
export const PLATFORM_TEAM_ID = "platform";

/** Stand-in team id for the teams folded together by {@link MAX_DATA_POINTS}. */
export const OVERFLOW_TEAM_ID = "overflow";

/**
 * How a recorded point's quantities were attributed: to the one team that caused them, in
 * shares across several teams that jointly caused them, or to nobody.
 */
export type CostAttribution = "direct" | "apportioned" | "platform";

/**
 * Database work one unit of work did, accumulated in place while it ran. Counters are
 * mutated by {@link recordD1Statement} on the hot path, which is what makes per-job
 * attribution cost nothing beyond the additions.
 */
export interface D1Usage {
	/** Statements executed. */
	statements: number;
	/** Rows read from tables and indexes. */
	rowsRead: number;
	/** Rows written to tables and indexes. */
	rowsWritten: number;
	/** Milliseconds the database reported for those statements, summed. */
	durationMs: number;
}

/** Options for one {@link CostLedger}. */
export interface CostLedgerOptions {
	/** Worker handler this unit of work runs under; picks the modelled CPU constant. */
	handler: WorkerHandler;
	/** Qualifier appended to the handler in the recorded source, e.g. a job name. */
	detail?: string;
	/**
	 * Share of the invocation's single Workers request this unit of work owns. Defaults to
	 * a whole request, which is right for `fetch` and `scheduled`; a queue batch is one
	 * request running many jobs, so each job owns `1 / batch.messages.length` of it.
	 */
	workerRequests?: number;
	/** D1 counters to accumulate into, when the caller wants to read them back itself. */
	usage?: D1Usage;
}

/**
 * What one unit of work cost, and who caused it. Quantities are recorded
 * without a team and settled at flush time by {@link CostLedger.apportion}:
 * every resource scales with the same per-team weights, so one split serves both.
 */
export class CostLedger {
	/** D1 row counts for this unit of work, accumulated as its statements run. */
	readonly usage: D1Usage;

	readonly #handler: WorkerHandler;
	readonly #source: string;
	readonly #workerRequests: number;
	readonly #quantities: CostQuantities;
	readonly #weights = new Map<string, number>();

	constructor(options: CostLedgerOptions) {
		this.#handler = options.handler;
		this.#source = options.detail ? `${options.handler}:${options.detail}` : options.handler;
		this.#workerRequests = options.workerRequests ?? 1;
		this.#quantities = createCostQuantities();
		this.usage = options.usage ?? createD1Usage();
	}

	/** The `blob1` value recorded points carry, e.g. `queue:check-http`. */
	get source(): string {
		return this.#source;
	}

	/**
	 * Counts `quantity` more units of `resource` against this unit of work.
	 *
	 * @param resource - What was consumed.
	 * @param quantity - How much of it; fractional quantities are meaningful.
	 */
	record(resource: CostResource, quantity: number): void {
		this.#quantities[resource] += quantity;
	}

	/**
	 * Declares which teams caused this unit of work and in what proportion.
	 * Weights **accumulate** across calls, so per-batch and single-call
	 * callers both end up with the split they meant; only the ratios matter.
	 *
	 * @param weights - Team id to relative weight; entries with a non-positive weight are
	 * ignored, since a zero-weight team caused none of the work.
	 */
	apportion(weights: Iterable<readonly [string, number]>): void {
		for (let [teamId, weight] of weights) {
			if (weight <= 0) continue;
			this.#weights.set(teamId, (this.#weights.get(teamId) ?? 0) + weight);
		}
	}

	/**
	 * Prices everything recorded and writes one Analytics Engine data point per team.
	 *
	 * Called exactly once, at the end of the unit of work. Catches and logs its
	 * own errors, since instrumentation failing the work it measures would be worse than none.
	 */
	flush(): void {
		try {
			this.#write();
		} catch (error) {
			currentLog()?.warn("cost.flush_failed", {
				source: this.#source,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	/**
	 * {@link flush} without the guard. CPU, request-share, and D1 quantities
	 * fold in here because only here is the whole unit of work finally over;
	 * each team's write counts itself as work that team caused.
	 */
	#write(): void {
		this.record("workerRequest", this.#workerRequests);
		this.record("workerCpuMs", MODELLED_CPU_MS[this.#handler]);
		this.record("d1RowRead", this.usage.rowsRead);
		this.record("d1RowWritten", this.usage.rowsWritten);

		let attribution = this.#attribution();
		let buckets = this.#split();
		let written = createCostQuantities();
		let cents = 0;

		for (let [teamId, quantities] of buckets) {
			quantities.aeDataPoint += 1;
			let priced = priceCostQuantities(quantities);
			cents += priced;
			for (let resource of COST_RESOURCES) written[resource] += quantities[resource];

			env.COSTS.writeDataPoint({
				indexes: [teamId],
				blobs: [this.#source, attribution, RATE_CARD_VERSION],
				doubles: [...COST_RESOURCES.map((resource) => quantities[resource]), priced],
			});
		}

		this.#report(attribution, buckets.size, cents, written);
	}

	/**
	 * Puts the flushed totals on the invocation's log, so what a request or a job cost is
	 * a query over `cost.*` fields rather than a record to find and read. The quantities
	 * are the ones written, so they include each team's point and sum back to `cents`.
	 *
	 * @param attribution - How the quantities were split.
	 * @param teams - How many data points the flush wrote.
	 * @param cents - What those points priced to, summed.
	 * @param written - Units of every resource the points carry, summed across teams.
	 */
	#report(
		attribution: CostAttribution,
		teams: number,
		cents: number,
		written: CostQuantities,
	): void {
		let log = currentLog();
		if (!log) return;

		let fields: Record<string, Log.Value> = {
			source: this.#source,
			attribution,
			teams,
			cents,
			db_statements: this.usage.statements,
			db_duration_ms: this.usage.durationMs,
		};

		for (let resource of COST_RESOURCES) {
			if (written[resource] > 0) fields[COST_FIELDS[resource]] = written[resource];
		}

		log.set({ cost: fields });
	}

	/** How this unit of work's quantities were attributed, for the recorded `blob2`. */
	#attribution(): CostAttribution {
		if (this.#weights.size === 0) return "platform";
		if (this.#weights.size === 1) return "direct";
		return "apportioned";
	}

	/**
	 * Divides the recorded quantities across the apportionment weights, one
	 * bucket per team. With no weights everything lands on {@link PLATFORM_TEAM_ID};
	 * past {@link MAX_DATA_POINTS} teams the smallest-weighted tail merges into {@link OVERFLOW_TEAM_ID}.
	 */
	#split(): Map<string, CostQuantities> {
		if (this.#weights.size === 0) return new Map([[PLATFORM_TEAM_ID, this.#quantities]]);

		let ranked = [...this.#weights].sort(([, left], [, right]) => right - left);
		let total = ranked.reduce((sum, [, weight]) => sum + weight, 0);
		let overflows = ranked.length > MAX_DATA_POINTS;

		if (overflows) {
			currentLog()?.warn("cost.flush_overflowed", {
				source: this.#source,
				teams: ranked.length,
				merged: ranked.length - (MAX_DATA_POINTS - 1),
			});
		}

		let buckets = new Map<string, CostQuantities>();

		for (let [index, [teamId, weight]] of ranked.entries()) {
			let key = overflows && index >= MAX_DATA_POINTS - 1 ? OVERFLOW_TEAM_ID : teamId;
			let bucket = buckets.get(key);
			if (!bucket) buckets.set(key, (bucket = createCostQuantities()));
			for (let resource of COST_RESOURCES) {
				bucket[resource] += (this.#quantities[resource] * weight) / total;
			}
		}

		return buckets;
	}
}

/**
 * The ledger for the unit of work currently running, if any. Holds the same mutable object
 * the caller will flush afterwards, so recording is a few additions with no allocation and
 * no lookup beyond the async-local store.
 */
const storage = new AsyncLocalStorage<CostLedger>();

/** A fresh, zeroed set of D1 counters. */
export function createD1Usage(): D1Usage {
	return { statements: 0, rowsRead: 0, rowsWritten: 0, durationMs: 0 };
}

/** The ledger for the unit of work currently running, or `null` outside one. */
export function currentCostLedger(): CostLedger | null {
	return storage.getStore() ?? null;
}

/**
 * Counts `quantity` units of `resource` against the running unit of work, or does nothing
 * outside one. Call sites use this directly, so an uninstrumented path costs a plain no-op.
 *
 * @param resource - What was consumed.
 * @param quantity - How much of it, defaulting to one operation.
 */
export function recordCost(resource: CostResource, quantity = 1): void {
	let ledger = storage.getStore();
	if (ledger) ledger.record(resource, quantity);
}

/**
 * Declares which teams caused the running unit of work — see
 * {@link CostLedger.apportion}. A no-op outside a tracked unit of work.
 *
 * @param weights - Team id to relative weight.
 */
export function apportionCost(weights: Iterable<readonly [string, number]>): void {
	let ledger = storage.getStore();
	if (ledger) ledger.apportion(weights);
}

/**
 * Declares that the running unit of work was caused by these teams, one
 * unit of weight per id given — a sweep hands over each claimed monitor's
 * team and gets a split by count; a single-team job gets a direct attribution.
 *
 * @param teamIds - One entry per thing the unit of work did, repeats included.
 */
export function apportionCostByTeam(teamIds: Iterable<string>): void {
	let ledger = storage.getStore();
	if (!ledger) return;

	let weights = new Map<string, number>();
	for (let teamId of teamIds) weights.set(teamId, (weights.get(teamId) ?? 0) + 1);
	ledger.apportion(weights);
}

/**
 * Adds one D1 statement's cost to the running unit of work, or does
 * nothing outside one. The observer runs once per statement on the hot
 * path, allocation-free; statements are counted here and priced later, at flush.
 *
 * @param observation - The row counts D1 reported for one statement.
 */
export function recordD1Statement(observation: D1StatementObservation): void {
	let ledger = storage.getStore();
	if (!ledger) return;

	let usage = ledger.usage;
	usage.statements += 1;
	usage.rowsRead += observation.rowsRead;
	usage.rowsWritten += observation.rowsWritten;
	usage.durationMs += observation.durationMs;
}

/**
 * Runs `body` with `ledger` as the active accumulator and flushes it afterwards, however
 * `body` ended — a unit of work that threw still consumed everything it consumed.
 *
 * @param ledger - The ledger to accumulate into and then flush.
 * @param body - The unit of work to measure.
 * @returns Whatever `body` returns.
 */
export async function trackCost<T>(ledger: CostLedger, body: () => Promise<T>): Promise<T> {
	try {
		return await storage.run(ledger, body);
	} finally {
		ledger.flush();
	}
}

/** Which KV operation each `KVNamespace` method is, for the two rates KV is billed at. */
const KV_RESOURCES: Record<string, CostResource> = {
	get: "kvRead",
	getWithMetadata: "kvRead",
	put: "kvMutation",
	delete: "kvMutation",
	list: "kvMutation",
};

/**
 * Wraps a KV namespace so every operation through it is counted against
 * the running unit of work, since the call sites that read and write KV
 * sessions have no reason to know about cost.
 *
 * @param kv - The namespace binding to count.
 * @returns The same namespace, instrumented.
 */
export function countedKv(kv: KVNamespace): KVNamespace {
	return new Proxy(kv, {
		get(target, property, receiver) {
			let value: unknown = Reflect.get(target, property, receiver);
			if (typeof value !== "function") return value;

			let resource = typeof property === "string" ? KV_RESOURCES[property] : undefined;
			if (!resource) return value.bind(target);

			return (...args: unknown[]) => {
				recordCost(resource);
				return Reflect.apply(value, target, args);
			};
		},
	});
}

/** One team's priced day, as {@link dailyCostQuery} returns it. */
export interface DailyTeamCost {
	teamId: string;
	/** The rate card the quantities were recorded under. */
	rateCard: string;
	/** Units consumed, summed over the day and corrected for Analytics Engine sampling. */
	quantities: CostQuantities;
	/** What the ledger priced those quantities at when it recorded them, in cents. */
	reportedCents: number;
}

/**
 * SQL summing one UTC day of recorded cost per team, for the daily reporting job.
 * Every sum is weighted by `_sample_interval`, since Analytics Engine samples
 * under load and an unweighted sum would quietly under-report the biggest spenders first.
 *
 * @param day - The UTC day to sum, `YYYY-MM-DD`.
 * @returns Query text for the Analytics Engine SQL API.
 */
export function dailyCostQuery(day: string): string {
	let sums = COST_RESOURCES.map(
		(resource, index) => `SUM(_sample_interval * double${index + 1}) AS ${resource}`,
	);

	return `
		SELECT
			index1 AS teamId,
			blob3 AS rateCard,
			${sums.join(",\n\t\t\t")},
			SUM(_sample_interval * double${COST_RESOURCES.length + 1}) AS reportedCents
		FROM ${COSTS_DATASET}
		WHERE timestamp >= toDateTime('${day} 00:00:00')
			AND timestamp < toDateTime('${day} 00:00:00') + INTERVAL '1' DAY
		GROUP BY index1, blob3
	`;
}

/**
 * Reads a grouping column of a {@link dailyCostQuery} row as text. The SQL API types its
 * cells as unknown, so only a scalar becomes text — anything else reads as empty, since no
 * team id or rate card could ever match some default stringification of it.
 */
function toText(value: unknown): string {
	return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

/**
 * Reads one {@link dailyCostQuery} row into a {@link DailyTeamCost}.
 *
 * Values are coerced with `Number` because the SQL API renders large sums as strings, and
 * a missing resource reads as zero — which is what a day with none of it means.
 *
 * @param row - One row of the query's JSON response.
 * @returns The team's priced day.
 */
export function toDailyTeamCost(row: Record<string, unknown>): DailyTeamCost {
	let quantities = createCostQuantities();
	for (let resource of COST_RESOURCES) quantities[resource] = Number(row[resource] ?? 0);

	return {
		teamId: toText(row.teamId),
		rateCard: toText(row.rateCard),
		quantities,
		reportedCents: Number(row.reportedCents ?? 0),
	};
}
