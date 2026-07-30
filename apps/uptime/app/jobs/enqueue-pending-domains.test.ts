/**
 * Unit tests for `EnqueuePendingDomainsJob.perform`: verifies it batches one
 * `verifyDomainOwnership` queue message per unverified team domain and skips the queue
 * call entirely when there is nothing pending. The `QUEUE` binding is stubbed via
 * `mock.module("cloudflare:workers", ...)` since the job calls `env.QUEUE.sendBatch`
 * directly.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";

import { BatchedLogger } from "@pkg/logger";
import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";

/** One recorded `sendBatch` call. */
let sendBatchCalls: Array<Array<{ body: unknown; contentType: string }>> = [];
let sendBatchMock = mock(async (messages: Array<{ body: unknown; contentType: string }>) => {
	sendBatchCalls.push(messages);
});

mock.module("cloudflare:workers", () => ({
	env: { QUEUE: { sendBatch: sendBatchMock } },
}));

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
		sendBatchCalls = [];
		sendBatchMock.mockClear();
	});

	test("does nothing when there are no unverified domains", async () => {
		let domain = await TeamDomain.create(db, "team-1", "verified.example.com");
		await TeamDomain.markVerified(db, domain.id);

		let logger = new BatchedLogger("test");

		await container.scope(async () => {
			let job = new EnqueuePendingDomainsJob({ logger }, {});
			await job.perform();
		});

		expect(sendBatchMock).not.toHaveBeenCalled();
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

		expect(sendBatchMock).toHaveBeenCalledTimes(1);
		let messages = sendBatchCalls[0]!;
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
