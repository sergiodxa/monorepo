/**
 * Exercises the `sweepDueWebhookDeliveries` cron: it claims every provisioned
 * tenant's own due deliveries through its Durable Object and fans one
 * `deliverWebhook` message out per claimed delivery, leaving a tenant with nothing
 * due untouched on the queue.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { QueueMock } from "@sdxc/cloudflare-mocks";
import type { Database } from "remix/data-table";

import { createDurableObjectNamespace, createEnv, createQueue } from "@sdxc/cloudflare-mocks";
import { Log } from "@sdxc/logger";
import { unwrap } from "@sdxc/result";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { Models } from "~/app/models";
import type Tenant from "~/database/tenant-do";

/** The `QUEUE` binding `dispatcher.enqueueMany` writes `deliverWebhook` messages through. */
let queue: QueueMock = createQueue();

vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Cloudflare.Env>({ QUEUE: queue }),
}));

let { createJobContext } = await import("@sdxc/jobs");
let jobs = (await import("~/app/jobs")).default;
let { Database: JobDatabase } = await import("~/app/jobs/middleware/database");
let { TenantNamespace } = await import("~/app/jobs/middleware/tenant");
let { createTestDatabase } = await import("~/app/test/db");
let { bindModels, publishModels } = await import("~/app/test/models");
let sweepDueWebhookDeliveries = (await import("./sweep-due-webhook-deliveries")).default;

let db: Database;
let models: Models;

beforeEach(async () => {
	queue.reset();
	db = await createTestDatabase();
	models = bindModels(db);
});

/** Creates a provisioned tenant row in the control plane. */
async function makeTenant(name: string) {
	let customer = unwrap(await models.customers.create({ name }));
	return unwrap(
		await models.tenants.create({
			customer_id: customer.id,
			name,
			slug: name.toLowerCase(),
			issuer: `https://${name.toLowerCase()}.example.com`,
		}),
	);
}

/** Builds the context the handler receives, wired to the control-plane `db` and a stubbed tenant namespace. */
function makeContext(namespace: DurableObjectNamespace<Tenant>) {
	let record: Record<string, unknown> = {};
	let log = new Log({ kind: "job", sink: (emitted) => void (record = emitted) });
	let ctx = createJobContext(jobs.sweepDueWebhookDeliveries, { id: "message-1", attempts: 1, log });
	ctx.set(JobDatabase, db, { property: "database" });
	publishModels(ctx, db);
	ctx.set(TenantNamespace, namespace, { property: "tenant" });

	return {
		ctx,
		emit: () => {
			log.emit();
			return record;
		},
	};
}

describe("sweepDueWebhookDeliveries", () => {
	test("enqueues one deliverWebhook message per due delivery", async () => {
		let tenant = await makeTenant("Acme");

		let namespace = createDurableObjectNamespace<Tenant>(() => ({
			claimDueDeliveries: async () => ({
				deliveries: [
					{ deliveryId: "whdl_1", endpointId: "whep_1" },
					{ deliveryId: "whdl_2", endpointId: "whep_1" },
				],
				more: false,
			}),
		}));

		let { ctx, emit } = makeContext(namespace);
		await sweepDueWebhookDeliveries(ctx);

		expect(queue.messages.map((message) => message.body)).toEqual([
			{ job: "deliverWebhook", body: { tenantId: tenant.id, deliveryId: "whdl_1" } },
			{ job: "deliverWebhook", body: { tenantId: tenant.id, deliveryId: "whdl_2" } },
		]);
		expect(emit()).toMatchObject({ "tenants.visited": 1, "webhooks.enqueued": 2 });
	});

	test("enqueues nothing for a tenant with no due deliveries", async () => {
		await makeTenant("Acme");

		let namespace = createDurableObjectNamespace<Tenant>(() => ({
			claimDueDeliveries: async () => ({ deliveries: [], more: false }),
		}));

		let { ctx, emit } = makeContext(namespace);
		await sweepDueWebhookDeliveries(ctx);

		expect(queue.messages).toHaveLength(0);
		expect(emit()).toMatchObject({ "tenants.visited": 1, "webhooks.enqueued": 0 });
	});

	test("visits every provisioned tenant, not just the first", async () => {
		let first = await makeTenant("Acme");
		let second = await makeTenant("Bristle");

		let namespace = createDurableObjectNamespace<Tenant>((name) => ({
			claimDueDeliveries: async () => ({
				deliveries: [{ deliveryId: `whdl_${name}`, endpointId: "whep_1" }],
				more: false,
			}),
		}));

		let { ctx, emit } = makeContext(namespace);
		await sweepDueWebhookDeliveries(ctx);

		let bodies = queue.messages.map((message) => message.body);
		expect(bodies).toEqual(
			expect.arrayContaining([
				{ job: "deliverWebhook", body: { tenantId: first.id, deliveryId: `whdl_${first.id}` } },
				{ job: "deliverWebhook", body: { tenantId: second.id, deliveryId: `whdl_${second.id}` } },
			]),
		);
		expect(emit()).toMatchObject({ "tenants.visited": 2, "webhooks.enqueued": 2 });
	});
});
