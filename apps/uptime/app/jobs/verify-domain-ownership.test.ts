/**
 * Unit tests for `VerifyDomainOwnershipJob.perform`: invalid input is rejected
 * non-retriably, a missing or already-verified domain is a silent no-op, a matching
 * DNS-over-HTTPS TXT record marks the domain verified, a miss leaves it pending, and a
 * lookup failure is swallowed (the next `EnqueuePendingDomainsJob` sweep retries it).
 * The DNS-over-HTTPS resolver is served by MSW, so a lookup the job should skip has no
 * route to the network at all.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { BatchedLogger } from "@pkg/logger";
import { ServiceContainer } from "@pkg/service-container";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { Database } from "remix/data-table";

import TeamDomain from "~/app/data/team-domain";
import { VerifyDomainOwnershipJob } from "~/app/jobs/verify-domain-ownership";
import { createTestDatabase } from "~/app/lib/test/db";

/** The DNS-over-HTTPS resolver the job queries for the TXT record. */
let DNS_URL = "https://cloudflare-dns.com/dns-query";

/** MSW server standing in for the DNS-over-HTTPS resolver. */
let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Every DNS query the job issued, in order, so a test can assert it was or wasn't made. */
let lookups: { url: string; accept: string | null }[] = [];

beforeEach(() => {
	lookups = [];
});

/** Serves the resolver a DNS-JSON body carrying the given TXT record `Answer`s. */
function serveDnsAnswers(answers: Array<{ data: string }> | undefined) {
	server.use(
		http.get(DNS_URL, ({ request }) => {
			lookups.push({ url: request.url, accept: request.headers.get("Accept") });
			let body: { Answer?: Array<{ name: string; type: number; TTL: number; data: string }> } = {};
			if (answers) {
				body.Answer = answers.map((answer) => ({
					name: "_ping-verification.example.com",
					type: 16,
					TTL: 60,
					data: answer.data,
				}));
			}
			return HttpResponse.json(body);
		}),
	);
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

		await expect(job.perform()).rejects.toThrow(Job.NonRetriableError);
	});

	test("does nothing when the domain does not exist", async () => {
		serveDnsAnswers([]);

		await container.scope(async () => {
			let job = new VerifyDomainOwnershipJob(
				{ logger: new BatchedLogger("test") },
				{ teamDomainId: "missing-domain" },
			);
			await job.perform();
		});

		expect(lookups).toBeEmpty();
	});

	test("does nothing when the domain is already verified", async () => {
		let domain = await TeamDomain.create(db, "team-1", "example.com");
		await TeamDomain.markVerified(db, domain.id);
		serveDnsAnswers([]);

		await container.scope(async () => {
			let job = new VerifyDomainOwnershipJob(
				{ logger: new BatchedLogger("test") },
				{ teamDomainId: domain.id },
			);
			await job.perform();
		});

		expect(lookups).toBeEmpty();
	});

	test("marks the domain verified when the TXT record matches", async () => {
		let domain = await TeamDomain.create(db, "team-1", "example.com");
		serveDnsAnswers([{ data: JSON.stringify(`ping_${domain.id}`) }]);
		let logger = new BatchedLogger("test");

		await container.scope(async () => {
			let job = new VerifyDomainOwnershipJob({ logger }, { teamDomainId: domain.id });
			await job.perform();
		});

		// The record the job looks up is the contract with the team that published it.
		let query = new URL(lookups[0]?.url ?? "");
		expect(query.searchParams.get("name")).toBe("_ping-verification.example.com");
		expect(query.searchParams.get("type")).toBe("TXT");
		expect(lookups[0]?.accept).toBe("application/dns-json");

		let updated = await TeamDomain.findById(db, domain.id);
		expect(updated?.verified_at).not.toBeNull();

		let event = logger.events.find(
			(entry) => entry.event === "job.verify_domain_ownership.verified",
		);
		expect(event?.teamDomainId).toBe(domain.id);
	});

	test("leaves the domain pending when the TXT record does not match", async () => {
		let domain = await TeamDomain.create(db, "team-1", "example.com");
		serveDnsAnswers([{ data: JSON.stringify("some_other_value") }]);
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
		serveDnsAnswers(undefined);
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
		// A transport failure, so the job sees a rejected call rather than an error status.
		server.use(http.get(DNS_URL, () => HttpResponse.error()));
		let logger = new BatchedLogger("test");

		await container.scope(async () => {
			let job = new VerifyDomainOwnershipJob({ logger }, { teamDomainId: domain.id });
			await expect(job.perform()).resolves.toBeUndefined();
		});

		let updated = await TeamDomain.findById(db, domain.id);
		expect(updated?.verified_at).toBeNull();

		let event = logger.events.find(
			(entry) => entry.event === "job.verify_domain_ownership.lookup_failed",
		);
		expect(event?.error).toBe("Failed to fetch");
	});
});
