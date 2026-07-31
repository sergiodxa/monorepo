/**
 * The cost ledger: one accumulator per unit of work that counts the platform operations
 * that unit caused, splits them across the teams that caused them, prices them against
 * the rate card, and writes the result to the `uptime_costs` Analytics Engine dataset
 * (ADR-007 §3–§6). It is the measurement half of per-customer cost; the daily reporting
 * job reads this dataset back and hands the figures to Polar.
 *
 * The accumulator is async-local, and it is the *same* one the D1 statement observer
 * already fed: a queue batch is one Worker invocation running up to ten jobs concurrently
 * under `waitUntil`, so a module-global counter would pool a whole batch into one number
 * and answer none of the questions worth asking, and a second parallel accumulator would
 * do the same additions twice on the hot path. `AsyncLocalStorage.run` nests strictly, so
 * concurrent jobs get one ledger each with no crosstalk. Everything recorded outside a
 * tracked unit of work — migrations, boot-time probes, tests — is simply not counted
 * rather than charged to whichever job happened to be running.
 *
 * Nothing on the hot path writes to D1. One data point per team per unit of work costs
 * 2.5e-5 cents, which is 0.7% of the HTTP check it measures; the four to six D1 rows a
 * cost row would have written are 17% of one. The ledger charges its own data point to
 * the team it describes, which is the only self-consistent choice — that write exists
 * because that team's work ran.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { AsyncLocalStorage } from "node:async_hooks";

import type { D1StatementObservation } from "@pkg/data-table-d1";
import type { Job } from "@pkg/jobs";

import { logger } from "@pkg/logger";
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
 * invocation. Only a sweep can approach it, since a sweep flushes one point per distinct
 * team; every other unit of work flushes one or two. Teams past the cap fold into a single
 * `overflow` point rather than being dropped, because a silent truncation here would read
 * as "that customer costs nothing".
 */
const MAX_DATA_POINTS = 250;

/**
 * Stand-in team id for cost no team caused — a dead-letter record, a domain-verification
 * sweep with nothing pending. Written rather than discarded so the reporting job can
 * report how much spend went unattributed, which is a number worth watching.
 */
export const PLATFORM_TEAM_ID = "platform";

/** Stand-in team id for the teams folded together by {@link MAX_DATA_POINTS}. */
export const OVERFLOW_TEAM_ID = "overflow";

/**
 * How a recorded point's quantities were attributed: to the one team that caused them, in
 * shares across several teams that jointly caused them, or to nobody.
 */
export type CostAttribution = "direct" | "apportioned" | "platform";

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
	/**
	 * D1 counters to accumulate into. A job passes the object `Job.run` will report on its
	 * `job.completed` line, so the ledger and that log line count the same statements once.
	 */
	usage?: Job.Usage;
}

/**
 * What one unit of work cost, and who caused it.
 *
 * Quantities are recorded without a team and settled at flush time by
 * {@link CostLedger.apportion}. That is not a shortcut: in every unit of work this app has,
 * the per-team resources are proportional to the same weights the fixed ones are split by
 * — a sweep's per-monitor writes and its one claim both scale with monitors swept per team
 * — so a second, "direct" recording path would be a way of writing the same number twice.
 */
