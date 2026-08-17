/**
 * Tests for the worker's cron and queue handlers. The cron must enqueue the sweep for its
 * own expression and nothing else, and the queue must run the job a valid message names
 * while acking — never retrying — a body it cannot read, since a body that matches no
 * schema will not match one on a redelivery either.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database as DataTableDatabase } from "remix/data-table";

import { createEnv, createExecutionContext, createQueue } from "@pkg/cloudflare-mocks";
import { Database } from "remix/data-table";
import { beforeEach, describe, expect, test, vi } from "vitest";

/** The queue the cron produces into, holding what it enqueued. */
let queue = createQueue({ name: "auth" });

/** Collects the work the worker defers, so a test can await what it started. */
let context = createExecutionContext();

// Registered here, at module scope, because only the imports that run afterwards see it —
// which is why the worker below is imported dynamically rather than statically.
vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Env>({
		QUEUE: queue,
		// Left unset on purpose: with no token the job skips its uptime ping, so no
		// test in this file reaches the network.
		UPTIME_CRON_API_KEY: undefined,
	}),
	waitUntil(promise: Promise<unknown>) {
		// Read at call time, so replacing the context between tests takes effect here.
		context.waitUntil(promise);
	},
}));

/**
 * The worker under test, pulled in once here rather than inside each helper: it reaches the
 * whole application graph, and loading that graph on first use would spend a test's own time
 * budget on work no test is measuring.
 */
let { default: worker } = await import("~/bootstrap/worker");

let db: DataTableDatabase;
let subjectId: string;
let clientId: string;

/**
 * Delivers a batch to the worker's queue handler and reports what it did with each message.
 *
 * The sweep acks from inside a `waitUntil` promise, so the context is handed to `consume`:
 * without it the pass would read dispositions before that work ran and ack on the handler's
 * behalf, hiding whether it ever acked.
 */
async function deliver(...bodies: unknown[]) {
	for (let body of bodies) await queue.send(body);

	return queue.consume(
		(batch) => worker.queue?.(batch as unknown as Parameters<NonNullable<typeof worker.queue>>[0]),
		{ context },
	);
}

/** Delivers a cron trigger to the worker's scheduled handler. */
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
	// Replaces the D1-backed registration, so the job under test resolves this database
	// through the same container the worker opens a scope on.
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

/** Inserts a session row expiring at the given instant. */
async function createSession(expiresAt: number): Promise<string> {
	let { generateUUID } = await import("@pkg/uuid");
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
		// Nothing ran, so the expired row is still there.
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
