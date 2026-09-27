/**
 * Tests that a job enqueued while serving a request carries that request's trace, so the
 * job's log record joins the request's under one `trace_id`. The `QUEUE` binding is an
 * in-memory queue installed through `cloudflare:workers`, so the assertions read the
 * envelope that really landed on it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { QueueMock } from "@sdxc/cloudflare-mocks";
import type { Middleware } from "remix/router";

import { createEnv, createQueue } from "@sdxc/cloudflare-mocks";
import { log } from "@sdxc/logger/middleware";
import { trace } from "@sdxc/trace-context/middleware";
import { createRouter } from "remix/router";
import { beforeEach, describe, expect, test, vi } from "vitest";

/** The envelope a job lands on the queue as, trace members included. */
interface Envelope {
	job: string;
	body?: unknown;
	traceparent?: string;
}

/** The queue `enqueue` sends to, at module scope because the module captures `env` on import. */
let queue: QueueMock<Envelope> = createQueue<Envelope>({ name: "ping" });

vi.doMock("cloudflare:workers", () => ({ env: createEnv<Env>({ QUEUE: queue }) }));

let { enqueue } = await import("~/app/lib/queue");
let { default: jobs } = await import("~/app/jobs");

beforeEach(() => queue.reset());

describe("enqueue", () => {
	test("carries the trace of the request that enqueued the job", async () => {
		let router = createRouter({ middleware: [log() as Middleware, trace() as Middleware] });
		router.get("/", async (ctx) => {
			await enqueue(jobs.verifyDomainOwnership, { teamDomainId: "domain-1" });
			return new Response(ctx.trace.traceId);
		});

		let traceId = await (await router.fetch("https://uptime.test/")).text();

		expect(traceId).toMatch(/^[0-9a-f]{32}$/);
		expect(queue.sent[0]?.body.traceparent).toMatch(
			new RegExp(`^00-${traceId}-[0-9a-f]{16}-0[0-3]$`),
		);
	});

	test("sends no trace from outside a traced invocation", async () => {
		await enqueue(jobs.verifyDomainOwnership, { teamDomainId: "domain-1" });

		expect(queue.sent[0]?.body).toEqual({
			job: "verifyDomainOwnership",
			body: { teamDomainId: "domain-1" },
		});
	});
});
