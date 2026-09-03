/**
 * Unit tests for the cost ledger (ADR-007 §3–§6): a unit of work's D1 statements
 * accumulate independently of concurrent units; apportioned quantities split by
 * team weight; the ledger's own write, modelled CPU, and request share land in
 * what it reports; and the reporting query reads back the same `double`
 * positions the writer wrote.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnalyticsEngineMock } from "@sdxc/cloudflare-mocks";
import type { D1StatementObservation } from "@sdxc/data-table-d1";

import { createAnalyticsEngine, createEnv, createKVNamespace } from "@sdxc/cloudflare-mocks";
import { beforeEach, describe, expect, test, vi } from "vitest";

/**
 * The dataset the ledger flushes to. It lives at module scope because the module under test
 * captures `env` on import, and it enforces the platform's per-point limits, so a rate card
 * grown past what one data point can carry fails here rather than in production.
 */
let costs: AnalyticsEngineMock = createAnalyticsEngine();

vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Env>({ COSTS: costs }),
}));

let { COST_RESOURCES, priceCostQuantities, MODELLED_CPU_MS, RATES } =
	await import("~/app/lib/cost-rates");
let {
	apportionCost,
	apportionCostByTeam,
	CostLedger,
	countedKv,
	createD1Usage,
	currentCostLedger,
	dailyCostQuery,
	OVERFLOW_TEAM_ID,
	PLATFORM_TEAM_ID,
	recordCost,
	recordD1Statement,
	toDailyTeamCost,
	trackCost,
} = await import("./cost");

vi.spyOn(console, "error").mockImplementation(() => {});

beforeEach(() => {
	costs.reset();
});

/** Throws, for the one test that needs the Analytics Engine binding to reject a write. */
function raise(): never {
	throw new Error("analytics engine unavailable");
}

/** One statement's worth of D1 metadata, with the fields under test spelled out. */
function observation(overrides: Partial<D1StatementObservation> = {}): D1StatementObservation {
	return {
		kind: "select",
		table: "monitors",
		rowsRead: 1,
		rowsWritten: 0,
		durationMs: 0.25,
		...overrides,
	};
}

/** The quantity a written point recorded for one resource. */
function quantity(point: AnalyticsEngineDataPoint, resource: string): number {
	return point.doubles?.[COST_RESOURCES.indexOf(resource as never)] ?? 0;
}

/** The priced total a written point recorded, which is its last double. */
function total(point: AnalyticsEngineDataPoint): number {
	return point.doubles?.[COST_RESOURCES.length] ?? 0;
}

/** Runs `body` inside a ledger and returns the points its flush wrote. */
async function flushing(
	body: () => Promise<void>,
	options: {
		handler?: "fetch" | "queue" | "scheduled";
		detail?: string;
		workerRequests?: number;
	} = {},
): Promise<AnalyticsEngineDataPoint[]> {
	let ledger = new CostLedger({
		handler: options.handler ?? "queue",
		detail: options.detail,
		workerRequests: options.workerRequests,
	});
	await trackCost(ledger, body);
	return costs.dataPoints;
}

describe("recordD1Statement", () => {
	/**
	 * Awaits between the two statements because a job's own statements are spread
	 * across awaits, so the accumulator has to survive a microtask boundary.
	 */
	test("accumulates statements, rows, and duration into the active unit of work", async () => {
		let usage = createD1Usage();

		await trackCost(new CostLedger({ handler: "queue", usage }), async () => {
			recordD1Statement(observation({ rowsRead: 20_000 }));
			await Promise.resolve();
			recordD1Statement(observation({ kind: "insert", rowsRead: 0, rowsWritten: 10 }));
		});

		expect(usage).toEqual({ statements: 2, rowsRead: 20_000, rowsWritten: 10, durationMs: 0.5 });
	});

	test("drops a statement issued outside any tracked unit of work", () => {
		let usage = createD1Usage();

		recordD1Statement(observation());

		expect(usage.statements).toBe(0);
		expect(currentCostLedger()).toBeNull();
	});

	test("attributes concurrent units of work separately", async () => {
		let first = createD1Usage();
		let second = createD1Usage();

		await Promise.all([
			trackCost(new CostLedger({ handler: "queue", usage: first }), async () => {
				recordD1Statement(observation({ rowsRead: 1 }));
				await Promise.resolve();
				recordD1Statement(observation({ rowsRead: 1 }));
			}),
			trackCost(new CostLedger({ handler: "queue", usage: second }), async () => {
				recordD1Statement(observation({ rowsRead: 500 }));
				await Promise.resolve();
			}),
		]);

		expect(first.rowsRead).toBe(2);
		expect(second.rowsRead).toBe(500);
	});

	test("prices the rows it accumulated without being told about them again", async () => {
		let [point] = await flushing(async () => {
			apportionCostByTeam(["team-1"]);
			recordD1Statement(observation({ rowsRead: 20_180 }));
			recordD1Statement(observation({ kind: "insert", rowsRead: 0, rowsWritten: 10 }));
		});

		expect(quantity(point!, "d1RowRead")).toBe(20_180);
		expect(quantity(point!, "d1RowWritten")).toBe(10);
	});
});

