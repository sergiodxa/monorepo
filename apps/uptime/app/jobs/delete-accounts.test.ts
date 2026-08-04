/**
 * Unit tests for `DeleteAccountsJob.perform()`.
 *
 * Every case here is really about the same property: the queued row is the only state, so what
 * matters is precisely when it survives and when it goes. It goes after the data is deleted and
 * the confirmation is accepted, and it survives a Polar failure (with nothing deleted) and a
 * transport failure (with the data already gone) — because in both of those tomorrow's run is
 * the retry, and there is no other one.
 *
 * The double-run test is the load-bearing one: a failed run leaves a half-erased account behind,
 * and re-erasing it must be clean rather than an exception.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { Transport } from "@pkg/mail";
import type { PolarClient } from "@pkg/polar";
import type { Database } from "remix/data-table";

import { BatchedLogger } from "@pkg/logger";
import { Mailer, MailError } from "@pkg/mail";
import { MemoryTransport } from "@pkg/mail/memory";
import { PolarClient as PolarClientClass } from "@pkg/polar";
import { failure } from "@pkg/result";
import { ServiceContainer } from "@pkg/service-container";
import { Database as DatabaseClass } from "remix/data-table";

import type { SelectTeam } from "~/database/schema";

import AccountDeletion from "~/app/data/account-deletion";
import { MAIL_FROM } from "~/app/emails/sender";
import { DeleteAccountsJob } from "~/app/jobs/delete-accounts";
import { createTestDatabase } from "~/app/lib/test/db";
import { polarSubscription } from "~/app/lib/test/polar";
import { memberships, monitors, teams } from "~/database/schema";

let transport = new MemoryTransport();

/** A transport that accepts nothing, for the cases about what a failed send must not do. */
class RefusingTransport implements Transport {
	async send() {
		return failure(new MailError("provider unavailable"));
	}
}

/** A Polar client that reports one active subscription and accepts its revocation. */
function createFakePolar() {
	return {
		listActiveSubscriptions: mock(async () => [polarSubscription()]),
		revokeSubscription: mock(async () => polarSubscription({ status: "revoked" })),
	};
}

/** A Polar client that is unreachable, which must abort an erasure with nothing deleted. */
function createFailingPolar() {
	return {
		listActiveSubscriptions: mock(async () => {
			throw new Error("Polar unavailable");
		}),
		revokeSubscription: mock(async () => polarSubscription()),
	};
}

async function runJob(
	db: Database,
	polar: { listActiveSubscriptions: unknown; revokeSubscription: unknown },
	mailTransport: Transport = transport,
) {
	let container = new ServiceContainer();
	container.singleton(DatabaseClass, () => db);
	container.singleton(Mailer, () => new Mailer({ transport: mailTransport, from: MAIL_FROM }));
	container.instance(PolarClientClass, polar as unknown as PolarClient);

	let job = new DeleteAccountsJob({ logger: new BatchedLogger("test") }, {});
	await container.scope(() => job.perform());
	return job;
}

async function createTeamRow(db: Database, overrides: Partial<SelectTeam> = {}) {
	return await db.create(
		teams,
		{
			id: crypto.randomUUID(),
			owner_id: "subject-1",
			name: "Acme",
			slug: `acme-${crypto.randomUUID()}`,
			logo: null,
			...overrides,
		},
		{ touch: true, returnRow: true },
	);
}

async function addMember(
	db: Database,
	teamId: string,
	subjectId: string,
	role: "member" | "admin" = "admin",
) {
	return await db.create(
		memberships,
		{ id: crypto.randomUUID(), team_id: teamId, subject_id: subjectId, role },
		{ touch: true, returnRow: true },
	);
}

beforeEach(() => {
	transport = new MemoryTransport();
});