export class CostLedger {
	/** D1 row counts for this unit of work, shared with its `job.completed` log line. */
	readonly usage: Job.Usage;

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
	 * Declares which teams caused this unit of work, and in what proportion.
	 *
	 * Weights **accumulate**, so a sweep can call this once per batch of claimed monitors
	 * and a request's team guard can call it once, and both end up with the split they
	 * meant. Their absolute size is irrelevant — only the ratios are used — so a monitor
	 * count is as good a weight as a fraction.
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
	 * Called exactly once, at the end of the unit of work, and never throws: it exists to
	 * measure the work, and instrumentation that fails the work it measured would be worse
	 * than no instrumentation. The modelled per-handler CPU, the Workers request share, the
	 * D1 rows the statement observer accumulated, and the ledger's own data points are all
	 * folded in here rather than at their call sites, because only here is the whole unit
	 * of work known to be over.
	 */
	flush(): void {
		try {
			this.#write();
		} catch (error) {
			logger.error("cost.flush_failed", {
				source: this.#source,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	/** {@link flush} without the guard: totals the quantities, splits them, and writes. */
	#write(): void {
		this.record("workerRequest", this.#workerRequests);
		this.record("workerCpuMs", MODELLED_CPU_MS[this.#handler]);
		this.record("d1RowRead", this.usage.rowsRead);
		this.record("d1RowWritten", this.usage.rowsWritten);

		let attribution = this.#attribution();
		let buckets = this.#split();

		for (let [teamId, quantities] of buckets) {
			// The point about to be written exists because this team's work ran.
			quantities.aeDataPoint += 1;

			env.COSTS.writeDataPoint({
				indexes: [teamId],
				blobs: [this.#source, attribution, RATE_CARD_VERSION],
				doubles: [
					...COST_RESOURCES.map((resource) => quantities[resource]),
					priceCostQuantities(quantities),
				],
			});
		}
	}

	/** How this unit of work's quantities were attributed, for the recorded `blob2`. */
	#attribution(): CostAttribution {
		if (this.#weights.size === 0) return "platform";
		if (this.#weights.size === 1) return "direct";
		return "apportioned";
	}

	/**
	 * Divides the recorded quantities across the apportionment weights, one bucket per
	 * team. With no weights everything lands on {@link PLATFORM_TEAM_ID}; past
	 * {@link MAX_DATA_POINTS} teams the smallest-weighted tail merges into
	 * {@link OVERFLOW_TEAM_ID} and the truncation is logged.
	 */
	#split(): Map<string, CostQuantities> {
		if (this.#weights.size === 0) return new Map([[PLATFORM_TEAM_ID, this.#quantities]]);

		// Biggest first, so the cap costs the least-significant teams their own point.
		let ranked = [...this.#weights].sort(([, left], [, right]) => right - left);
		let total = ranked.reduce((sum, [, weight]) => sum + weight, 0);
		let overflows = ranked.length > MAX_DATA_POINTS;

		if (overflows) {
			logger.error("cost.flush_overflowed", {
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
export function createD1Usage(): Job.Usage {
	return { statements: 0, rowsRead: 0, rowsWritten: 0, durationMs: 0 };
}

/** The ledger for the unit of work currently running, or `null` outside one. */
export function currentCostLedger(): CostLedger | null {
	return storage.getStore() ?? null;
}

/**
 * Counts `quantity` units of `resource` against the running unit of work, or does nothing
 * outside one. The recording call sites use this rather than reaching for the ledger, so
 * an uninstrumented path costs a no-op rather than a null check.
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
 * Declares that the running unit of work was caused by these teams, one unit of weight per
 * id given — so a sweep hands over the team of every monitor it claimed and gets a split by
 * monitors swept per team, and a single-team job hands over one id and gets a direct
 * attribution. A no-op outside a tracked unit of work.
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
 * Adds one D1 statement's cost to the running unit of work, or does nothing outside one.
 *
 * This is the database adapter's `onStatement` observer, so it runs once per statement on
 * the hot path: it allocates nothing, does no I/O, and cannot throw. Statements are
 * counted here and *priced* at flush time, which is why instrumenting cost added no
 * per-statement work to what ADR-019 already did.
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

/**
 * Share of one Workers request each job in the current queue batch owns.
 *
 * Module-level because a queue batch's size is a property of the invocation rather than of
 * any one job, and `Job.run` gives the usage tracker no way to be told about it. Safe
 * despite being mutable: `queue()` sets it before the synchronous loop that constructs
 * every job's ledger, and each ledger reads it once at construction.
 */
let queuedWorkerRequestShare = 1;

/**
 * Records how many messages the batch now being consumed carries, so each of its jobs is
 * charged its share of the one Workers request the whole batch is billed as. Called by the
 * `queue` handler before it dispatches anything.
 *
 * @param messages - Number of messages in the batch.
 */
export function setQueueBatchSize(messages: number): void {
	queuedWorkerRequestShare = messages > 0 ? 1 / messages : 1;
}

/**
 * The `Job.UsageTracker` this app registers: gives every job its own ledger, keyed to the
 * counters `Job.run` will log, and flushes it when the job's whole lifecycle is over.
 *
 * @param usage - Counters `Job.run` reports on `job.completed`.
 * @param body - The job lifecycle.
 * @param context - Which job is running, which becomes the recorded source.
 * @returns Whatever the lifecycle returns.
 */
export function trackJobCost<T>(
	usage: Job.Usage,
	body: () => Promise<T>,
	context: Job.UsageContext,
): Promise<T> {
	let ledger = new CostLedger({
		handler: "queue",
		detail: context.job,
		workerRequests: queuedWorkerRequestShare,
		usage,
	});

	// A delivered message is one queue read and one delete; a redelivery is another two,
	// counted by the redelivered attempt's own ledger rather than guessed at from here.
	ledger.record("queueOperation", 2);

	return trackCost(ledger, body);
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
 * Wraps a KV namespace so every operation through it is counted against the running unit
 * of work.
 *
 * A proxy rather than counting at the call sites, because the sessions this app stores in
 * KV are read and written inside `@pkg/session-storage-kv`, which has no business knowing
 * about cost — and one wrapper covers whatever else is handed the same binding later.
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
 *
 * Every sum is weighted by `_sample_interval`, without exception: Analytics Engine
 * statistically samples under load and an unweighted sum understates, which for a cost
 * figure means quietly under-reporting the expensive customers first.
 *
 * Built from the same {@link COST_RESOURCES} order the writer positions its `double`
 * fields by, so the two cannot drift.
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
		teamId: String(row.teamId ?? ""),
		rateCard: String(row.rateCard ?? ""),
		quantities,
		reportedCents: Number(row.reportedCents ?? 0),
	};
}
