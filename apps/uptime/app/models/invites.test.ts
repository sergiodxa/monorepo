/**
 * Unit tests for the invites model: create/revoke, accepting an invite (marking it accepted
 * and creating the resulting membership as two sequential writes), the team-scoped lookups,
 * and the pending-invites list shown on the team settings page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { NotFound } from "@sdxc/data-model";
import { isFailure, unwrap } from "@sdxc/result";
import { beforeEach, describe, expect, test } from "vitest";

import type { UptimeModels } from "~/app/models";

import { createTestDatabase } from "~/app/lib/test/db";
import { bindModels, recordJobs } from "~/app/lib/test/models";
import { invites, memberships } from "~/database/schema";

let db: Database;
let models: UptimeModels;

beforeEach(() => {
	db = createTestDatabase().db;
	models = bindModels(db, recordJobs().jobs);
});

/** Sends an invite from `sender-1`, failing the test when the write is refused. */
async function invite(teamId: string, email: string) {
	return unwrap(await models.invites.create({ team_id: teamId, sender_id: "sender-1", email }));
}

describe("invites.create", () => {
	test("creates a pending invite for an email on a team", async () => {
		let created = await invite("team-1", "new@example.com");

		expect(created.id).toBeTruthy();
		expect(created.team_id).toBe("team-1");
		expect(created.sender_id).toBe("sender-1");
		expect(created.email).toBe("new@example.com");
		expect(created.accepted_at).toBeNull();
		expect(typeof created.created_at).toBe("number");
	});
});

describe("invites.inTeam", () => {
	test("finds a pending invite by team and email", async () => {
		let created = await invite("team-1", "new@example.com");

		expect(
			await models.invites.inTeam("team-1").where({ email: "new@example.com" }).first(),
		).toEqual(created);
	});

	test("also finds an already-accepted invite", async () => {
		let created = await invite("team-1", "new@example.com");
		unwrap(await models.invites.accept(created.id, "subject-1"));

		let found = await models.invites.inTeam("team-1").where({ email: "new@example.com" }).first();
		expect(found?.accepted_at).not.toBeNull();
	});

	test("returns null when no invite matches the team and email", async () => {
		await invite("team-1", "new@example.com");

		expect(
			await models.invites.inTeam("team-2").where({ email: "new@example.com" }).first(),
		).toBeNull();
		expect(
			await models.invites.inTeam("team-1").where({ email: "nobody@example.com" }).first(),
		).toBeNull();
	});

	test("finds an invite by id scoped to its team", async () => {
		let created = await invite("team-1", "new@example.com");

		expect(await models.invites.inTeam("team-1").where({ id: created.id }).first()).toEqual(
			created,
		);
		expect(await models.invites.inTeam("team-2").where({ id: created.id }).first()).toBeNull();
		expect(await models.invites.inTeam("team-1").where({ id: "missing" }).first()).toBeNull();
	});

	test("selects the team's invites and none of another team's", async () => {
		let mine = await invite("team-1", "mine@example.com");
		await invite("team-2", "theirs@example.com");

		let rows = await models.invites.inTeam("team-1").all();
		expect(rows.map((row) => row.id)).toEqual([mine.id]);
	});
});

describe("invites.find", () => {
	test("finds an invite by id regardless of team, for the public accept page", async () => {
		let created = await invite("team-1", "new@example.com");

		expect(await models.invites.find(created.id)).toEqual(created);
	});

	test("returns null for a missing id", async () => {
		expect(await models.invites.find("missing")).toBeNull();
	});
});

describe("invites.pending", () => {
	test("lists only not-yet-accepted invites for the team, newest first", async () => {
		let pendingFirst = await invite("team-1", "first@example.com");
		let pendingSecond = await invite("team-1", "second@example.com");
		let accepted = await invite("team-1", "accepted@example.com");
		unwrap(await models.invites.accept(accepted.id, "subject-1"));
		await invite("team-2", "other-team@example.com");

		await db.update(invites, pendingFirst.id, { created_at: Date.now() - 60_000 });

		let pending = await models.invites
			.inTeam("team-1")
			.pending()
			.orderBy("created_at", "desc")
			.all();
		expect(pending.map((row) => row.id)).toEqual([pendingSecond.id, pendingFirst.id]);
	});

	test("returns an empty array when there are no pending invites", async () => {
		expect(await models.invites.inTeam("team-1").pending().all()).toEqual([]);
	});
});

describe("invites.accept", () => {
	test("marks the invite accepted and creates the resulting membership", async () => {
		let created = await invite("team-1", "new@example.com");

		unwrap(await models.invites.accept(created.id, "subject-1"));

		let updated = await models.invites.find(created.id);
		expect(updated?.accepted_at).not.toBeNull();

		let createdMemberships = await db.findMany(memberships, {
			where: { team_id: "team-1", subject_id: "subject-1" },
		});
		expect(createdMemberships).toHaveLength(1);
		expect(createdMemberships[0]?.role).toBe("member");
	});

	test("answers NotFound and creates no membership for an invite that is gone", async () => {
		let accepted = await models.invites.accept("missing", "subject-1");

		expect(isFailure(accepted) && accepted.error).toBeInstanceOf(NotFound);
		expect(await db.count(memberships)).toBe(0);
	});
});

describe("invites.delete", () => {
	test("revokes a pending invite", async () => {
		let created = await invite("team-1", "new@example.com");

		unwrap(await models.invites.delete(created.id));

		expect(await models.invites.find(created.id)).toBeNull();
	});
});

describe("invites.withdraw", () => {
	test("deletes a pending invite matching the team and email", async () => {
		let created = await invite("team-1", "new@example.com");

		await models.invites.withdraw("team-1", "new@example.com");

		expect(await models.invites.find(created.id)).toBeNull();
	});

	test("is a no-op when no invite matches", async () => {
		await models.invites.withdraw("team-1", "nobody@example.com");
		expect(await db.count(invites)).toBe(0);
	});

	test("does not delete an invite belonging to a different team", async () => {
		let created = await invite("team-1", "new@example.com");

		await models.invites.withdraw("team-2", "new@example.com");

		expect(await models.invites.find(created.id)).toEqual(created);
	});
});
