/**
 * Exercises the router middleware: the enqueuer it publishes as `ctx.jobs`, the messages a
 * route handler writes through it, and the failures and traces those messages carry.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { failure } from "@sdxc/result";
import { trace } from "@sdxc/trace-context/middleware";
import * as s from "remix/data-schema";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import * as memory from "./adapters/memory.js";
import { jobEnqueuer, Jobs } from "./router.js";

import { job, jobs, JobQueueError } from "./index.js";

const MAP = jobs({
	checkHttp: job({ input: s.object({ monitorId: s.string() }) }),
	clean: job(),
});

describe("jobEnqueuer()", () => {
	test("enqueues one message addressed by the job's name", async () => {
		let queue = memory.queue();
		let router = createRouter({ middleware: [jobEnqueuer(queue)] });
		router.post("/", async (ctx) => {
			await ctx.jobs.enqueue(MAP.checkHttp, { monitorId: "m1" });
			await ctx.jobs.enqueue(MAP.clean);
			return new Response(null, { status: 204 });
		});

		await router.fetch(new Request("https://example.com/", { method: "POST" }));

		expect(queue.messages).toEqual([
			{ job: "checkHttp", body: { monitorId: "m1" } },
			{ job: "clean" },
		]);
	});

	test("enqueues one message per input, and nothing for no inputs", async () => {
		let queue = memory.queue();
		let router = createRouter({ middleware: [jobEnqueuer(queue)] });
		router.post("/", async (ctx) => {
			await ctx.jobs.enqueueMany(MAP.checkHttp, [{ monitorId: "m1" }, { monitorId: "m2" }]);
			await ctx.jobs.enqueueMany(MAP.checkHttp, []);
			return new Response(null, { status: 204 });
		});

		await router.fetch(new Request("https://example.com/", { method: "POST" }));

		expect(queue.messages).toEqual([
			{ job: "checkHttp", body: { monitorId: "m1" } },
			{ job: "checkHttp", body: { monitorId: "m2" } },
		]);
	});

	test("requires the payload a job's schema declares", () => {
		let router = createRouter({ middleware: [jobEnqueuer(memory.queue())] });
		router.post("/", async (ctx) => {
			// @ts-expect-error -- a job declaring a schema requires its payload
			await ctx.jobs.enqueue(MAP.checkHttp);
			return new Response(null, { status: 204 });
		});
	});

	test("publishes the same enqueuer under the Jobs key", async () => {
		let router = createRouter({ middleware: [jobEnqueuer(memory.queue())] });
		router.get("/", (ctx) => new Response(String(ctx.get(Jobs) === ctx.jobs)));

		let response = await router.fetch(new Request("https://example.com/"));

		expect(await response.text()).toBe("true");
	});

	test("raises the backend's failure to the handler", async () => {
		let queue = memory.queue();
		queue.send = () =>
			Promise.resolve(failure(new JobQueueError("Queue is down", { code: "unavailable" })));

		let router = createRouter({ middleware: [jobEnqueuer(queue)] });
		router.post("/", async (ctx) => {
			try {
				await ctx.jobs.enqueue(MAP.clean);
				return new Response("enqueued");
			} catch (error) {
				return new Response(error instanceof JobQueueError ? error.code : "unknown");
			}
		});

		let response = await router.fetch(new Request("https://example.com/", { method: "POST" }));

		expect(await response.text()).toBe("unavailable");
	});

	test("carries the request's trace on every message", async () => {
		let traceparent = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
		let queue = memory.queue();
		let router = createRouter({ middleware: [trace(), jobEnqueuer(queue)] });
		router.post("/", async (ctx) => {
			await ctx.jobs.enqueue(MAP.clean);
			return new Response(null, { status: 204 });
		});

		await router.fetch(
			new Request("https://example.com/", { method: "POST", headers: { traceparent } }),
		);

		expect(queue.messages).toEqual([
			{
				job: "clean",
				traceparent: expect.stringMatching(/^00-4bf92f3577b34da6a3ce929d0e0e4736-/),
			},
		]);
	});
});