describe("trackCost", () => {
	test("flushes after the unit of work, however it ended", async () => {
		let boom = new Error("job failed");
		let ledger = new CostLedger({ handler: "queue" });

		await expect(
			trackCost(ledger, async () => {
				apportionCostByTeam(["team-1"]);
				throw boom;
			}),
		).rejects.toBe(boom);

		expect(costs.dataPoints).toHaveLength(1);
	});

	test("returns whatever the tracked unit of work returned", async () => {
		expect(await trackCost(new CostLedger({ handler: "fetch" }), async () => "done")).toBe("done");
	});
});

describe("CostLedger attribution", () => {
	test("records one direct point for the single team that caused the work", async () => {
		let [point] = await flushing(
			async () => {
				apportionCostByTeam(["team-1"]);
				recordCost("emailSent", 1);
			},
			{ detail: "check-http-job" },
		);

		expect(point?.indexes).toEqual(["team-1"]);
		expect(point?.blobs?.[0]).toBe("queue:check-http-job");
		expect(point?.blobs?.[1]).toBe("direct");
		expect(quantity(point!, "emailSent")).toBe(1);
	});

	test("splits shared quantities in proportion to the weights", async () => {
		let written = await flushing(async () => {
			apportionCostByTeam(["team-1", "team-1", "team-1", "team-2"]);
			recordCost("queueOperation", 8);
		});

		let byTeam = new Map(written.map((point) => [point.indexes?.[0], point]));
		expect(quantity(byTeam.get("team-1")!, "queueOperation")).toBeCloseTo(6, 9);
		expect(quantity(byTeam.get("team-2")!, "queueOperation")).toBeCloseTo(2, 9);
		expect(byTeam.get("team-1")?.blobs?.[1]).toBe("apportioned");
	});

	test("accumulates weights across calls, so a sweep can declare them in batches", async () => {
		let written = await flushing(async () => {
			apportionCostByTeam(["team-1"]);
			apportionCostByTeam(["team-1", "team-2"]);
			recordCost("aeQuery", 3);
		});

		let byTeam = new Map(written.map((point) => [point.indexes?.[0], point]));
		expect(quantity(byTeam.get("team-1")!, "aeQuery")).toBeCloseTo(2, 9);
		expect(quantity(byTeam.get("team-2")!, "aeQuery")).toBeCloseTo(1, 9);
	});

	test("ignores a zero-weight team, which caused none of the work", async () => {
		let written = await flushing(async () => {
			apportionCost([
				["team-1", 1],
				["team-2", 0],
			]);
		});

		expect(written.map((point) => point.indexes?.[0])).toEqual(["team-1"]);
	});

	/**
	 * Covers a dead-letter record or a sweep that found nothing pending: a
	 * reporting job earns its keep by saying how much spend landed on nobody.
	 */
	test("records unattributed work as platform cost rather than dropping it", async () => {
		let [point] = await flushing(async () => recordCost("queueOperation", 2), {
			handler: "scheduled",
		});

		expect(point?.indexes).toEqual([PLATFORM_TEAM_ID]);
		expect(point?.blobs?.[1]).toBe("platform");
	});

	/**
	 * The first 249 teams keep their own point; the tail merges into one
	 * overflow point, keeping every team's cost visible in what the flush reports.
	 */
	test("folds teams past the data-point cap into one overflow point", async () => {
		let teamIds = Array.from({ length: 300 }, (_unused, index) => `team-${index}`);
		let written = await flushing(async () => {
			apportionCostByTeam(teamIds);
			recordCost("d1RowWritten", 300);
		});

		expect(written).toHaveLength(250);
		let overflow = written.find((point) => point.indexes?.[0] === OVERFLOW_TEAM_ID);
		expect(quantity(overflow!, "d1RowWritten")).toBeCloseTo(51, 6);
	});
});

