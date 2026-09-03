/**
 * Tests the two halves of account erasure: the plan a person is shown before they confirm, and
 * the erasure itself.
 *
 * The cases that matter are the ones where the two ownership rules diverge — a non-owner's
 * deletion must leave the team standing for everybody else, an owner's must take it with them —
 * plus the ordering guarantee: a billing failure has to abort the whole thing with the data
 * still present, because the opposite leaves somebody billed for an account that no longer has
 * a billing page. Idempotence is asserted by running the erasure twice.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Billing } from "@pkg/billing";
import type { Database } from "remix/data-table";

import { isFailure, isSuccess, unwrap } from "@pkg/result";
import { describe, expect, test } from "vitest";

import type { SelectTeam } from "~/database/schema";

import Lead from "~/app/data/lead";
import Subscription from "~/app/data/subscription";
import { MONITORING_PRODUCT } from "~/app/lib/billing";
import { createTestBilling, entitlementState } from "~/app/lib/test/billing";
import { createTestDatabase } from "~/app/lib/test/db";
import { eraseAccount, planAccountErasure } from "~/app/services/account-erasure";
import {
	invites,
	memberships,
	monitors,
	subscriptions,
	teams,
	userPreferences,
} from "~/database/schema";

const SUBJECT = "subject-1";
const EMAIL = "ada@example.com";

/**
 * A platform that knows the subject. `subscribed` sells them the monitoring product, so the
 * cancellation the erasure performs has something real to end and its count means something.
 */
async function createBilling(subscribed = false) {
	let billing = createTestBilling();
	let customer = await unwrap(billing.customers.create({ email: EMAIL, externalId: SUBJECT }));

	if (subscribed) {
		let opened = await unwrap(
			billing.checkouts.create({ product: MONITORING_PRODUCT, customer: { id: customer.id } }),
		);
		await unwrap(billing.checkouts.finish(opened.id));
	}

	return billing;
}

/** A platform that cannot be read, which is the case the ordering exists for. */
async function createFailingBilling(): Promise<Billing> {
	let billing = await createBilling(true);

	billing.fail("subscriptions.list", "unknown");

	return billing;
}

