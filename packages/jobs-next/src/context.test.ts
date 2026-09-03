/**
 * Exercises the context: the declaration and delivery it carries, the key store
 * middleware publishes through, and the settlement rules — first one wins, and a
 * context built without a message records the outcome instead of calling a platform.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Message } from "@cloudflare/workers-types";

import { createContextKey } from "remix/router";
import { describe, expect, test, vi } from "vitest";

import { job, JobContext, jobs } from "./index";

let map = jobs(
	{ clean: job({ cron: "0 0 * * *", monitorId: "monitor-1" }) },
	{ send: async () => {} },
);

/** A delivery that records what was done to it. */
function message() {
	return {
		id: "message-1",
		attempts: 1,
		body: {},
		ack: vi.fn(),
		retry: vi.fn(),
	} as unknown as Message<unknown> & {
		ack: ReturnType<typeof vi.fn>;
		retry: ReturnType<typeof vi.fn>;
	};
}

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

describe("settling", () => {
	test("acks the delivery and records it", () => {
		let delivery = message();
		let ctx = new JobContext(map.clean, { id: "message-1", attempts: 1, message: delivery });

		ctx.ack();

		expect(delivery.ack).toHaveBeenCalledTimes(1);
		expect(ctx.settlement).toEqual({ type: "ack" });
	});

	test("converts a retry delay to whole seconds", () => {
		let delivery = message();
		let ctx = new JobContext(map.clean, { id: "message-1", attempts: 1, message: delivery });

		ctx.retry({ delay: "2 minutes" });

		expect(delivery.retry).toHaveBeenCalledWith({ delaySeconds: 120 });
	});

	test("retries without a delay when none was asked for", () => {
		let delivery = message();
		let ctx = new JobContext(map.clean, { id: "message-1", attempts: 1, message: delivery });

		ctx.retry();

		expect(delivery.retry).toHaveBeenCalledWith({});
	});

	test("keeps the first settlement and ignores the second", () => {
		let delivery = message();
		let ctx = new JobContext(map.clean, { id: "message-1", attempts: 1, message: delivery });

		ctx.ack();
		ctx.retry({ delay: "1 hour" });

		expect(ctx.settlement).toEqual({ type: "ack" });
		expect(delivery.retry).not.toHaveBeenCalled();
	});

	test("records the outcome instead of calling a platform when built without a message", () => {
		let ctx = new JobContext(map.clean, { id: "message-1", attempts: 1 });

		expect(ctx.settlement).toBeUndefined();

		ctx.retry({ delay: "5 minutes" });

		expect(ctx.settlement).toEqual({ type: "retry", delay: "5 minutes" });
	});
});
