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
 * The notification cases are about the opposite property: telling a destroyed team's other members
 * must never touch the row. A member the fake auth server refuses, and a notice the transport
 * rejects, both have to leave the deletion finished and the request gone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { NormalizedMessage, Transport } from "@pkg/mail";
import type { PolarClient } from "@pkg/polar";
import type { Database } from "remix/data-table";

import { AuthSDK, SubjectNotFoundError } from "@pkg/auth-sdk";
import { BatchedLogger } from "@pkg/logger";
import { Mailer, MailError } from "@pkg/mail";
import { MemoryTransport } from "@pkg/mail/memory";
import { PolarClient as PolarClientClass } from "@pkg/polar";
import { failure, success } from "@pkg/result";
import { ServiceContainer } from "@pkg/service-container";
import { Database as DatabaseClass } from "remix/data-table";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { SelectTeam } from "~/database/schema";

import AccountDeletion from "~/app/data/account-deletion";
import { MAIL_FROM } from "~/app/emails/sender";
import { TeamDeletedEmail } from "~/app/emails/team-deleted";
import { DeleteAccountsJob } from "~/app/jobs/delete-accounts";
import { createTestDatabase } from "~/app/lib/test/db";
import { polarSubscription } from "~/app/lib/test/polar";
import { memberships, monitors, teams } from "~/database/schema";

let transport = new MemoryTransport();

/**
 * Addresses the fake auth server can produce, by subject id. A subject with no entry is one whose
 * profile fails to resolve, which is how the "notify everybody you could" rule is exercised.
 */
let addresses = new Map<string, string>();

/** Whether the fake auth server's client-credentials exchange succeeds at all. */
let authenticates = true;

/** A transport that accepts nothing, for the cases about what a failed send must not do. */
class RefusingTransport implements Transport {
	async send() {
		return failure(new MailError("provider unavailable"));
	}
}

/**
 * A transport that records everything but rejects the messages a predicate picks out, so a member
 * notice can fail while the account holder's confirmation still goes through.
 */
class SelectiveTransport implements Transport {
	messages: NormalizedMessage[] = [];
	#refuses: (message: NormalizedMessage) => boolean;

	constructor(refuses: (message: NormalizedMessage) => boolean) {
		this.#refuses = refuses;
	}

	async send(message: NormalizedMessage) {
		this.messages.push(message);
		if (this.#refuses(message)) return failure(new MailError("provider unavailable"));
		return success({ messageId: message.messageId });
	}
}

/**
 * The auth server as this job sees it: one profile lookup per former member, answering only for
 * the addresses a test seeded.
 */
function fakeSdk(): AuthSDK {
	return {
		authenticate: async () =>
			authenticates ? success("token") : failure(new Error("auth server unavailable")),
		fetchSubjectById: async (subjectId: string) => {
			let email = addresses.get(subjectId);
			if (!email) return failure(new SubjectNotFoundError(subjectId));

			return success({
				id: subjectId,
				createdAt: new Date("2026-01-01T00:00:00Z"),
				updatedAt: new Date("2026-01-01T00:00:00Z"),
				displayName: `User ${subjectId}`,
				avatar: "",
				role: "user",
				username: subjectId,
				emailAddress: email,
			});
		},
	} as unknown as AuthSDK;
}

/** The addresses every `TeamDeletedEmail` this run produced was sent to. */
function notifiedAddresses(messages: readonly NormalizedMessage[]) {
	return messages
		.filter((message) => message.email instanceof TeamDeletedEmail)
		.flatMap((message) => message.to.map((address) => address.email))
		.sort();
}

/** A Polar client that reports one active subscription and accepts its revocation. */
function createFakePolar() {
	return {
		listActiveSubscriptions: vi.fn(async () => [polarSubscription()]),
		revokeSubscription: vi.fn(async () => polarSubscription({ status: "revoked" })),
	};
}

/** A Polar client that is unreachable, which must abort an erasure with nothing deleted. */
function createFailingPolar() {
	return {
		listActiveSubscriptions: vi.fn(async () => {
			throw new Error("Polar unavailable");
		}),
		revokeSubscription: vi.fn(async () => polarSubscription()),
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
	container.instance(AuthSDK, fakeSdk());

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
	addresses = new Map();
	authenticates = true;
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
		polar.listActiveSubscriptions = vi.fn(async () => []);
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

	test("mails every other member of a destroyed team, and never the account being deleted", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db, { name: "Acme" });
		await addMember(db, team.id, "subject-1");
		await addMember(db, team.id, "colleague-1", "member");
		await addMember(db, team.id, "colleague-2", "admin");
		// Seeded on purpose: the owner is excluded by the rule, not by being unresolvable.
		addresses.set("subject-1", "ada@example.com");
		addresses.set("colleague-1", "one@example.com");
		addresses.set("colleague-2", "two@example.com");
		await AccountDeletion.enqueue(db, "subject-1", "ada@example.com");

		await runJob(db, createFakePolar());

		expect(notifiedAddresses(transport.messages)).toEqual(["one@example.com", "two@example.com"]);

		let notice = transport.find((message) => message.email instanceof TeamDeletedEmail);
		expect(notice?.subject).toBe("Acme has been deleted on Uptime");
		expect(await AccountDeletion.findBySubjectId(db, "subject-1")).toBeNull();
	});

