/**
 * Exercises the command-line middleware: the enqueuer it publishes as `ctx.jobs`, and, given a
 * dispatcher, the jobs a command enqueued on a memory queue running in the command's process
 * inside its log and trace, with retries, follow-up jobs and what is left recorded.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { command, commands, createCLI, success } from "@sdxc/cli";
import { invoke } from "@sdxc/cli/test";
import { createLogger } from "@sdxc/logger";
import { log } from "@sdxc/logger/middleware/cli";
import { trace } from "@sdxc/trace-context/middleware/cli";
import * as s from "remix/data-schema";
import { describe, expect, test } from "vitest";

import * as memory from "./adapters/memory.js";
import { jobEnqueuer, Jobs } from "./cli.js";

import { createJobDispatcher, createJobHandler, job, jobs } from "./index.js";

const MAP = jobs({
	sync: job({ input: s.object({ postId: s.string() }) }),
	notify: job(),
	flaky: job(),
	later: job(),
});

const CONTRACT = commands({ backfill: command({ description: "Backfill posts" }) });

/** A logger whose records land in an array the test reads. */
function collectingLogger() {
	let records: Record<string, unknown>[] = [];
	let logger = createLogger({ service: "app", sink: (record) => void records.push(record) });
	return { logger, records };
}

describe("jobEnqueuer()", () => {
	test("publishes ctx.jobs, writing through the queue it is given", async () => {
		let queue = memory.queue();
		let cli = createCLI({ name: "app", commands: CONTRACT, middleware: [jobEnqueuer(queue)] });
		cli.map(CONTRACT.backfill, async (ctx) => {
			expect(ctx.get(Jobs)).toBe(ctx.jobs);
			await ctx.jobs.enqueueMany(MAP.sync, [{ postId: "p1" }, { postId: "p2" }]);
			return success();
		});

		let run = await invoke(cli, ["backfill"]);

		expect(run.code).toBe(0);
		expect(queue.messages).toEqual([
			{ job: "sync", body: { postId: "p1" } },
			{ job: "sync", body: { postId: "p2" } },
		]);
	});

	test("runs what the command enqueued through the dispatcher, in its log and trace", async () => {
		let { logger, records } = collectingLogger();
		let queue = memory.queue();
		let dispatcher = createJobDispatcher({ queue, logger });
		let synced: string[] = [];
		dispatcher.map(
			MAP.sync,
			createJobHandler(MAP.sync, async (ctx) => {
				synced.push(ctx.input.postId);
				await dispatcher.enqueue(MAP.notify);
			}),
		);
		dispatcher.map(
			MAP.notify,
			createJobHandler(MAP.notify, () => undefined),
		);

		let cli = createCLI({
			name: "app",
			commands: CONTRACT,
			middleware: [log(logger), trace(), jobEnqueuer(queue, { dispatcher })],
		});
		cli.map(CONTRACT.backfill, async (ctx) => {
			await ctx.jobs.enqueue(MAP.sync, { postId: "p1" });
			expect(synced).toEqual([]);
			return success();
		});

		let run = await invoke(cli, ["backfill"]);

		expect(run.code).toBe(0);
		expect(synced).toEqual(["p1"]);
		expect(queue.messages).toEqual([]);

		let command = records.find((record) => record.kind === "command");
		let jobRecords = records.filter((record) => record.kind === "job");
		expect(jobRecords.map((record) => record["job.name"])).toEqual(["sync", "notify"]);
		expect(command).toMatchObject({ "command.path": "backfill", "job.count": 2, outcome: "ok" });
		for (let record of jobRecords) expect(record.trace_id).toBe(command?.trace_id);
	});

	test("retries a failing job in process until it is dead-lettered", async () => {
		let { logger, records } = collectingLogger();
		let queue = memory.queue();
		let dispatcher = createJobDispatcher({ queue, logger, maxAttempts: 2 });
		let attempts = 0;
		dispatcher.map(
			MAP.flaky,
			createJobHandler(MAP.flaky, (ctx) => {
				attempts += 1;
				return ctx.retry({ delay: 0, reason: "not yet" });
			}),
		);

		let cli = createCLI({
			name: "app",
			commands: CONTRACT,
			middleware: [log(logger), jobEnqueuer(queue, { dispatcher })],
		});
		cli.map(CONTRACT.backfill, async (ctx) => {
			await ctx.jobs.enqueue(MAP.flaky);
			return success();
		});

		let run = await invoke(cli, ["backfill"]);

		expect(run.code).toBe(0);
		expect(attempts).toBe(2);
		expect(queue.deadLettered).toEqual([{ job: "flaky" }]);
		expect(records.filter((record) => record.kind === "job")).toHaveLength(2);
		expect(records.find((record) => record.kind === "command")?.outcome).toBe("degraded");
	});

	test("records the jobs still waiting once nothing more is due", async () => {
		let { logger, records } = collectingLogger();
		let queue = memory.queue();
		let dispatcher = createJobDispatcher({ queue, logger });
		dispatcher.map(
			MAP.later,
			createJobHandler(MAP.later, (ctx) => ctx.retry({ delay: "1 hour" })),
		);

		let cli = createCLI({
			name: "app",
			commands: CONTRACT,
			middleware: [log(logger), jobEnqueuer(queue, { dispatcher })],
		});
		cli.map(CONTRACT.backfill, async (ctx) => {
			await ctx.jobs.enqueue(MAP.later);
			return success();
		});

		await invoke(cli, ["backfill"]);

		let command = records.find((record) => record.kind === "command");
		expect(queue.messages).toEqual([{ job: "later" }]);
		expect(command?.outcome).toBe("degraded");
		expect(command?.notes).toEqual([
			expect.objectContaining({ level: "warn", name: "jobs.pending", count: 1 }),
		]);
	});

	test("settles a job that throws as a retry and keeps the command running", async () => {
		let { logger, records } = collectingLogger();
		let queue = memory.queue();
		let dispatcher = createJobDispatcher({ queue, logger });
		dispatcher.map(
			MAP.notify,
			createJobHandler(MAP.notify, () => {
				throw new Error("mailer down");
			}),
		);

		let cli = createCLI({
			name: "app",
			commands: CONTRACT,
			middleware: [log(logger), jobEnqueuer(queue, { dispatcher })],
		});
		cli.map(CONTRACT.backfill, async (ctx) => {
			await ctx.jobs.enqueue(MAP.notify);
			return success();
		});

		let run = await invoke(cli, ["backfill"]);

		expect(run.code).toBe(0);
		expect(records.find((record) => record.kind === "job")).toMatchObject({
			"error.message": "mailer down",
			outcome: "error",
		});
		expect(queue.messages).toEqual([{ job: "notify" }]);
	});
});
