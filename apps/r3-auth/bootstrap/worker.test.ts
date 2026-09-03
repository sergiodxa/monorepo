/**
 * Tests for the worker's cron and queue handlers: the cron enqueues the
 * sweep only for its own expression, and the queue acks a body it cannot
 * read on the first try, since a schema mismatch persists across
 * redeliveries.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database as DataTableDatabase } from "remix/data-table";

import { createEnv, createExecutionContext, createQueue } from "@sdxc/cloudflare-mocks";
import { Database } from "remix/data-table";
import { beforeEach, describe, expect, test, vi } from "vitest";

/** The queue the cron produces into. */
let queue = createQueue({ name: "auth" });

/** Collects the work the worker defers, so a test can await what it started. */
let context = createExecutionContext();

/**
 * Runs at module scope, before the dynamic worker import below resolves
 * `cloudflare:workers`, so that import sees this mock already registered.
 */
vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Env>({
		QUEUE: queue,
		/**
		 * Undefined here so the job skips its uptime ping, keeping every test
		 * in this file off the network.
		 */
		UPTIME_CRON_API_KEY: undefined,
	}),
	/**
	 * Reads `context` at call time, so reassigning it between tests takes
	 * effect here.
	 */
	waitUntil(promise: Promise<unknown>) {
		context.waitUntil(promise);
	},
}));

/**
 * The worker under test, imported once here at module scope. It reaches the
 * whole application graph, so loading it up front keeps that cost off each
 * test's own time budget.
 */
let { default: worker } = await import("~/bootstrap/worker");

let db: DataTableDatabase;
let subjectId: string;
let clientId: string;

/**
 * Delivers a batch to the worker's queue handler and reports each message's
 * disposition. Hands `context` to `consume` so the pass waits for the
 * sweep's `waitUntil` ack to land before reading dispositions.
 */
async function deliver(...bodies: unknown[]) {
	for (let body of bodies) await queue.send(body);

	return queue.consume(
		(batch) => worker.queue?.(batch as unknown as Parameters<NonNullable<typeof worker.queue>>[0]),
		{ context },
	);
}

async function schedule(cron: string) {
	await worker.scheduled?.({
		cron,
		scheduledTime: Date.now(),
		noRetry() {},
	} as unknown as Parameters<NonNullable<typeof worker.scheduled>>[0]);

	await context.settled();
}

beforeEach(async () => {
	queue.reset();
	context = createExecutionContext();

	let { createTestDatabase } = await import("~/app/lib/test/db");
	let { container } = await import("~/app/lib/container");
	let Client = (await import("~/app/data/client")).default;
	let Subject = (await import("~/app/data/subject")).default;

	db = createTestDatabase().db;
	/**
	 * Replaces the D1-backed registration, so the worker under test resolves
	 * this database through the same container it opens a scope on.
	 */
	container.singleton(Database, () => db);

	let client = await Client.create(db, {
		name: "Client App",
		redirect_uri: "https://client.example.com/callback",
		logout_uri: "https://client.example.com/logout",
	});
	let subject = await Subject.create(db, {
		email_address: "jane@example.com",
		display_name: "Jane Doe",
		username: "jane",
		avatar: "https://example.com/jane.png",
	});

	clientId = client.id;
	subjectId = subject.id;
});

async function createSession(expiresAt: number): Promise<string> {
	let { generateUUID } = await import("@sdxc/uuid");
	let { sessions } = await import("~/database/schema");

	let session = await db.create(
		sessions,
		{
			id: generateUUID(),
			subject_id: subjectId,
			client_id: clientId,
			ip_address: null,
			user_agent: null,
			expires_at: expiresAt,
		},
		{ touch: true, returnRow: true },
	);

	return session.id;
}

describe("scheduled", () => {
	test("enqueues the sweep on the daily trigger", async () => {
		await schedule("0 0 * * *");
		expect(queue.messages.map((message) => message.body)).toEqual([
			{ type: "cleanExpiredSessions" },
		]);
	});

	test("enqueues nothing for any other trigger", async () => {
		await schedule("*/5 * * * *");
		await schedule("0 1 * * *");
		expect(queue.messages).toEqual([]);
	});
});

describe("queue", () => {
	test("runs the sweep for a valid message", async () => {
		let expired = await createSession(Date.now() - 1000);
		let live = await createSession(Date.now() + 60 * 1000);

		let result = await deliver({ type: "cleanExpiredSessions" });

		let { sessions } = await import("~/database/schema");
		let remaining = (await db.findMany(sessions)).map((row) => row.id);
		expect(remaining).toEqual([live]);
		expect(remaining).not.toContain(expired);
		expect(result.acked).toHaveLength(1);
		expect(result.retried).toHaveLength(0);
	});

	test("acks an unknown message type without running anything", async () => {
		let expired = await createSession(Date.now() - 1000);

		let result = await deliver({ type: "somethingElse" });

		let { sessions } = await import("~/database/schema");
		expect((await db.findMany(sessions)).map((row) => row.id)).toEqual([expired]);
		expect(result.acked).toHaveLength(1);
		expect(result.retried).toHaveLength(0);
	});

	test("acks a body that is not an object at all", async () => {
		let result = await deliver(null, "cleanExpiredSessions", 7, { nope: true });

		expect(result.acked).toHaveLength(4);
		expect(result.retried).toHaveLength(0);
	});

	test("processes the valid messages of a mixed batch", async () => {
		let expired = await createSession(Date.now() - 1000);

		let result = await deliver({ type: "nope" }, { type: "cleanExpiredSessions" });

		let { sessions } = await import("~/database/schema");
		expect(await db.count(sessions)).toBe(0);
		expect(expired).toBeTruthy();
		expect(result.acked).toHaveLength(2);
		expect(result.retried).toHaveLength(0);
	});
});