async function createTeamRow(db: Database, overrides: Partial<SelectTeam> = {}) {
	return await db.create(
		teams,
		{
			id: crypto.randomUUID(),
			owner_id: SUBJECT,
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

describe("planAccountErasure", () => {
	test("warns about nothing when the subject owns no team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db, { owner_id: "someone-else" });
		await addMember(db, team.id, SUBJECT, "member");
		await addMember(db, team.id, "someone-else", "admin");

		let plan = await planAccountErasure(db, SUBJECT);

		expect(plan.ownedTeams).toHaveLength(0);
		expect(plan.joinedTeams).toHaveLength(1);
		expect(plan.joinedTeams[0]?.role).toBe("member");
		expect(plan.othersLosingAccess).toBe(0);
	});

	/**
	 * The personal-team case, which is most accounts. It must not produce a warning: a
	 * confirmation that cries wolf every time teaches people to click through the one that
	 * matters.
	 */
	test("counts no others for an owned team nobody else joined", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		await addMember(db, team.id, SUBJECT);

		let plan = await planAccountErasure(db, SUBJECT);

		expect(plan.ownedTeams).toHaveLength(1);
		expect(plan.ownedTeams[0]?.otherMemberCount).toBe(0);
		expect(plan.othersLosingAccess).toBe(0);
	});

	test("counts the other members of an owned team, excluding the subject, across every team", async () => {
		let { db } = createTestDatabase();
		let first = await createTeamRow(db, { name: "First" });
		let second = await createTeamRow(db, { name: "Second" });
		await addMember(db, first.id, SUBJECT);
		await addMember(db, first.id, "colleague-1", "member");
		await addMember(db, first.id, "colleague-2", "member");
		await addMember(db, second.id, SUBJECT);
		await addMember(db, second.id, "colleague-3", "admin");

		let plan = await planAccountErasure(db, SUBJECT);

		let byName = new Map(plan.ownedTeams.map((team) => [team.name, team.otherMemberCount]));
		expect(byName.get("First")).toBe(2);
		expect(byName.get("Second")).toBe(1);
		expect(plan.othersLosingAccess).toBe(3);
	});
});

describe("eraseAccount", () => {
	test("removes only the membership when the subject does not own the team, leaving it intact", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db, { owner_id: "owner-2" });
		await addMember(db, team.id, "owner-2", "admin");
		await addMember(db, team.id, SUBJECT, "member");
		let monitor = await db.create(
			monitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				author_id: "owner-2",
				name: "Homepage",
				url: "https://example.com",
			},
			{ touch: true, returnRow: true },
		);

		let result = await eraseAccount(db, await createBilling(), SUBJECT, EMAIL);

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) {
			expect(result.data.teamsDeleted).toBe(0);
			expect(result.data.membershipsRemoved).toBe(1);
		}

		expect(await db.findOne(teams, { where: { id: team.id } })).not.toBeNull();
		expect(await db.findOne(monitors, { where: { id: monitor.id } })).not.toBeNull();
		expect(
			await db.findOne(memberships, { where: { team_id: team.id, subject_id: "owner-2" } }),
		).not.toBeNull();
		expect(
			await db.findOne(memberships, { where: { team_id: team.id, subject_id: SUBJECT } }),
		).toBeNull();
	});

	test("deletes an owned team, its monitors and every membership on it, so other members lose access", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		await addMember(db, team.id, SUBJECT);
		await addMember(db, team.id, "colleague-1", "member");
		await db.create(
			monitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				author_id: SUBJECT,
				name: "Homepage",
				url: "https://example.com",
			},
			{ touch: true, returnRow: true },
		);

		let result = await eraseAccount(db, await createBilling(), SUBJECT, EMAIL);

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) expect(result.data.teamsDeleted).toBe(1);

		expect(await db.findOne(teams, { where: { id: team.id } })).toBeNull();
		expect(await db.count(monitors, { where: { team_id: team.id } })).toBe(0);
		expect(await db.count(memberships, { where: { team_id: team.id } })).toBe(0);
	});

	/**
	 * The snapshot exists because the delete destroys the evidence: after `Team.deleteById` there
	 * is no row left saying who was in the team, so anything that wants to tell them has to be
	 * handed the ids by the erasure itself.
	 */
	test("reports the other members of each destroyed team, without the erased subject", async () => {
		let { db } = createTestDatabase();
		let first = await createTeamRow(db, { name: "First" });
		let second = await createTeamRow(db, { name: "Second" });
		await addMember(db, first.id, SUBJECT);
		await addMember(db, first.id, "colleague-1", "member");
		await addMember(db, first.id, "colleague-2", "admin");
		await addMember(db, second.id, SUBJECT);
		await addMember(db, second.id, "colleague-3", "member");

		let result = await eraseAccount(db, await createBilling(), SUBJECT, EMAIL);

		expect(isSuccess(result)).toBe(true);
		if (!isSuccess(result)) return;

		let byName = new Map(
			result.data.deletedTeams.map((team) => [team.teamName, [...team.memberIds].sort()]),
		);
		expect(byName.get("First")).toEqual(["colleague-1", "colleague-2"]);
		expect(byName.get("Second")).toEqual(["colleague-3"]);
		for (let ids of byName.values()) expect(ids).not.toContain(SUBJECT);
	});

	test("reports no destroyed team for an owned team nobody else joined", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		await addMember(db, team.id, SUBJECT);

		let result = await eraseAccount(db, await createBilling(), SUBJECT, EMAIL);

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) {
			expect(result.data.teamsDeleted).toBe(1);
			expect(result.data.deletedTeams).toEqual([]);
		}
	});

	test("reports no destroyed team when the subject only belonged to one", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db, { owner_id: "owner-2" });
		await addMember(db, team.id, "owner-2");
		await addMember(db, team.id, SUBJECT, "member");

		let result = await eraseAccount(db, await createBilling(), SUBJECT, EMAIL);

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) expect(result.data.deletedTeams).toEqual([]);
	});

	test("ends the subject's live subscriptions and clears the local projection", async () => {
		let { db } = createTestDatabase();
		let billing = await createBilling(true);
		await Subscription.sync(db, SUBJECT, entitlementState({ externalId: SUBJECT }));

		let result = await eraseAccount(db, billing, SUBJECT, EMAIL);

		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) expect(result.data.subscriptionsRevoked).toBe(1);

		let left = await unwrap(
			billing.subscriptions.list({
				customer: { externalId: SUBJECT },
				status: ["active", "trialing"],
			}),
		);
		expect(left.items).toEqual([]);
		expect(await db.count(subscriptions, { where: { external_customer_id: SUBJECT } })).toBe(0);
	});

	/**
	 * The ordering guarantee, and the one case worth failing loudly over: deleting the data of
	 * somebody still being billed leaves them paying for teams that no longer exist, with no
	 * billing page left to cancel from.
	 */
	test("aborts with nothing deleted when the subscription cannot be cancelled", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		await addMember(db, team.id, SUBJECT);
		await db.create(
			userPreferences,
			{ id: crypto.randomUUID(), subject_id: SUBJECT, preferred_language: "es" },
			{ touch: true, returnRow: true },
		);

		let result = await eraseAccount(db, await createFailingBilling(), SUBJECT, EMAIL);

		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) expect(result.error.message).toContain("Could not cancel billing");

		expect(await db.findOne(teams, { where: { id: team.id } })).not.toBeNull();
		expect(await db.count(memberships, { where: { subject_id: SUBJECT } })).toBe(1);
		expect(await db.count(userPreferences, { where: { subject_id: SUBJECT } })).toBe(1);
	});

	test("deletes the subject's preferences and the invitations mentioning them, in either direction", async () => {
		let { db } = createTestDatabase();
		let otherTeam = await createTeamRow(db, { owner_id: "owner-2" });
		await db.create(
			userPreferences,
			{ id: crypto.randomUUID(), subject_id: SUBJECT, preferred_language: "es" },
			{ touch: true, returnRow: true },
		);
		await db.create(
			invites,
			{
				id: crypto.randomUUID(),
				sender_id: "owner-2",
				team_id: otherTeam.id,
				email: EMAIL,
				accepted_at: null,
			},
			{ touch: true, returnRow: true },
		);
		await db.create(
			invites,
			{
				id: crypto.randomUUID(),
				sender_id: SUBJECT,
				team_id: otherTeam.id,
				email: "someone@example.com",
				accepted_at: null,
			},
			{ touch: true, returnRow: true },
		);

		await eraseAccount(db, await createBilling(), SUBJECT, EMAIL);

		expect(await db.count(userPreferences, { where: { subject_id: SUBJECT } })).toBe(0);
		expect(await db.count(invites, { where: { email: EMAIL } })).toBe(0);
		expect(await db.count(invites, { where: { sender_id: SUBJECT } })).toBe(0);
	});

	test("forgets the trial lead behind the same address, and is unbothered when there is none", async () => {
		let { db } = createTestDatabase();
		await Lead.upsertByEmail(db, { email: EMAIL, locale: "en", consented: false });

		await eraseAccount(db, await createBilling(), SUBJECT, EMAIL);
		expect(await Lead.findByEmail(db, EMAIL)).toBeNull();

		let second = await eraseAccount(db, await createBilling(), SUBJECT, EMAIL);
		expect(isSuccess(second)).toBe(true);
	});

	/**
	 * A failed sweep leaves the queued row in place, so tomorrow's run re-erases an account that
	 * is already half — or entirely — gone. Every step has to survive that.
	 */
	test("is idempotent: a second run over the same account is clean and does not throw", async () => {
		let { db } = createTestDatabase();
		let owned = await createTeamRow(db, { name: "Owned" });
		let joined = await createTeamRow(db, { name: "Joined", owner_id: "owner-2" });
		await addMember(db, owned.id, SUBJECT);
		await addMember(db, owned.id, "colleague-1", "member");
		await addMember(db, joined.id, SUBJECT, "member");
		await Subscription.sync(db, SUBJECT, entitlementState({ externalId: SUBJECT }));

		/** One platform across both runs, so the second really finds an already-ended account. */
		let billing = await createBilling(true);

		let first = await eraseAccount(db, billing, SUBJECT, EMAIL);
		expect(isSuccess(first)).toBe(true);
		if (isSuccess(first)) expect(first.data.subscriptionsRevoked).toBe(1);

		let second = await eraseAccount(db, billing, SUBJECT, EMAIL);

		expect(isSuccess(second)).toBe(true);
		if (isSuccess(second)) {
			expect(second.data.teamsDeleted).toBe(0);
			expect(second.data.membershipsRemoved).toBe(0);
			expect(second.data.subscriptionsRevoked).toBe(0);
			expect(second.data.deletedTeams).toEqual([]);
		}

		expect(await db.findOne(teams, { where: { id: owned.id } })).toBeNull();
		expect(await db.findOne(teams, { where: { id: joined.id } })).not.toBeNull();
	});
});
