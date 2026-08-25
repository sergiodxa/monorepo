/**
 * Unit tests for the `TeamDomain` data-access model: adding/removing a team's
 * auto-join domain, the team-scoped lookups the settings page uses, and the
 * cross-team `listUnverified` query the verification job polls.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import TeamDomain from "~/app/data/team-domain";
import { createTestDatabase } from "~/app/lib/test/db";
import { teamDomains } from "~/database/schema";

describe("TeamDomain.create", () => {
	test("adds a domain for a team, pending verification", async () => {
		let { db } = createTestDatabase();
		let teamId = crypto.randomUUID();

		let domain = await TeamDomain.create(db, teamId, "acme.com");

		expect(domain.team_id).toBe(teamId);
		expect(domain.hostname).toBe("acme.com");
		expect(domain.verified_at).toBeNull();
	});
});

describe("TeamDomain.findByHostnameForTeam", () => {
	test("finds a domain by hostname on a team", async () => {
		let { db } = createTestDatabase();
		let teamId = crypto.randomUUID();
		let domain = await TeamDomain.create(db, teamId, "acme.com");

		expect((await TeamDomain.findByHostnameForTeam(db, teamId, "acme.com"))?.id).toBe(domain.id);
	});

	test("returns null when the hostname belongs to a different team", async () => {
		let { db } = createTestDatabase();
		let teamA = crypto.randomUUID();
		let teamB = crypto.randomUUID();
		await TeamDomain.create(db, teamA, "acme.com");

		expect(await TeamDomain.findByHostnameForTeam(db, teamB, "acme.com")).toBeNull();
	});

	test("returns null when the hostname doesn't exist", async () => {
		let { db } = createTestDatabase();
		expect(await TeamDomain.findByHostnameForTeam(db, crypto.randomUUID(), "nope.com")).toBeNull();
	});
});

describe("TeamDomain.findByIdForTeam", () => {
	test("finds a domain scoped to its team", async () => {
		let { db } = createTestDatabase();
		let teamId = crypto.randomUUID();
		let domain = await TeamDomain.create(db, teamId, "acme.com");

		expect((await TeamDomain.findByIdForTeam(db, teamId, domain.id))?.id).toBe(domain.id);
	});

	test("returns null when the domain belongs to a different team", async () => {
		let { db } = createTestDatabase();
		let teamA = crypto.randomUUID();
		let teamB = crypto.randomUUID();
		let domain = await TeamDomain.create(db, teamA, "acme.com");

		expect(await TeamDomain.findByIdForTeam(db, teamB, domain.id)).toBeNull();
	});

	test("returns null when the id doesn't exist", async () => {
		let { db } = createTestDatabase();
		expect(
			await TeamDomain.findByIdForTeam(db, crypto.randomUUID(), crypto.randomUUID()),
		).toBeNull();
	});
});

describe("TeamDomain.findById", () => {
	test("finds a domain by id regardless of team", async () => {
		let { db } = createTestDatabase();
		let domain = await TeamDomain.create(db, crypto.randomUUID(), "acme.com");

		expect((await TeamDomain.findById(db, domain.id))?.id).toBe(domain.id);
	});

	test("returns null when the id doesn't exist", async () => {
		let { db } = createTestDatabase();
		expect(await TeamDomain.findById(db, crypto.randomUUID())).toBeNull();
	});
});

describe("TeamDomain.listByTeam", () => {
	test("lists a team's domains, most recently added first", async () => {
		let { db } = createTestDatabase();
		let teamId = crypto.randomUUID();
		let first = await TeamDomain.create(db, teamId, "a.example.com");
		/**
		 * Force a distinct `created_at` so the ordering assertion below stays
		 * deterministic when two creates land in the same millisecond.
		 */
		await db.update(
			teamDomains,
			first.id,
			{ created_at: first.created_at - 1000 },
			{ touch: false },
		);
		let second = await TeamDomain.create(db, teamId, "b.example.com");

		let rows = await TeamDomain.listByTeam(db, teamId);
		expect(rows.map((row) => row.id)).toEqual([second.id, first.id]);
	});

	test("never returns another team's domains", async () => {
		let { db } = createTestDatabase();
		let teamA = crypto.randomUUID();
		let teamB = crypto.randomUUID();
		await TeamDomain.create(db, teamA, "acme.com");

		expect(await TeamDomain.listByTeam(db, teamB)).toEqual([]);
	});
});

describe("TeamDomain.listUnverified", () => {
	test("lists every unverified domain across every team", async () => {
		let { db } = createTestDatabase();
		let unverified = await TeamDomain.create(db, crypto.randomUUID(), "unverified.com");
		let verified = await TeamDomain.create(db, crypto.randomUUID(), "verified.com");
		await TeamDomain.markVerified(db, verified.id);

		let rows = await TeamDomain.listUnverified(db);
		let ids = rows.map((row) => row.id);
		expect(ids).toContain(unverified.id);
		expect(ids).not.toContain(verified.id);
	});
});

describe("TeamDomain.markVerified", () => {
	test("sets verified_at to now", async () => {
		let { db } = createTestDatabase();
		let domain = await TeamDomain.create(db, crypto.randomUUID(), "acme.com");

		let updated = await TeamDomain.markVerified(db, domain.id);
		expect(updated.verified_at).not.toBeNull();

		let rows = await TeamDomain.listUnverified(db);
		expect(rows.map((row) => row.id)).not.toContain(domain.id);
	});
});

describe("TeamDomain.deleteById", () => {
	test("removes a domain", async () => {
		let { db } = createTestDatabase();
		let teamId = crypto.randomUUID();
		let domain = await TeamDomain.create(db, teamId, "acme.com");

		await TeamDomain.deleteById(db, domain.id);

		expect(await TeamDomain.findByIdForTeam(db, teamId, domain.id)).toBeNull();
	});
});
