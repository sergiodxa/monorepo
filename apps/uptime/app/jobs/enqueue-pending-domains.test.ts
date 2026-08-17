/**
 * Unit tests for `EnqueuePendingDomainsJob.perform`: verifies it batches one
 * `verifyDomainOwnership` queue message per unverified team domain and skips the queue
 * call entirely when there is nothing pending. The `QUEUE` binding is an in-memory queue
 * installed through `mock.module("cloudflare:workers", ...)`, since the job reaches for
 * `env.QUEUE.sendBatch` directly, so the messages asserted on are the ones that really
 * landed on it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test";

import type { QueueMock } from "@pkg/cloudflare-mocks";

import { createEnv, createQueue } from "@pkg/cloudflare-mocks";
import { BatchedLogger } from "@pkg/logger";
import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";

/**
 * The queue the job enqueues through. It lives at module scope because the module under
 * test captures `env` on import, so `beforeEach` empties it rather than re-creating it.
 */
let queue: QueueMock = createQueue({ name: "verify-domains" });

/** Nothing pending means no call at all, which an empty `sent` cannot tell apart. */
let sendBatch = spyOn(queue, "sendBatch");

await mock.module("cloudflare:workers", () => ({ env: createEnv<Env>({ QUEUE: queue }) }));

let TeamDomain = (await import("~/app/data/team-domain")).default;
let { createTestDatabase } = await import("~/app/lib/test/db");
let { EnqueuePendingDomainsJob } = await import("./enqueue-pending-domains");

describe("EnqueuePendingDomainsJob.perform", () => {
	let db: ReturnType<typeof createTestDatabase>["db"];
	let container: ServiceContainer;

	beforeEach(() => {
		({ db } = createTestDatabase());
		container = new ServiceContainer();
		container.singleton(Database, () => db);
		queue.reset();
		sendBatch.mockClear();
	});

	test("does nothing when there are no unverified domains", async () => {
		let domain = await TeamDomain.create(db, "team-1", "verified.example.com");
		await TeamDomain.markVerified(db, domain.id);

		let logger = new BatchedLogger("test");

		await container.scope(async () => {
			let job = new EnqueuePendingDomainsJob({ logger }, {});
			await job.perform();
		});

		expect(sendBatch).not.toHaveBeenCalled();
		expect(queue.sent).toBeEmpty();
		let event = logger.events.find((entry) => entry.event === "job.enqueue_pending_domains.none");
		expect(event).toBeDefined();
	});

	test("batches one verifyDomainOwnership message per unverified domain", async () => {
		let first = await TeamDomain.create(db, "team-1", "pending-one.example.com");
		let second = await TeamDomain.create(db, "team-1", "pending-two.example.com");
		let verified = await TeamDomain.create(db, "team-1", "verified.example.com");
		await TeamDomain.markVerified(db, verified.id);

		let logger = new BatchedLogger("test");

		await container.scope(async () => {
			let job = new EnqueuePendingDomainsJob({ logger }, {});
			await job.perform();
		});

		expect(sendBatch).toHaveBeenCalledTimes(1);
		let messages = queue.sent;
		expect(messages).toHaveLength(2);

		let teamDomainIds = messages.map(
			(message) => (message.body as { teamDomainId: string }).teamDomainId,
		);
		expect(new Set(teamDomainIds)).toEqual(new Set([first.id, second.id]));

		for (let message of messages) {
			expect(message.contentType).toBe("json");
			expect((message.body as { type: string }).type).toBe("verifyDomainOwnership");
		}

		let event = logger.events.find(
			(entry) => entry.event === "job.enqueue_pending_domains.enqueued",
		);
		expect(event?.count).toBe(2);
	});
});