describe("DeleteAccountsJob", () => {
	test("does nothing at all when the queue is empty", async () => {
		let { db } = createTestDatabase();
		let polar = createFakePolar();

		await runJob(db, polar);

		expect(polar.listActiveSubscriptions).not.toHaveBeenCalled();
		expect(transport.messages).toHaveLength(0);
	});

	test("erases a queued account, mails the confirmation, and only then drops the request", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		await addMember(db, team.id, "subject-1");
		await addMember(db, team.id, "colleague-1", "member");
		await db.create(
			monitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				author_id: "subject-1",
				name: "Homepage",
				url: "https://example.com",
			},
			{ touch: true, returnRow: true },
		);
		await AccountDeletion.enqueue(db, "subject-1", "ada@example.com");

		let polar = createFakePolar();
		await runJob(db, polar);

		expect(polar.revokeSubscription).toHaveBeenCalledTimes(1);
		expect(await db.findOne(teams, { where: { id: team.id } })).toBeNull();
		expect(await db.count(memberships, { where: { team_id: team.id } })).toBe(0);
		expect(await db.count(monitors, { where: { team_id: team.id } })).toBe(0);

		expect(transport.messages).toHaveLength(1);
		expect(transport.messages[0]?.subject).toBe("Your Uptime account has been deleted");

		// The request is gone, which is the only thing that says "finished".
		expect(await AccountDeletion.findBySubjectId(db, "subject-1")).toBeNull();
	});

	test("leaves a non-owner's teams standing and removes only their membership", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db, { owner_id: "owner-2" });
		await addMember(db, team.id, "owner-2");
		await addMember(db, team.id, "subject-1", "member");
		await AccountDeletion.enqueue(db, "subject-1", "ada@example.com");

		await runJob(db, createFakePolar());

		expect(await db.findOne(teams, { where: { id: team.id } })).not.toBeNull();
		expect(
			await db.findOne(memberships, { where: { team_id: team.id, subject_id: "owner-2" } }),
		).not.toBeNull();
		expect(
			await db.findOne(memberships, { where: { team_id: team.id, subject_id: "subject-1" } }),
		).toBeNull();
		expect(await AccountDeletion.findBySubjectId(db, "subject-1")).toBeNull();
	});

	/**
	 * The ordering guarantee, seen from the sweep: nothing may be deleted for somebody whose
	 * subscription is still live, because they would keep paying with no billing page left.
	 */
	test("keeps the request and deletes nothing when billing cannot be cancelled", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		await addMember(db, team.id, "subject-1");
		await AccountDeletion.enqueue(db, "subject-1", "ada@example.com");

		await runJob(db, createFailingPolar());

		expect(await db.findOne(teams, { where: { id: team.id } })).not.toBeNull();
		expect(await db.count(memberships, { where: { subject_id: "subject-1" } })).toBe(1);
		expect(transport.messages).toHaveLength(0);
		// Still queued, which is the retry: tomorrow's run tries again.
		expect(await AccountDeletion.findBySubjectId(db, "subject-1")).not.toBeNull();
	});

	test("keeps the request when the confirmation cannot be sent, even though the data is gone", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		await addMember(db, team.id, "subject-1");
		await AccountDeletion.enqueue(db, "subject-1", "ada@example.com");

		await runJob(db, createFakePolar(), new RefusingTransport());

		expect(await db.findOne(teams, { where: { id: team.id } })).toBeNull();
		// The row is the only copy of the address, so it has to outlive a refused send.
		expect(await AccountDeletion.findBySubjectId(db, "subject-1")).not.toBeNull();
	});

	/**
	 * Directly the state the previous test leaves behind: an account whose data is gone and whose
	 * request is still queued. The re-run must mail and finish rather than throw on rows that are
	 * no longer there.
	 */
	test("re-running over a half-erased account completes it instead of failing", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		await addMember(db, team.id, "subject-1");
		await AccountDeletion.enqueue(db, "subject-1", "ada@example.com");

		await runJob(db, createFakePolar(), new RefusingTransport());
		expect(await AccountDeletion.findBySubjectId(db, "subject-1")).not.toBeNull();

		let polar = createFakePolar();
		polar.listActiveSubscriptions = mock(async () => []);
		await runJob(db, polar);

		expect(polar.revokeSubscription).not.toHaveBeenCalled();
		expect(transport.messages).toHaveLength(1);
		expect(await AccountDeletion.findBySubjectId(db, "subject-1")).toBeNull();
	});

	test("running the sweep twice over the same account is clean the second time", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		await addMember(db, team.id, "subject-1");
		await addMember(db, team.id, "colleague-1", "member");
		await AccountDeletion.enqueue(db, "subject-1", "ada@example.com");

		await runJob(db, createFakePolar());
		expect(transport.messages).toHaveLength(1);

		// The queue is empty now, so the second run finds nothing and mails nothing.
		await runJob(db, createFakePolar());

		expect(transport.messages).toHaveLength(1);
		expect(await db.count(teams, { where: { id: team.id } })).toBe(0);
	});

	test("one failing request does not stop the others in the queue", async () => {
		let { db } = createTestDatabase();
		let first = await createTeamRow(db, { owner_id: "subject-1", name: "First" });
		let second = await createTeamRow(db, { owner_id: "subject-2", name: "Second" });
		await addMember(db, first.id, "subject-1");
		await addMember(db, second.id, "subject-2");
		await AccountDeletion.enqueue(db, "subject-1", "one@example.com", 1_000);
		await AccountDeletion.enqueue(db, "subject-2", "two@example.com", 2_000);

		// Fails for the first subject only, so the run has to carry on to the second.
		let polar = {
			listActiveSubscriptions: mock(async (externalCustomerId: string) => {
				if (externalCustomerId === "subject-1") throw new Error("Polar unavailable");
				return [];
			}),
			revokeSubscription: mock(async () => polarSubscription()),
		};

		await runJob(db, polar);

		expect(await db.findOne(teams, { where: { id: first.id } })).not.toBeNull();
		expect(await AccountDeletion.findBySubjectId(db, "subject-1")).not.toBeNull();

		expect(await db.findOne(teams, { where: { id: second.id } })).toBeNull();
		expect(await AccountDeletion.findBySubjectId(db, "subject-2")).toBeNull();
	});
});
