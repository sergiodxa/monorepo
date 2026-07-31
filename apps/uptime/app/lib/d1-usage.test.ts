/**
 * Unit tests for the D1 usage accumulator (ADR-019 §1): statements are attributed to
 * the unit of work that issued them, concurrent units don't pool their totals, and a
 * statement issued outside any tracked unit is dropped rather than charged to whoever
 * happens to be running. The observer signature is the one `@pkg/data-table-d1` calls,
 * so these also pin that the adapter's `onStatement` payload is consumed as-is.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import type { D1StatementObservation } from "@pkg/data-table-d1";

import { createD1Usage, recordD1Statement, trackD1Usage } from "./d1-usage";

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

describe("createD1Usage", () => {
	test("starts at zero", () => {
		expect(createD1Usage()).toEqual({
			statements: 0,
			rowsRead: 0,
			rowsWritten: 0,
			durationMs: 0,
		});
	});
});

describe("recordD1Statement", () => {
	test("accumulates statements, rows, and duration into the active unit of work", async () => {
		let usage = createD1Usage();

		await trackD1Usage(usage, async () => {
			recordD1Statement(observation({ rowsRead: 20_000 }));
			// Awaited in between: the accumulator has to survive a microtask boundary,
			// since a job's statements are spread across awaits.
			await Promise.resolve();
			recordD1Statement(observation({ kind: "insert", rowsRead: 0, rowsWritten: 10 }));
		});

		expect(usage).toEqual({
			statements: 2,
			rowsRead: 20_000,
			rowsWritten: 10,
			durationMs: 0.5,
		});
	});

	test("drops a statement issued outside any tracked unit of work", () => {
		let usage = createD1Usage();

		recordD1Statement(observation());

		expect(usage.statements).toBe(0);
	});

	test("attributes concurrent units of work separately", async () => {
		let first = createD1Usage();
		let second = createD1Usage();

		await Promise.all([
			trackD1Usage(first, async () => {
				recordD1Statement(observation({ rowsRead: 1 }));
				await Promise.resolve();
				recordD1Statement(observation({ rowsRead: 1 }));
			}),
			trackD1Usage(second, async () => {
				recordD1Statement(observation({ rowsRead: 500 }));
				await Promise.resolve();
			}),
		]);

		// Pooling these would report 502 rows read twice and answer nothing.
		expect(first.rowsRead).toBe(2);
		expect(second.rowsRead).toBe(500);
	});

	test("nests, attributing statements to the innermost unit of work", async () => {
		let outer = createD1Usage();
		let inner = createD1Usage();

		await trackD1Usage(outer, async () => {
			recordD1Statement(observation());
			await trackD1Usage(inner, async () => recordD1Statement(observation()));
		});

		expect(outer.statements).toBe(1);
		expect(inner.statements).toBe(1);
	});

	test("returns whatever the tracked unit of work returned", async () => {
		let result = await trackD1Usage(createD1Usage(), async () => "done");

		expect(result).toBe("done");
	});

	test("does not swallow a failure from the tracked unit of work", async () => {
		let usage = createD1Usage();
		let boom = new Error("job failed");

		let promise = trackD1Usage(usage, async () => {
			recordD1Statement(observation());
			throw boom;
		});

		await expect(promise).rejects.toBe(boom);
		// The work it did before failing was still counted, even though `job.completed`
		// (the only event that reports totals) never fires for a failed job.
		expect(usage.statements).toBe(1);
	});
});
