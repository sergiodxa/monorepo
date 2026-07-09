/**
 * Unit tests for the `Invite` data-access model: create/revoke, accepting an invite
 * (marking it accepted and creating the resulting membership as two sequential
 * writes), and the pending-invites list shown on the team settings page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test } from "bun:test";

import type { Database } from "remix/data-table";

import Invite from "~/app/data/invite";
import { createTestDatabase } from "~/app/lib/test/db";
import { invites, memberships } from "~/database/schema";

let db: Database;

beforeEach(() => {
	db = createTestDatabase().db;
});

describe("Invite.create", () => {
	test("creates a pending invite for an email on a team", async () => {
		let invite = await Invite.create(db, "team-1", "sender-1", "new@example.com");

		expect(invite.id).toBeTruthy();
		expect(invite.team_id).toBe("team-1");
		expect(invite.sender_id).toBe("sender-1");
		expect(invite.email).toBe("new@example.com");
		expect(invite.accepted_at).toBeNull();
		expect(typeof invite.created_at).toBe("number");
	});
});

describe("Invite.findByEmailForTeam", () => {
	test("finds a pending invite by team and email", async () => {
		let invite = await Invite.create(db, "team-1", "sender-1", "new@example.com");

		expect(await Invite.findByEmailForTeam(db, "team-1", "new@example.com")).toEqual(invite);
	});

	test("also finds an already-accepted invite", async () => {
		let invite = await Invite.create(db, "team-1", "sender-1", "new@example.com");
		await Invite.accept(db, invite.id, "team-1", "subject-1");

		let found = await Invite.findByEmailForTeam(db, "team-1", "new@example.com");
		expect(found?.accepted_at).not.toBeNull();
	});

	test("returns null when no invite matches the team and email", async () => {
		await Invite.create(db, "team-1", "sender-1", "new@example.com");

		expect(await Invite.findByEmailForTeam(db, "team-2", "new@example.com")).toBeNull();
		expect(await Invite.findByEmailForTeam(db, "team-1", "nobody@example.com")).toBeNull();
	});
});

describe("Invite.findByIdForTeam", () => {
	test("finds an invite scoped to its team", async () => {
		let invite = await Invite.create(db, "team-1", "sender-1", "new@example.com");

		expect(await Invite.findByIdForTeam(db, "team-1", invite.id)).toEqual(invite);
	});

	test("returns null when the invite belongs to a different team", async () => {
		let invite = await Invite.create(db, "team-1", "sender-1", "new@example.com");

		expect(await Invite.findByIdForTeam(db, "team-2", invite.id)).toBeNull();
	});

	test("returns null for a missing id", async () => {
		expect(await Invite.findByIdForTeam(db, "team-1", "missing")).toBeNull();
	});
});

describe("Invite.findById", () => {
	test("finds an invite by id regardless of team, for the public accept page", async () => {
		let invite = await Invite.create(db, "team-1", "sender-1", "new@example.com");

		expect(await Invite.findById(db, invite.id)).toEqual(invite);
	});

	test("returns null for a missing id", async () => {
		expect(await Invite.findById(db, "missing")).toBeNull();
	});
});

describe("Invite.listPendingByTeam", () => {
	test("lists only not-yet-accepted invites for the team, newest first", async () => {
		let pendingFirst = await Invite.create(db, "team-1", "sender-1", "first@example.com");
		let pendingSecond = await Invite.create(db, "team-1", "sender-1", "second@example.com");
		let accepted = await Invite.create(db, "team-1", "sender-1", "accepted@example.com");
		await Invite.accept(db, accepted.id, "team-1", "subject-1");
		await Invite.create(db, "team-2", "sender-1", "other-team@example.com");

		await db.update(invites, pendingFirst.id, { created_at: Date.now() - 60_000 });

		let pending = await Invite.listPendingByTeam(db, "team-1");
		expect(pending.map((invite) => invite.id)).toEqual([pendingSecond.id, pendingFirst.id]);
	});

	test("returns an empty array when there are no pending invites", async () => {
		expect(await Invite.listPendingByTeam(db, "team-1")).toEqual([]);
	});
});

describe("Invite.accept", () => {
	test("marks the invite accepted and creates the resulting membership", async () => {
		let invite = await Invite.create(db, "team-1", "sender-1", "new@example.com");

		await Invite.accept(db, invite.id, "team-1", "subject-1");

		let updated = await Invite.findById(db, invite.id);
		expect(updated?.accepted_at).not.toBeNull();

		let createdMemberships = await db.findMany(memberships, {
			where: { team_id: "team-1", subject_id: "subject-1" },
		});
		expect(createdMemberships).toHaveLength(1);
		expect(createdMemberships[0]?.role).toBe("member");
	});
});

describe("Invite.revoke", () => {
	test("deletes a pending invite", async () => {
		let invite = await Invite.create(db, "team-1", "sender-1", "new@example.com");

		await Invite.revoke(db, invite.id);

		expect(await Invite.findById(db, invite.id)).toBeNull();
	});
});

describe("Invite.deleteByTeamAndEmail", () => {
	test("deletes a pending invite matching the team and email", async () => {
		let invite = await Invite.create(db, "team-1", "sender-1", "new@example.com");

		await Invite.deleteByTeamAndEmail(db, "team-1", "new@example.com");

		expect(await Invite.findById(db, invite.id)).toBeNull();
	});

	test("is a no-op when no invite matches", async () => {
		await Invite.deleteByTeamAndEmail(db, "team-1", "nobody@example.com");
		// No throw means success — nothing to assert beyond that.
		expect(await Invite.findByEmailForTeam(db, "team-1", "nobody@example.com")).toBeNull();
	});

	test("does not delete an invite belonging to a different team", async () => {
		let invite = await Invite.create(db, "team-1", "sender-1", "new@example.com");

		await Invite.deleteByTeamAndEmail(db, "team-2", "new@example.com");

		expect(await Invite.findById(db, invite.id)).toEqual(invite);
	});
});
