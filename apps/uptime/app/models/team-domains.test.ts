/**
 * Tests the team domains model against a migrated in-memory database: the team-scoped
 * lookups the settings page and API read, the verified hostnames flow monitors are limited
 * to, and the verification a new domain queues once its row is written.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { createTestDatabase } from "~/app/lib/test/db";
import { bindModels, recordJobs } from "~/app/lib/test/models";
import { teamDomains } from "~/database/schema";

/** Models over a fresh database, enqueuing into `sent` so a test reads what a write queued. */
function setup() {
	let { db } = createTestDatabase();
	let { jobs, sent } = recordJobs();
	return { db, sent, models: bindModels(db, jobs) };
}

/** Adds a domain for a team, failing the test when the write is refused. */
async function addDomain(
	models: ReturnType<typeof setup>["models"],
	teamId: string,
	hostname: string,
) {
	return unwrap(await models.teamDomains.create({ team_id: teamId, hostname }));
}

describe("teamDomains.create", () => {
	test("adds a domain for a team, pending verification", async () => {
		let { models } = setup();
		let teamId = crypto.randomUUID();

		let domain = await addDomain(models, teamId, "acme.com");

		expect(domain.team_id).toBe(teamId);
		expect(domain.hostname).toBe("acme.com");
		expect(domain.verified_at).toBeNull();
	});

	test("queues the domain's verification once it is written", async () => {
		let { models, sent } = setup();

		let domain = await addDomain(models, crypto.randomUUID(), "acme.com");

		expect(sent).toEqual([{ job: "verifyDomainOwnership", input: { teamDomainId: domain.id } }]);
	});

	test("queues nothing when the unit of work it ran in fails", async () => {
		let { models, sent } = setup();

		await models
			.transaction(async (scoped) => {
				await scoped.teamDomains.create({ team_id: crypto.randomUUID(), hostname: "acme.com" });
				throw new Error("abort");
			})
			.catch(() => {});

		expect(sent).toEqual([]);
	});

	test("queues nothing for an update", async () => {
		let { models, sent } = setup();
		let domain = await addDomain(models, crypto.randomUUID(), "acme.com");
		sent.length = 0;

		unwrap(await models.teamDomains.update(domain.id, { verified_at: Date.now() }));

		expect(sent).toEqual([]);
	});
});

describe("teamDomains.inTeam", () => {
	test("finds a domain by hostname on its team only", async () => {
		let { models } = setup();
		let teamA = crypto.randomUUID();
		let domain = await addDomain(models, teamA, "acme.com");

		expect(
			(await models.teamDomains.inTeam(teamA).where({ hostname: "acme.com" }).first())?.id,
		).toBe(domain.id);
		expect(
			await models.teamDomains.inTeam(crypto.randomUUID()).where({ hostname: "acme.com" }).first(),
		).toBeNull();
	});

	test("finds a domain by id on its team only", async () => {
		let { models } = setup();
		let teamA = crypto.randomUUID();
		let domain = await addDomain(models, teamA, "acme.com");

		expect((await models.teamDomains.inTeam(teamA).where({ id: domain.id }).first())?.id).toBe(
			domain.id,
		);
		expect(
			await models.teamDomains.inTeam(crypto.randomUUID()).where({ id: domain.id }).first(),
		).toBeNull();
	});

	test("lists a team's domains newest first and none of another team's", async () => {
		let { db, models } = setup();
		let teamId = crypto.randomUUID();
		let first = await addDomain(models, teamId, "a.example.com");
		/**
		 * Force a distinct `created_at` so the ordering assertion stays deterministic when two
		 * creates land in the same millisecond.
		 */
		await db.update(
			teamDomains,
			first.id,
			{ created_at: first.created_at - 1000 },
			{ touch: false },
		);
		let second = await addDomain(models, teamId, "b.example.com");
		await addDomain(models, crypto.randomUUID(), "c.example.com");

		let rows = await models.teamDomains.inTeam(teamId).orderBy("created_at", "desc").all();

		expect(rows.map((row) => row.id)).toEqual([second.id, first.id]);
	});
});

describe("teamDomains.unverified", () => {
	test("lists every unverified domain across every team", async () => {
		let { models } = setup();
		let unverified = await addDomain(models, crypto.randomUUID(), "unverified.com");
		let verified = await addDomain(models, crypto.randomUUID(), "verified.com");
		unwrap(await models.teamDomains.update(verified.id, { verified_at: Date.now() }));

		let ids = (await models.teamDomains.unverified().all()).map((row) => row.id);

		expect(ids).toContain(unverified.id);
		expect(ids).not.toContain(verified.id);
	});
});

describe("teamDomains.verifiedHostnames", () => {
	test("answers only the team's verified hostnames", async () => {
		let { models } = setup();
		let teamId = crypto.randomUUID();
		let verified = await addDomain(models, teamId, "verified.com");
		await addDomain(models, teamId, "pending.com");
		unwrap(await models.teamDomains.update(verified.id, { verified_at: Date.now() }));

		expect(await models.teamDomains.verifiedHostnames(teamId)).toEqual(["verified.com"]);
	});
});

describe("teamDomains.verifiedHostnamesByTeam", () => {
	test("groups verified hostnames by team and leaves out teams with none", async () => {
		let { models } = setup();
		let teamA = crypto.randomUUID();
		let teamB = crypto.randomUUID();
		let a = await addDomain(models, teamA, "a.com");
		await addDomain(models, teamB, "b.com");
		unwrap(await models.teamDomains.update(a.id, { verified_at: Date.now() }));

		let byTeam = await models.teamDomains.verifiedHostnamesByTeam([teamA, teamB, teamA]);

		expect(byTeam).toEqual(new Map([[teamA, ["a.com"]]]));
	});

	test("reads nothing for no teams", async () => {
		let { models } = setup();

		expect(await models.teamDomains.verifiedHostnamesByTeam([])).toEqual(new Map());
	});
});

describe("teamDomains.delete", () => {
	test("removes a domain", async () => {
		let { models } = setup();
		let teamId = crypto.randomUUID();
		let domain = await addDomain(models, teamId, "acme.com");

		unwrap(await models.teamDomains.delete(domain.id));

		expect(await models.teamDomains.find(domain.id)).toBeNull();
	});
});
