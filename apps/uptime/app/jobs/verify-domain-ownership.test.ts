/**
 * Unit tests for `VerifyDomainOwnershipJob.perform`: invalid input is rejected
 * non-retriably, a missing or already-verified domain is a silent no-op, a matching
 * DNS-over-HTTPS TXT record marks the domain verified, a miss leaves it pending, and a
 * lookup failure is swallowed (the next `EnqueuePendingDomainsJob` sweep retries it).
 * The DNS-over-HTTPS call is exercised by mocking the global `fetch`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import { BatchedLogger } from "@pkg/logger";
import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";

import TeamDomain from "~/app/data/team-domain";
import { VerifyDomainOwnershipJob } from "~/app/jobs/verify-domain-ownership";
import { createTestDatabase } from "~/app/lib/test/db";

let originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
});

/** Stubs `fetch` to return a DNS-JSON response with the given TXT record `Answer`s. */
function stubDnsResponse(answers: Array<{ data: string }> | undefined) {
	globalThis.fetch = mock(async () => {
		let body: { Answer?: Array<{ name: string; type: number; TTL: number; data: string }> } = {};
		if (answers) {
			body.Answer = answers.map((answer) => ({
				name: "_ping-verification.example.com",
				type: 16,
				TTL: 60,
				data: answer.data,
			}));
		}
		return new Response(JSON.stringify(body));
	}) as unknown as typeof fetch;
}

describe("VerifyDomainOwnershipJob.perform", () => {
	let db: ReturnType<typeof createTestDatabase>["db"];
	let container: ServiceContainer;

	beforeEach(() => {
		({ db } = createTestDatabase());
		container = new ServiceContainer();
		container.singleton(Database, () => db);
	});

	test("throws Job.NonRetriableError on invalid input", async () => {
		let { Job } = await import("@pkg/jobs");
		let job = new VerifyDomainOwnershipJob({ logger: new BatchedLogger("test") }, {});

		expect(job.perform()).rejects.toThrow(Job.NonRetriableError);
	});

	test("does nothing when the domain does not exist", async () => {
		stubDnsResponse([]);
		let fetchMock = globalThis.fetch as unknown as ReturnType<typeof mock>;

		await container.scope(async () => {
			let job = new VerifyDomainOwnershipJob(
				{ logger: new BatchedLogger("test") },
				{ teamDomainId: "missing-domain" },
			);
			await job.perform();
		});

		expect(fetchMock).not.toHaveBeenCalled();
	});

	test("does nothing when the domain is already verified", async () => {
		let domain = await TeamDomain.create(db, "team-1", "example.com");
		await TeamDomain.markVerified(db, domain.id);
		stubDnsResponse([]);
		let fetchMock = globalThis.fetch as unknown as ReturnType<typeof mock>;

		await container.scope(async () => {
			let job = new VerifyDomainOwnershipJob(
				{ logger: new BatchedLogger("test") },
				{ teamDomainId: domain.id },
			);
			await job.perform();
		});

		expect(fetchMock).not.toHaveBeenCalled();
	});

	test("marks the domain verified when the TXT record matches", async () => {
		let domain = await TeamDomain.create(db, "team-1", "example.com");
		stubDnsResponse([{ data: JSON.stringify(`ping_${domain.id}`) }]);
		let logger = new BatchedLogger("test");

		await container.scope(async () => {
			let job = new VerifyDomainOwnershipJob({ logger }, { teamDomainId: domain.id });
			await job.perform();
		});

		let updated = await TeamDomain.findById(db, domain.id);
		expect(updated?.verified_at).not.toBeNull();

		let event = logger.events.find(
			(entry) => entry.event === "job.verify_domain_ownership.verified",
		);
		expect(event?.teamDomainId).toBe(domain.id);
	});

	test("leaves the domain pending when the TXT record does not match", async () => {
		let domain = await TeamDomain.create(db, "team-1", "example.com");
		stubDnsResponse([{ data: JSON.stringify("some_other_value") }]);
		let logger = new BatchedLogger("test");

		await container.scope(async () => {
			let job = new VerifyDomainOwnershipJob({ logger }, { teamDomainId: domain.id });
			await job.perform();
		});

		let updated = await TeamDomain.findById(db, domain.id);
		expect(updated?.verified_at).toBeNull();

		let event = logger.events.find(
			(entry) => entry.event === "job.verify_domain_ownership.pending",
		);
		expect(event?.teamDomainId).toBe(domain.id);
	});

	test("leaves the domain pending when there is no Answer at all", async () => {
		let domain = await TeamDomain.create(db, "team-1", "example.com");
		stubDnsResponse(undefined);
		let logger = new BatchedLogger("test");

		await container.scope(async () => {
			let job = new VerifyDomainOwnershipJob({ logger }, { teamDomainId: domain.id });
			await job.perform();
		});

		let updated = await TeamDomain.findById(db, domain.id);
		expect(updated?.verified_at).toBeNull();

		let event = logger.events.find(
			(entry) => entry.event === "job.verify_domain_ownership.pending",
		);
		expect(event).toBeDefined();
	});

	test("swallows a DNS lookup failure and logs it instead of throwing", async () => {
		let domain = await TeamDomain.create(db, "team-1", "example.com");
		globalThis.fetch = mock(async () => {
			throw new Error("network down");
		}) as unknown as typeof fetch;
		let logger = new BatchedLogger("test");

		await container.scope(async () => {
			let job = new VerifyDomainOwnershipJob({ logger }, { teamDomainId: domain.id });
			expect(job.perform()).resolves.toBeUndefined();
		});

		let updated = await TeamDomain.findById(db, domain.id);
		expect(updated?.verified_at).toBeNull();

		let event = logger.events.find(
			(entry) => entry.event === "job.verify_domain_ownership.lookup_failed",
		);
		expect(event?.error).toBe("network down");
	});
});