describe("CostLedger self-accounting", () => {
	test("charges its own data point to the team the point describes", async () => {
		let [point] = await flushing(async () => apportionCostByTeam(["team-1"]));

		expect(quantity(point!, "aeDataPoint")).toBe(1);
	});

	test("charges one data point per team, not one per flush", async () => {
		let written = await flushing(async () => apportionCostByTeam(["team-1", "team-2"]));

		expect(written.map((point) => quantity(point, "aeDataPoint"))).toEqual([1, 1]);
	});

	test("charges the handler's modelled CPU and the request share it was given", async () => {
		let [point] = await flushing(async () => apportionCostByTeam(["team-1"]), {
			handler: "queue",
			workerRequests: 0.2,
		});

		expect(quantity(point!, "workerRequest")).toBeCloseTo(0.2, 9);
		expect(quantity(point!, "workerCpuMs")).toBe(MODELLED_CPU_MS.queue);
	});

	test("owns a whole request when nothing said otherwise", async () => {
		let [point] = await flushing(async () => apportionCostByTeam(["team-1"]), {
			handler: "fetch",
		});

		expect(quantity(point!, "workerRequest")).toBe(1);
	});

	test("denormalises the priced total, so a read-time re-price has something to disagree with", async () => {
		let [point] = await flushing(async () => {
			apportionCostByTeam(["team-1"]);
			recordCost("emailSent", 1);
		});

		let quantities = Object.fromEntries(
			COST_RESOURCES.map((resource) => [resource, quantity(point!, resource)]),
		);
		expect(total(point!)).toBeCloseTo(priceCostQuantities(quantities as never), 12);
		expect(total(point!)).toBeGreaterThan(RATES.emailSent);
	});

	test("never lets a failed write fail the work it was measuring", async () => {
		vi.spyOn(costs, "writeDataPoint").mockImplementationOnce(() => raise());

		await expect(
			trackCost(new CostLedger({ handler: "fetch" }), async () => {
				apportionCostByTeam(["team-1"]);
				return "done";
			}),
		).resolves.toBe("done");

		expect(costs.dataPoints).toHaveLength(0);
	});
});

describe("countedKv", () => {
	/**
	 * Wraps a namespace backed by real storage, so the assertions confirm behavior
	 * by reading the value back. Checking the `name` property confirms a
	 * non-method property also passes through the proxy untouched.
	 */
	test("counts reads and mutations without changing what the namespace does", async () => {
		let kv = Object.assign(createKVNamespace(), { name: "session-store" });
		await kv.put("a", "value");

		let [point] = await flushing(async () => {
			apportionCostByTeam(["team-1"]);
			let counted = countedKv(kv);
			expect(await counted.get("a")).toBe("value");
			await counted.put("a", "b");
			expect(Reflect.get(counted, "name")).toBe("session-store");
		});

		expect(await kv.get("a")).toBe("b");
		expect(quantity(point!, "kvRead")).toBe(1);
		expect(quantity(point!, "kvMutation")).toBe(1);
	});
});

describe("dailyCostQuery", () => {
	test("reads back the double positions the writer wrote", async () => {
		let [point] = await flushing(async () => {
			apportionCostByTeam(["team-1"]);
			recordCost("aeQuery", 7);
			recordCost("doDurationMs", 250);
		});

		let sql = dailyCostQuery("2026-07-30");
		let aliases = [...sql.matchAll(/double(\d+)\) AS (\w+)/g)].map(([, index, alias]) => ({
			index: Number(index),
			alias: alias!,
		}));

		let row: Record<string, unknown> = {};
		for (let { index, alias } of aliases) row[alias] = point!.doubles?.[index - 1];
		let parsed = toDailyTeamCost({ ...row, teamId: "team-1", rateCard: "v" });

		expect(parsed.quantities.aeQuery).toBe(7);
		expect(parsed.quantities.doDurationMs).toBe(250);
		expect(aliases.map((entry) => entry.alias)).toEqual([...COST_RESOURCES, "reportedCents"]);
	});

	/**
	 * Analytics Engine samples under load, so weighting each sum by the sample
	 * interval keeps a cost figure representative of the expensive customers.
	 */
	test("weights every sum by the sample interval", () => {
		let sql = dailyCostQuery("2026-07-30");
		let sums = sql.match(/SUM\(/g) ?? [];

		expect(sql.match(/SUM\(_sample_interval \*/g)).toHaveLength(sums.length);
	});

	test("bounds the query to the requested UTC day", () => {
		let sql = dailyCostQuery("2026-07-30");

		expect(sql).toContain("timestamp >= toDateTime('2026-07-30 00:00:00')");
		expect(sql).toContain("INTERVAL '1' DAY");
		expect(sql).toContain("GROUP BY index1, blob3");
	});
});

describe("toDailyTeamCost", () => {
	test("reads a missing resource as zero and a stringified sum as a number", () => {
		let parsed = toDailyTeamCost({
			teamId: "team-1",
			rateCard: "2026-07-31",
			d1RowRead: "20180",
			reportedCents: "0.0034767",
		});

		expect(parsed.quantities.d1RowRead).toBe(20_180);
		expect(parsed.quantities.emailSent).toBe(0);
		expect(parsed.reportedCents).toBeCloseTo(0.0034767, 9);
	});
});
