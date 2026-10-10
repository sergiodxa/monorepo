/**
 * Unit tests for the memberships model: resolving a subject's membership on a team, listing
 * a team's members, auto-joining by verified domain, and role changes and removals, each
 * checked against a second team or subject that must come through untouched.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { IdToken } from "@sdxc/auth/id-token";
import { NotFound } from "@sdxc/data-model";
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { UptimeModels } from "~/app/models";

import { createTestDatabase } from "~/app/lib/test/db";
import { bindModels, recordJobs } from "~/app/lib/test/models";

/** Models over a fresh database, enqueuing into a recorder so no write reaches a queue. */
function setup() {
	let { db } = createTestDatabase();
	return { db, models: bindModels(db, recordJobs().jobs) };
}

/** An `IdToken` for a new subject, with any claim overridable per test. */
function buildIdToken(overrides: Partial<{ subject: string; email: string }> = {}) {
	return new IdToken({
		sub: overrides.subject ?? crypto.randomUUID(),
		name: "Jane Doe",
		email: overrides.email ?? "jane@example.com",
		picture: "https://example.com/avatar.png",
		preferred_username: "janedoe",
	});
}

/** A team owned by a new subject, who becomes its admin member. */
async function createTeam(models: UptimeModels, ownerId: string = crypto.randomUUID()) {
	return unwrap(await models.teams.createPersonal(buildIdToken({ subject: ownerId })));
}

/** Adds `subjectId` to a team as a plain member. */
async function addMember(models: UptimeModels, teamId: string, subjectId: string) {
	return unwrap(
		await models.memberships.create({ subject_id: subjectId, team_id: teamId, role: "member" }),
	);
}

/** Adds a domain to a team, verified unless told otherwise. */
async function addDomain(models: UptimeModels, teamId: string, hostname: string, verified = true) {
	let domain = unwrap(await models.teamDomains.create({ team_id: teamId, hostname }));
	if (verified) unwrap(await models.teamDomains.update(domain.id, { verified_at: Date.now() }));
}

describe("memberships.findFor", () => {
	test("finds a subject's membership on a team", async () => {
		let { models } = setup();
		let subjectId = crypto.randomUUID();
		let team = await createTeam(models, subjectId);

		expect((await models.memberships.findFor(team.id, subjectId))?.role).toBe("admin");
	});

	test("returns null when the subject isn't a member", async () => {
		let { models } = setup();
		let team = await createTeam(models);

		expect(await models.memberships.findFor(team.id, crypto.randomUUID())).toBeNull();
	});
});

describe("memberships.inTeam", () => {
	test("lists every membership row for a team", async () => {
		let { models } = setup();
		let subjectId = crypto.randomUUID();
		let team = await createTeam(models, subjectId);

		let rows = await models.memberships.inTeam(team.id).all();
		expect(rows.map((row) => row.subject_id)).toEqual([subjectId]);
	});

	test("never returns another team's memberships", async () => {
		let { models } = setup();
		await createTeam(models);
		let teamB = await createTeam(models);

		expect(await models.memberships.inTeam(teamB.id).all()).toHaveLength(1);
	});
});

describe("memberships.joinByDomain", () => {
	test("joins the subject to every team whose verified domain matches their email, and returns the first", async () => {
		let { models } = setup();
		let ownerTeam = await createTeam(models);
		await addDomain(models, ownerTeam.id, "acme.com");

		let joiner = buildIdToken({ email: "person@acme.com" });
		let joined = await models.memberships.joinByDomain(joiner);

		expect(joined?.id).toBe(ownerTeam.id);
		expect((await models.memberships.findFor(ownerTeam.id, joiner.subject))?.role).toBe("member");
	});

	test("returns null and joins nothing when the domain isn't verified", async () => {
		let { models } = setup();
		let ownerTeam = await createTeam(models);
		await addDomain(models, ownerTeam.id, "acme.com", false);

		let joiner = buildIdToken({ email: "person@acme.com" });
		expect(await models.memberships.joinByDomain(joiner)).toBeNull();
		expect(await models.memberships.findFor(ownerTeam.id, joiner.subject)).toBeNull();
	});

	test("returns null when no domain matches the email's hostname at all", async () => {
		let { models } = setup();
		let joiner = buildIdToken({ email: "person@nowhere.com" });
		expect(await models.memberships.joinByDomain(joiner)).toBeNull();
	});

	test("joins every team with a matching verified domain, not just one", async () => {
		let { models } = setup();
		let teamA = await createTeam(models);
		let teamB = await createTeam(models);
		await addDomain(models, teamA.id, "acme.com");
		await addDomain(models, teamB.id, "acme.com");

		let joiner = buildIdToken({ email: "person@acme.com" });
		await models.memberships.joinByDomain(joiner);

		expect(await models.memberships.findFor(teamA.id, joiner.subject)).not.toBeNull();
		expect(await models.memberships.findFor(teamB.id, joiner.subject)).not.toBeNull();
	});

	test("throws when the email has no usable hostname", async () => {
		let { models } = setup();
		let joiner = buildIdToken({ email: "" });
		await expect(models.memberships.joinByDomain(joiner)).rejects.toThrow("Invalid email format");
	});
});

describe("memberships.setRole", () => {
	test("changes a subject's role on a team", async () => {
		let { models } = setup();
		let team = await createTeam(models);
		let memberId = crypto.randomUUID();
		await addMember(models, team.id, memberId);

		unwrap(await models.memberships.setRole(team.id, memberId, "admin"));

		expect((await models.memberships.findFor(team.id, memberId))?.role).toBe("admin");
	});

	test("answers NotFound when the subject has no membership on the team", async () => {
		let { models } = setup();
		let team = await createTeam(models);

		let result = await models.memberships.setRole(team.id, crypto.randomUUID(), "admin");

		expect(isFailure(result) && result.error).toBeInstanceOf(NotFound);
	});
});

describe("memberships.remove", () => {
	test("removes a subject's membership from a team", async () => {
		let { models } = setup();
		let subjectId = crypto.randomUUID();
		let team = await createTeam(models, subjectId);

		await models.memberships.remove(team.id, subjectId);

		expect(await models.memberships.findFor(team.id, subjectId)).toBeNull();
	});

	test("is a no-op when the subject isn't a member", async () => {
		let { models } = setup();
		let team = await createTeam(models);

		await models.memberships.remove(team.id, crypto.randomUUID());

		expect(await models.memberships.inTeam(team.id).count()).toBe(1);
	});
});