	test("notifies nobody for a team the deleted account was the only member of", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		await addMember(db, team.id, "subject-1");
		addresses.set("subject-1", "ada@example.com");
		await AccountDeletion.enqueue(db, "subject-1", "ada@example.com");

		await runJob(db, createFakePolar());

		expect(notifiedAddresses(transport.messages)).toEqual([]);
		// Only the account holder's own confirmation.
		expect(transport.messages).toHaveLength(1);
	});

	test("notifies nobody when the deleted account owned no team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db, { owner_id: "owner-2" });
		await addMember(db, team.id, "owner-2");
		await addMember(db, team.id, "subject-1", "member");
		await addMember(db, team.id, "colleague-1", "member");
		addresses.set("owner-2", "owner@example.com");
		addresses.set("colleague-1", "one@example.com");
		await AccountDeletion.enqueue(db, "subject-1", "ada@example.com");

		await runJob(db, createFakePolar());

		// The team survives, so nobody lost anything and nobody is told anything.
		expect(notifiedAddresses(transport.messages)).toEqual([]);
		expect(transport.messages).toHaveLength(1);
	});

	test("skips a member the identity provider cannot resolve and still mails the rest", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		await addMember(db, team.id, "subject-1");
		await addMember(db, team.id, "colleague-1", "member");
		await addMember(db, team.id, "colleague-2", "member");
		// No address for colleague-1: the auth server refuses that subject.
		addresses.set("colleague-2", "two@example.com");
		await AccountDeletion.enqueue(db, "subject-1", "ada@example.com");

		await runJob(db, createFakePolar());

		expect(notifiedAddresses(transport.messages)).toEqual(["two@example.com"]);
		expect(await AccountDeletion.findBySubjectId(db, "subject-1")).toBeNull();
	});

	test("finishes the deletion when the auth server cannot be reached at all", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		await addMember(db, team.id, "subject-1");
		await addMember(db, team.id, "colleague-1", "member");
		addresses.set("colleague-1", "one@example.com");
		authenticates = false;
		await AccountDeletion.enqueue(db, "subject-1", "ada@example.com");

		await runJob(db, createFakePolar());

		expect(notifiedAddresses(transport.messages)).toEqual([]);
		expect(await db.findOne(teams, { where: { id: team.id } })).toBeNull();
		expect(await AccountDeletion.findBySubjectId(db, "subject-1")).toBeNull();
	});

	/**
	 * The rule the whole ordering rests on: by the time a notice is sent the data is already gone,
	 * so keeping the row to retry it would strand a deleted person's request over somebody else's
	 * bounce — and tomorrow's run could not resend it anyway, the memberships being gone.
	 */
	test("a member notice the transport refuses does not keep the request queued", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		await addMember(db, team.id, "subject-1");
		await addMember(db, team.id, "colleague-1", "member");
		addresses.set("colleague-1", "one@example.com");
		await AccountDeletion.enqueue(db, "subject-1", "ada@example.com");

		let selective = new SelectiveTransport((message) => message.email instanceof TeamDeletedEmail);
		await runJob(db, createFakePolar(), selective);

		// It was attempted, and refused.
		expect(notifiedAddresses(selective.messages)).toEqual(["one@example.com"]);
		// And the deletion is finished all the same.
		expect(await db.findOne(teams, { where: { id: team.id } })).toBeNull();
		expect(await AccountDeletion.findBySubjectId(db, "subject-1")).toBeNull();
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
			listActiveSubscriptions: vi.fn(async (externalCustomerId: string) => {
				if (externalCustomerId === "subject-1") throw new Error("Polar unavailable");
				return [];
			}),
			revokeSubscription: vi.fn(async () => polarSubscription()),
		};

		await runJob(db, polar);

		expect(await db.findOne(teams, { where: { id: first.id } })).not.toBeNull();
		expect(await AccountDeletion.findBySubjectId(db, "subject-1")).not.toBeNull();

		expect(await db.findOne(teams, { where: { id: second.id } })).toBeNull();
		expect(await AccountDeletion.findBySubjectId(db, "subject-2")).toBeNull();
	});
});
