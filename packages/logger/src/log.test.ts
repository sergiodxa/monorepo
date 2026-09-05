/**
 * Tests for the wide event: field flattening, counters and timers, notes and their cap,
 * outcome precedence, the error shape, parent/child accounting, and `run()` binding the
 * current log and emitting exactly once whatever the body does.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, test, vi } from "vitest";

import { currentLog } from "./current.js";
import { Log } from "./log.js";

type Record = globalThis.Record<string, unknown>;

/** A log whose records land in an array, with the outcome each was emitted at. */
function collect(options: Partial<Log.Options> = {}) {
	let records: Record[] = [];
	let outcomes: Log.Outcome[] = [];
	let log = new Log({
		kind: "request",
		sink(record, outcome) {
			records.push(record);
			outcomes.push(outcome);
		},
		...options,
	});
	return { log, records, outcomes };
}

class CodedError extends Error {
	override name = "CodedError";
	code = "rate_limited";
	retriable = true;
}

describe(Log, () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("fields", () => {
		test("flattens one level of nesting to dotted keys", () => {
			let { log, records } = collect();
			log.set({ user: { id: "usr_1", plan: "pro" }, route: "/x" });
			log.emit();
			expect(records[0]).toMatchObject({ "user.id": "usr_1", "user.plan": "pro", route: "/x" });
		});

		test("merges across calls, a later value winning", () => {
			let { log, records } = collect();
			log
				.set({ team: { id: "a" } })
				.set({ team: { seats: 3 } })
				.set({ team: { id: "b" } });
			log.emit();
			expect(records[0]).toMatchObject({ "team.id": "b", "team.seats": 3 });
		});

		test("skips undefined and serializes anything deeper than a scalar", () => {
			let { log, records } = collect();
			// @ts-expect-error -- runtime tolerance for shapes the type rejects
			log.set({ gone: undefined, list: [1, 2], deep: { a: { b: 1 } } });
			log.emit();
			expect(records[0]).not.toHaveProperty("gone");
			expect(records[0]).toMatchObject({ list: "[1,2]", "deep.a": '{"b":1}' });
		});

		test("carries the configuration in front of the fields", () => {
			let { log, records } = collect({ service: "uptime", environment: "test", version: "v1" });
			log.emit();
			expect(Object.keys(records[0]!).slice(0, 4)).toEqual([
				"service",
				"environment",
				"version",
				"kind",
			]);
		});
	});

	describe("counters and timers", () => {
		test("inc creates a counter at zero and adds to it", () => {
			let { log, records } = collect();
			log.inc("cache.miss").inc("cache.miss").inc("db.rows", 40);
			log.emit();
			expect(records[0]).toMatchObject({ "cache.miss": 2, "db.rows": 40 });
		});

		test("time records a count and a duration and returns the value", async () => {
			let { log, records } = collect();
			let value = await log.time("db", () => Promise.resolve(7));
			await log.time("db", () => 8);
			log.emit();
			expect(value).toBe(7);
			expect(records[0]).toMatchObject({ "db.count": 2 });
			expect(records[0]!["db.duration_ms"]).toBeTypeOf("number");
		});

		test("time records on the throwing path and rethrows", async () => {
			let { log, records } = collect();
			await expect(log.time("fetch", () => Promise.reject(new Error("boom")))).rejects.toThrow(
				"boom",
			);
			log.emit();
			expect(records[0]).toMatchObject({ "fetch.count": 1, outcome: "ok" });
		});
	});

	describe("notes and outcome", () => {
		test("note records a breadcrumb with its offset and leaves the outcome ok", () => {
			let { log, records, outcomes } = collect();
			log.note("session.read", { via: "cookie" });
			log.emit();
			expect(records[0]!.notes).toEqual([
				expect.objectContaining({ level: "info", name: "session.read", via: "cookie" }),
			]);
			expect((records[0]!.notes as Record[])[0]!.at).toBeTypeOf("number");
			expect(outcomes[0]).toBe("ok");
		});

		test("warn degrades the outcome, fail overrides it, and warn never undoes fail", () => {
			let { log, records } = collect();
			log.warn("cache.unavailable");
			expect(log.outcome).toBe("degraded");
			log.fail(new Error("down"));
			log.warn("later");
			log.emit();
			expect(records[0]).toMatchObject({ outcome: "error" });
		});

		test("fail records the error shape, reading code and retriable when present", () => {
			let { log, records } = collect();
			log.fail(new CodedError("Too many requests"), { provider: "polar" });
			log.emit();
			expect(records[0]).toMatchObject({
				"error.type": "CodedError",
				"error.message": "Too many requests",
				"error.code": "rate_limited",
				"error.retriable": true,
				provider: "polar",
			});
			expect(records[0]!["error.stack"]).toContain("CodedError");
		});

		test("fail describes a thrown non-error", () => {
			let { log, records } = collect();
			log.fail("nope");
			log.emit();
			expect(records[0]).toMatchObject({ "error.type": "UnknownError", "error.message": "nope" });
		});

		test("caps the notes and counts what it dropped", () => {
			let { log, records } = collect();
			for (let index = 0; index < 250; index++) log.note(`step.${index}`);
			log.emit();
			expect(records[0]!.notes).toHaveLength(200);
			expect(records[0]).toMatchObject({ "notes.dropped": 50 });
		});

		test("omits notes entirely when there are none", () => {
			let { log, records } = collect();
			log.emit();
			expect(records[0]).not.toHaveProperty("notes");
		});
	});

	describe("emit", () => {
		test("emits once, with the outcome and a duration", () => {
			let { log, records, outcomes } = collect();
			log.emit();
			log.emit();
			expect(records).toHaveLength(1);
			expect(records[0]).toMatchObject({ kind: "request", outcome: "ok" });
			expect(records[0]!.duration_ms).toBeTypeOf("number");
			expect(outcomes).toEqual(["ok"]);
		});

		test("writes to the console at the level the outcome names", () => {
			let info = vi.spyOn(console, "log").mockImplementation(() => {});
			let warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			let error = vi.spyOn(console, "error").mockImplementation(() => {});

			new Log({ kind: "request" }).emit();
			new Log({ kind: "request" }).warn("slow").emit();
			new Log({ kind: "request" }).fail(new Error("x")).emit();

			expect(info).toHaveBeenCalledWith(expect.objectContaining({ outcome: "ok" }));
			expect(warn).toHaveBeenCalledWith(expect.objectContaining({ outcome: "degraded" }));
			expect(error).toHaveBeenCalledWith(expect.objectContaining({ outcome: "error" }));
		});

		test("drops an ok log the sampler rejects and keeps every failure", () => {
			let { log, records } = collect({ sample: { rate: 0 } });
			log.emit();
			expect(records).toHaveLength(0);

			let failed = collect({ sample: { rate: 0 } });
			failed.log.fail(new Error("x"));
			failed.log.emit();
			expect(failed.records).toHaveLength(1);
		});
	});

	describe("children", () => {
		test("a child shares the configuration and counts into its parent on emit", () => {
			let { log, records } = collect({ service: "uptime", version: "v1" });
			let child = log.child("job", { job: { name: "clean" } });
			expect(child.parent).toBe(log);
			child.emit();
			log.emit();
			expect(records[0]).toMatchObject({
				service: "uptime",
				version: "v1",
				kind: "job",
				"job.name": "clean",
			});
			expect(records[1]).toMatchObject({ kind: "request", "job.count": 1, outcome: "ok" });
		});

		test("a child that did not end ok degrades its parent", () => {
			let { log, records } = collect();
			log.child("job").fail(new Error("x")).emit();
			log.emit();
			expect(records[1]).toMatchObject({ outcome: "degraded" });
		});
	});

	describe("run", () => {
		test("binds the log as current for the body and emits when it settles", async () => {
			let { log, records } = collect();
			expect(currentLog()).toBeUndefined();

			let value = await log.run(async (self) => {
				expect(currentLog()).toBe(self);
				await Promise.resolve();
				expect(currentLog()).toBe(self);
				return 42;
			});

			expect(value).toBe(42);
			expect(currentLog()).toBeUndefined();
			expect(records).toHaveLength(1);
		});

		test("a nested run is current inside and the outer log is current again after", async () => {
			let outer = collect().log;
			let inner = outer.child("job");

			await outer.run(async () => {
				await inner.run(() => {
					expect(currentLog()).toBe(inner);
				});
				expect(currentLog()).toBe(outer);
			});
		});

		test("fails the log, still emits, and rethrows when the body throws", async () => {
			let { log, records } = collect();
			await expect(
				log.run(() => {
					throw new Error("boom");
				}),
			).rejects.toThrow("boom");
			expect(records[0]).toMatchObject({ outcome: "error", "error.message": "boom" });
		});
	});
});
