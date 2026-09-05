/**
 * Tests for the daily session sweep, run against the real schema: it must delete every
 * row whose expiry has passed, leave every live row alone, and leave the table untouched
 * when nothing has expired. The handler is a function over a context, so each test builds
 * one and hands it the database itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database as DataTableDatabase } from "remix/data-table";

import { createJobContext } from "@sdxc/jobs";
import { Log } from "@sdxc/logger";
import { generateUUID } from "@sdxc/uuid";
import { beforeEach, describe, expect, test } from "vitest";

import Client from "~/app/data/client";
import Subject from "~/app/data/subject";
import jobs from "~/app/jobs";
import handler from "~/app/jobs/clean-expired-sessions";
import { Database } from "~/app/jobs/middleware/database";
import { createTestDatabase } from "~/app/lib/test/db";
import { sessions } from "~/database/schema";

let db: DataTableDatabase;
let subjectId: string;
let clientId: string;

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

/**
 * Runs the sweep against a context carrying the test database, published the way the
 * middleware publishes it: the cast is what stands in for a chain having run. The run is
 * recorded into a log the caller can read back.
 *
 * @returns The record the run emitted.
 */
async function run(): Promise<Record<string, unknown>> {
	let records: Record<string, unknown>[] = [];
	let log = new Log({ kind: "job", sink: (record) => void records.push(record) });
	let ctx = createJobContext(jobs.cleanExpiredSessions, { id: "message-1", attempts: 1, log });
	ctx.set(Database, db, { property: "database" });

	await log.run(() => handler(ctx));

	return records[0]!;
}

beforeEach(async () => {
	db = createTestDatabase().db;

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

describe("cleanExpiredSessions", () => {
	test("keeps the monitor id the cron monitor already watches", () => {
		expect(jobs.cleanExpiredSessions.monitorId).toBe("74f508a2-e6e9-4f01-8c25-2884330e7870");
	});

	test("deletes expired sessions and keeps live ones", async () => {
		let expired = await createSession(Date.now() - 1000);
		let alsoExpired = await createSession(Date.now() - 30 * 24 * 60 * 60 * 1000);
		let live = await createSession(Date.now() + 60 * 1000);

		let record = await run();

		let remaining = await db.findMany(sessions);
		expect(remaining.map((row) => row.id)).toEqual([live]);
		expect(record).toMatchObject({ outcome: "ok", "sessions.expired": 2, "sessions.deleted": 2 });
		expect(remaining.map((row) => row.id)).not.toContain(expired);
		expect(remaining.map((row) => row.id)).not.toContain(alsoExpired);
	});

	test("does nothing when no session has expired", async () => {
		let live = await createSession(Date.now() + 60 * 1000);

		let record = await run();

		expect((await db.findMany(sessions)).map((row) => row.id)).toEqual([live]);
		expect(record).toMatchObject({ "sessions.expired": 0 });
		expect(record).not.toHaveProperty("sessions.deleted");
	});

	test("leaves an empty table alone", async () => {
		await run();

		expect(await db.count(sessions)).toBe(0);
	});
});
