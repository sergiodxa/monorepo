/**
 * Tests for the daily session sweep, run against the real schema: it must delete every
 * row whose expiry has passed, leave every live row alone, and leave the table untouched
 * when nothing has expired.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Job } from "@pkg/jobs";
import type { Database as DataTableDatabase } from "remix/data-table";

import { ServiceContainer } from "@pkg/service-container";
import { generateUUID } from "@pkg/uuid";
import { Database } from "remix/data-table";
import { beforeEach, describe, expect, test } from "vitest";

import Client from "~/app/data/client";
import Subject from "~/app/data/subject";
import { CleanExpiredSessionsJob } from "~/app/jobs/clean-expired-sessions";
import { createTestDatabase } from "~/app/lib/test/db";
import { sessions } from "~/database/schema";

/** The message shape the job lifecycle consumes, taken from the runner's own signature. */
type QueuedMessage = Parameters<typeof Job.run>[0]["message"];

let db: DataTableDatabase;
let container: ServiceContainer;
let subjectId: string;
let clientId: string;

/** A queue message that records whether the job acked or retried it. */
function createMessage(): QueuedMessage & { acked: boolean; retried: boolean } {
	let message = {
		id: "message-1",
		timestamp: new Date(),
		body: { type: "cleanExpiredSessions" },
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

	return message as unknown as QueuedMessage & { acked: boolean; retried: boolean };
}

/**
 * Inserts a session row expiring at the given instant, written straight through the table
 * so the expiry can sit in the past, which is the case the sweep is about.
 */
async function createSession(expiresAt: number): Promise<string> {
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

/** Runs the job inside a container scope holding the test database. */
async function run(): Promise<ReturnType<typeof createMessage>> {
	let message = createMessage();
	await container.scope(() => CleanExpiredSessionsJob.run({ message }));
	return message;
}

beforeEach(async () => {
	db = createTestDatabase().db;

	container = new ServiceContainer();
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

describe("CleanExpiredSessionsJob", () => {
	test("keeps the monitor id the cron monitor already watches", () => {
		expect(CleanExpiredSessionsJob.monitorId).toBe("74f508a2-e6e9-4f01-8c25-2884330e7870");
	});

	test("deletes expired sessions and keeps live ones", async () => {
		let expired = await createSession(Date.now() - 1000);
		let alsoExpired = await createSession(Date.now() - 30 * 24 * 60 * 60 * 1000);
		let live = await createSession(Date.now() + 60 * 1000);

		let message = await run();

		let remaining = await db.findMany(sessions);
		expect(remaining.map((row) => row.id)).toEqual([live]);
		expect(remaining.map((row) => row.id)).not.toContain(expired);
		expect(remaining.map((row) => row.id)).not.toContain(alsoExpired);
		expect(message.acked).toBe(true);
		expect(message.retried).toBe(false);
	});

	test("does nothing when no session has expired", async () => {
		let live = await createSession(Date.now() + 60 * 1000);

		let message = await run();

		expect((await db.findMany(sessions)).map((row) => row.id)).toEqual([live]);
		expect(message.acked).toBe(true);
	});

	test("acks an empty database", async () => {
		let message = await run();

		expect(await db.count(sessions)).toBe(0);
		expect(message.acked).toBe(true);
	});
});
