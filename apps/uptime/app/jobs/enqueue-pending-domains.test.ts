/**
 * Unit tests for the `enqueuePendingDomains` job: verifies it batches one
 * `verifyDomainOwnership` message per unverified team domain and skips the
 * queue call when nothing is pending. `QUEUE` is an in-memory queue mocked
 * via `vi.doMock("cloudflare:workers", ...)` since the job calls
 * `env.QUEUE.sendBatch` directly.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { QueueMock } from "@sdxc/cloudflare-mocks";

import { createEnv, createQueue } from "@sdxc/cloudflare-mocks";
import { createJobContext } from "@sdxc/jobs";
import { Log } from "@sdxc/logger";
import { beforeEach, describe, expect, test, vi } from "vitest";

/**
 * The queue the job enqueues through. It lives at module scope because the
 * module under test captures `env` on import, so `beforeEach` resets this
 * same instance.
 */
let queue: QueueMock = createQueue({ name: "verify-domains" });

/** A spy on `sendBatch` distinguishes zero calls from a call sending nothing. */
let sendBatch = vi.spyOn(queue, "sendBatch");

vi.doMock("cloudflare:workers", () => ({ env: createEnv<Env>({ QUEUE: queue }) }));

let TeamDomain = (await import("~/app/data/team-domain")).default;
let { createTestDatabase } = await import("~/app/lib/test/db");
let jobs = (await import("~/app/jobs")).default;
let { Database } = await import("~/app/jobs/middleware/database");
let enqueuePendingDomains = (await import("./enqueue-pending-domains")).default;

describe("enqueuePendingDomains", () => {
	let db: ReturnType<typeof createTestDatabase>["db"];

	beforeEach(() => {
		({ db } = createTestDatabase());
		queue.reset();
		sendBatch.mockClear();
	});

	/** Runs the handler over a context carrying the test's database, and returns its record. */
	async function run() {
		let record: Record<string, unknown> = {};
		let log = new Log({ kind: "job", sink: (emitted) => void (record = emitted) });
		let ctx = createJobContext(jobs.enqueuePendingDomains, {
			id: "message-1",
			attempts: 1,
			log,
		});
		ctx.set(Database, db, { property: "database" });
		await enqueuePendingDomains(ctx);
		log.emit();
		return record;
	}

	test("does nothing when there are no unverified domains", async () => {
		let domain = await TeamDomain.create(db, "team-1", "verified.example.com");
		await TeamDomain.markVerified(db, domain.id);

		let record = await run();

		expect(sendBatch).not.toHaveBeenCalled();
		expect(queue.sent).toHaveLength(0);
		expect(record).toMatchObject({ "domains.enqueued": 0 });
	});

	test("batches one verifyDomainOwnership message per unverified domain", async () => {
		let first = await TeamDomain.create(db, "team-1", "pending-one.example.com");
		let second = await TeamDomain.create(db, "team-1", "pending-two.example.com");
		let verified = await TeamDomain.create(db, "team-1", "verified.example.com");
		await TeamDomain.markVerified(db, verified.id);

		let record = await run();

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

		expect(record).toMatchObject({ "domains.enqueued": 2 });
	});
});
