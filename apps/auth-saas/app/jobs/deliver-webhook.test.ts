/**
 * Exercises the `deliverWebhook` job: it prepares the delivery against the tenant's
 * own object, POSTs the signed request, classifies what came back into the outcome
 * `settleDelivery` expects, and turns a `pending` settlement into a retry timed to
 * the row's own next attempt. The endpoint is stubbed with MSW, the same way
 * `organization-domains.test.ts` stubs the DNS-over-HTTPS resolver another job-adjacent
 * service calls out to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createDurableObjectNamespace } from "@sdxc/cloudflare-mocks";
import { Job, createJobContext } from "@sdxc/jobs";
import { Log } from "@sdxc/logger";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import type Tenant from "~/database/tenant-do";
import type { PrepareDeliveryResult, SettleDeliveryResult } from "~/database/webhook-deliveries";

import jobs from "~/app/jobs";
import { TenantNamespace } from "~/app/jobs/middleware/tenant";

import deliverWebhook from "./deliver-webhook";

let ENDPOINT_URL = "https://receiver.example.com/hooks";

let server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
	server.resetHandlers();
	vi.restoreAllMocks();
});
afterAll(() => server.close());

/** The prepared request `prepareDelivery` hands back, for whichever endpoint a test points at. */
function prepared(overrides: Partial<Extract<PrepareDeliveryResult, { ok: true }>> = {}) {
	return {
		ok: true as const,
		url: ENDPOINT_URL,
		headers: { "webhook-signature": "v1,test" },
		body: '{"type":"subject.created"}',
		attempt: 1,
		...overrides,
	};
}

/**
 * A tenant Durable Object stub answering `prepareDelivery` and `settleDelivery` from
 * fixed values, recording every `settleDelivery` call so a test can assert the
 * outcome the handler classified.
 */
function stubTenant(options: { prepared: PrepareDeliveryResult; settled: SettleDeliveryResult }) {
	let settleCalls: unknown[] = [];

	let namespace = createDurableObjectNamespace<Tenant>(() => ({
		prepareDelivery: async () => options.prepared,
		settleDelivery: async (input: unknown) => {
			settleCalls.push(input);
			return options.settled;
		},
	}));

	return { namespace, settleCalls };
}

/** Builds the context the handler receives, wired to a stubbed tenant namespace. */
function makeContext(namespace: DurableObjectNamespace<Tenant>) {
	let record: Record<string, unknown> = {};
	let log = new Log({ kind: "job", sink: (emitted) => void (record = emitted) });
	let ctx = createJobContext(jobs.deliverWebhook, {
		id: "message-1",
		attempts: 1,
		input: { tenantId: "ten_1", deliveryId: "whdl_1" },
		log,
	});
	ctx.set(TenantNamespace, namespace, { property: "tenant" });

	return {
		ctx,
		emit: () => {
			log.emit();
			return record;
		},
	};
}

describe("deliverWebhook", () => {
	test("settles a successful 2xx delivery as delivered", async () => {
		server.use(http.post(ENDPOINT_URL, () => HttpResponse.text("ok", { status: 200 })));

		let { namespace, settleCalls } = stubTenant({
			prepared: prepared(),
			settled: { ok: true, status: "delivered", deliveredAt: 1_700_000_000_000 },
		});
		let { ctx } = makeContext(namespace);

		await deliverWebhook(ctx);

		expect(settleCalls).toEqual([
			expect.objectContaining({
				deliveryId: "whdl_1",
				outcome: "delivered",
				status: 200,
			}),
		]);
	});

	test("settles a non-2xx response as an http_error carrying a body snippet", async () => {
		server.use(
			http.post(ENDPOINT_URL, () => HttpResponse.text("server exploded", { status: 500 })),
		);

		let { namespace, settleCalls } = stubTenant({
			prepared: prepared(),
			settled: { ok: true, status: "exhausted" },
		});
		let { ctx } = makeContext(namespace);

		await deliverWebhook(ctx);

		expect(settleCalls).toEqual([
			expect.objectContaining({
				deliveryId: "whdl_1",
				outcome: "http_error",
				status: 500,
				snippet: "server exploded",
			}),
		]);
	});

	test("settles an aborted attempt as a timeout", async () => {
		let controller = new AbortController();
		vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
		controller.abort();

		let { namespace, settleCalls } = stubTenant({
			prepared: prepared(),
			settled: { ok: true, status: "exhausted" },
		});
		let { ctx } = makeContext(namespace);

		await deliverWebhook(ctx);

		expect(settleCalls).toEqual([
			expect.objectContaining({ deliveryId: "whdl_1", outcome: "timeout" }),
		]);
	});

	test("settles a network failure as a tls_error", async () => {
		server.use(http.post(ENDPOINT_URL, () => HttpResponse.error()));

		let { namespace, settleCalls } = stubTenant({
			prepared: prepared(),
			settled: { ok: true, status: "exhausted" },
		});
		let { ctx } = makeContext(namespace);

		await deliverWebhook(ctx);

		expect(settleCalls).toEqual([
			expect.objectContaining({ deliveryId: "whdl_1", outcome: "tls_error" }),
		]);
		let [call] = settleCalls as Array<{ snippet?: string }>;
		expect(call?.snippet).toBeTruthy();
	});

	test("acks cleanly when the delivery is no longer pending", async () => {
		let { namespace, settleCalls } = stubTenant({
			prepared: { ok: false, reason: "not-pending" },
			settled: { ok: true, status: "exhausted" },
		});
		let { ctx } = makeContext(namespace);

		await expect(deliverWebhook(ctx)).rejects.toBeInstanceOf(Job.Ack);
		expect(settleCalls).toHaveLength(0);
	});

	test("retries with the delay the pending settlement named", async () => {
		server.use(http.post(ENDPOINT_URL, () => HttpResponse.text("try again", { status: 503 })));

		let nextAttemptAt = Date.now() + 5_000;
		let { namespace } = stubTenant({
			prepared: prepared(),
			settled: { ok: true, status: "pending", nextAttemptAt },
		});
		let { ctx } = makeContext(namespace);

		let caught: unknown;
		try {
			await deliverWebhook(ctx);
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(Job.Retry);
		let retry = caught as InstanceType<typeof Job.Retry>;
		expect(retry.delay).toBeGreaterThan(4_000);
		expect(retry.delay).toBeLessThanOrEqual(5_000);
	});
});
