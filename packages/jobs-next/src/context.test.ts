/**
 * Exercises the context: the declaration and delivery it carries, the key store
 * middleware publishes through, and the settlement rules — first one wins, and a
 * context built without a message records the outcome instead of calling a platform.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createContextKey } from "remix/router";
import { describe, expect, test, vi } from "vitest";

import type { NonRetriable, Retry } from "./errors";

import { createJobContext, Job, job, JobContext, jobs } from "./index";

let map = jobs({ clean: job({ cron: "0 0 * * *", monitorId: "monitor-1" }) });

describe("JobContext", () => {
	test("carries the job's own declaration", () => {
		let ctx = new JobContext(map.clean, { id: "message-1", attempts: 1 });

		expect(ctx.name).toBe("clean");
		expect(ctx.cron).toBe("0 0 * * *");
		expect(ctx.monitorId).toBe("monitor-1");
		expect(ctx.batchSize).toBe(1);
	});

	test("reads back a published value, and a key's default when nothing published one", () => {
		let Database = createContextKey<string>();
		let Region = createContextKey<string>("auto");
		let ctx = new JobContext(map.clean, { id: "message-1", attempts: 1 });

		ctx.set(Database, "live");

		expect(ctx.get(Database)).toBe("live");
		expect(ctx.has(Database)).toBe(true);
		expect(ctx.get(Region)).toBe("auto");
		expect(ctx.has(Region)).toBe(false);
	});

	test("installs a value as a property when asked to", () => {
		let Database = createContextKey<{ label: string }>();
		let ctx = new JobContext(map.clean, { id: "message-1", attempts: 1 });

		ctx.set(Database, { label: "live" }, { property: "database" });

		expect((ctx as unknown as { database: { label: string } }).database).toEqual({ label: "live" });
	});
});

describe("createJobContext()", () => {
	test("builds a context a handler accepts, carrying the job's declaration", () => {
		let ctx = createJobContext(map.clean, { id: "message-1", attempts: 1 });

		expect(ctx.name).toBe("clean");
		expect(ctx.monitorId).toBe("monitor-1");
	});
});

describe("ending a delivery", () => {
	test("acking throws the ending that finishes the job", () => {
		let ctx = new JobContext(map.clean, { id: "message-1", attempts: 1 });

		expect(() => ctx.ack()).toThrow(Job.Ack);
	});

	test("retrying carries the delay it was asked to hold for", () => {
		let ctx = new JobContext(map.clean, { id: "message-1", attempts: 1 });

		try {
			ctx.retry({ delay: "5 minutes" });
			expect.unreachable("retry() must throw");
		} catch (error) {
			expect(error).toBeInstanceOf(Job.Retry);
			expect((error as Retry).delay).toBe("5 minutes");
		}
	});

	test("exiting carries the reason and the cause it was given", () => {
		let ctx = new JobContext(map.clean, { id: "message-1", attempts: 1 });
		let cause = new Error("row is gone");

		try {
			ctx.exit("Team no longer exists", { cause });
			expect.unreachable("exit() must throw");
		} catch (error) {
			expect(error).toBeInstanceOf(Job.NonRetriable);
			expect((error as NonRetriable).message).toBe("Team no longer exists");
			expect((error as NonRetriable).cause).toBe(cause);
		}
	});

	test("timing out throws the ending that pings no monitor", () => {
		let ctx = new JobContext(map.clean, { id: "message-1", attempts: 1 });

		expect(() => ctx.timeout()).toThrow(Job.Timeout);
	});

	test("stops the handler where it was called", () => {
		let ctx = new JobContext(map.clean, { id: "message-1", attempts: 1 });
		let after = vi.fn();

		function handler() {
			ctx.retry();
			after();
		}

		expect(handler).toThrow(Job.Retry);
		expect(after).not.toHaveBeenCalled();
	});
});
