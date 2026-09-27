/**
 * Checks a job enqueued while a request is handled carries that request's trace, with
 * `trace()` mounted directly after `log(logger)` as every router mounts it, so the job's
 * log joins the request's trace when the queue delivers it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { createJobDispatcher } from "@sdxc/jobs";
import * as memory from "@sdxc/jobs/memory";
import { log } from "@sdxc/logger/middleware";
import { trace } from "@sdxc/trace-context/middleware";
import { createRouter } from "remix/router";
import { expect, test } from "vitest";

import jobs from "~/app/jobs";
import { logger } from "~/bootstrap/logger";

/** A caller's `traceparent`, the W3C specification's own example. */
const CALLER_TRACEPARENT = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";

test("a job enqueued by a request carries the request's traceparent", async () => {
	let queue = memory.queue();
	let dispatcher = createJobDispatcher({ logger, queue });
	let requestSpanId: string | null = null;

	let router = createRouter({ middleware: [log(logger) as Middleware, trace() as Middleware] });
	router.post("/enqueue", async (ctx) => {
		requestSpanId = ctx.trace.spanId;
		await dispatcher.enqueue(jobs.deliverWebhook, { tenantId: "tenant_1", deliveryId: "d_1" });
		return new Response(null, { status: 204 });
	});

	let response = await router.fetch(
		new Request("https://auth.example.com/enqueue", {
			method: "POST",
			headers: { traceparent: CALLER_TRACEPARENT },
		}),
	);

	expect(response.status).toBe(204);
	expect(queue.messages).toEqual([
		expect.objectContaining({
			job: "deliverWebhook",
			traceparent: `00-4bf92f3577b34da6a3ce929d0e0e4736-${requestSpanId}-01`,
		}),
	]);
});
