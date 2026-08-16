/**
 * Tests for the worker's cron and queue handlers. The cron must enqueue the sweep for its
 * own expression and nothing else, and the queue must run the job a valid message names
 * while acking — never retrying — a body it cannot read, since a body that matches no
 * schema will not match one on a redelivery either.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { Database as DataTableDatabase } from "remix/data-table";

import { createEnv, createQueue } from "@pkg/cloudflare-mocks";
import { Database } from "remix/data-table";

/** The queue the cron produces into, holding what it enqueued. */
let queue = createQueue();

/** Promises handed to `waitUntil`, so a test can await the work it started. */
let pending: Promise<unknown>[] = [];

mock.module("cloudflare:workers", () => ({
	env: createEnv<Env>({
		QUEUE: queue,
		// Left unset on purpose: with no token the job skips its uptime ping, so no
		// test in this file reaches the network.
		UPTIME_CRON_API_KEY: undefined,
	}),
	waitUntil(promise: Promise<unknown>) {
		pending.push(promise);
	},
}));

let db: DataTableDatabase;
let subjectId: string;
let clientId: string;

/**
 * A queue message that records the disposition the handler chose for it.
 *
 * Delivery is driven by hand rather than through the queue binding, because the sweep is
 * acked from inside a `waitUntil` promise: a driver that settles dispositions when the
 * batch handler returns would ack on the handler's behalf and hide whether it ever did.
 */
function createMessage(body: unknown) {
	let message = {
		id: "message-1",
		timestamp: new Date(),
		body,
		attempts: 1,
		acked: false,
		retried: false,
		ack() {
			message.acked = true;
		},
		retry() {
			message.retried = true;
		},
	};

	return message;
}

/** Delivers a batch to the worker's queue handler and waits for the work it started. */
async function deliver(...bodies: unknown[]) {
	let { default: worker } = await import("~/bootstrap/worker");
	let messages = bodies.map(createMessage);

	await worker.queue?.({ queue: "auth", messages } as unknown as Parameters<
		NonNullable<typeof worker.queue>
	>[0]);

	await Promise.all(pending);

	return messages;
}

/** Delivers a cron trigger to the worker's scheduled handler. */
async function schedule(cron: string) {
	let { default: worker } = await import("~/bootstrap/worker");

	await worker.scheduled?.({
		cron,
		scheduledTime: Date.now(),
		noRetry() {},
	} as unknown as Parameters<NonNullable<typeof worker.scheduled>>[0]);

	await Promise.all(pending);
}

beforeEach(async () => {
	queue.reset();
	pending = [];

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

		let [message] = await deliver({ type: "cleanExpiredSessions" });

		let { sessions } = await import("~/database/schema");
		let remaining = (await db.findMany(sessions)).map((row) => row.id);
		expect(remaining).toEqual([live]);
		expect(remaining).not.toContain(expired);
		expect(message?.acked).toBe(true);
		expect(message?.retried).toBe(false);
	});

	test("acks an unknown message type without running anything", async () => {
		let expired = await createSession(Date.now() - 1000);

		let [message] = await deliver({ type: "somethingElse" });

		let { sessions } = await import("~/database/schema");
		// Nothing ran, so the expired row is still there.
		expect((await db.findMany(sessions)).map((row) => row.id)).toEqual([expired]);
		expect(message?.acked).toBe(true);
		expect(message?.retried).toBe(false);
	});

	test("acks a body that is not an object at all", async () => {
		let messages = await deliver(null, "cleanExpiredSessions", 7, { nope: true });

		for (let message of messages) {
			expect(message.acked).toBe(true);
			expect(message.retried).toBe(false);
		}
	});

	test("processes the valid messages of a mixed batch", async () => {
		let expired = await createSession(Date.now() - 1000);

		let [invalid, valid] = await deliver({ type: "nope" }, { type: "cleanExpiredSessions" });

		let { sessions } = await import("~/database/schema");
		expect(await db.count(sessions)).toBe(0);
		expect(expired).toBeTruthy();
		expect(invalid?.acked).toBe(true);
		expect(valid?.acked).toBe(true);
	});
});
