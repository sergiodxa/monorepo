/**
 * Unit tests for the `verifyDomainOwnership` job: a missing or already-verified domain is
 * a silent no-op, a matching DNS-over-HTTPS TXT record marks the domain verified, a miss
 * leaves it pending, and a lookup failure is swallowed (the next pending-domains sweep
 * retries it).
 * The DNS-over-HTTPS resolver is served by MSW, so a lookup the job should skip has no
 * route to the network at all.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createJobContext } from "@pkg/jobs-next";
import { BatchedLogger } from "@pkg/logger";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

import TeamDomain from "~/app/data/team-domain";
import jobs from "~/app/jobs";
import { Database } from "~/app/jobs/middleware/database";
import verifyDomainOwnership from "~/app/jobs/verify-domain-ownership";
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

describe("verifyDomainOwnership", () => {
	let db: ReturnType<typeof createTestDatabase>["db"];

	beforeEach(() => {
		({ db } = createTestDatabase());
	});

	/** Runs the handler over a context carrying the test's database, as the chain would. */
	function run(teamDomainId: string, logger = new BatchedLogger("test")) {
		let ctx = createJobContext(jobs.verifyDomainOwnership, {
			id: "message-1",
			attempts: 1,
			input: { teamDomainId },
			logger,
		});
		ctx.set(Database, db, { property: "database" });
		return verifyDomainOwnership(ctx);
	}

	test("does nothing when the domain does not exist", async () => {
		serveDnsAnswers([]);

		await run("missing-domain");

		expect(lookups).toHaveLength(0);
	});

	test("does nothing when the domain is already verified", async () => {
		let domain = await TeamDomain.create(db, "team-1", "example.com");
		await TeamDomain.markVerified(db, domain.id);
		serveDnsAnswers([]);

		await run(domain.id);

		expect(lookups).toHaveLength(0);
	});

	test("marks the domain verified when the TXT record matches", async () => {
		let domain = await TeamDomain.create(db, "team-1", "example.com");
		serveDnsAnswers([{ data: JSON.stringify(`ping_${domain.id}`) }]);
		let logger = new BatchedLogger("test");

		await run(domain.id, logger);

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

		await run(domain.id, logger);

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

		await run(domain.id, logger);

		let updated = await TeamDomain.findById(db, domain.id);
		expect(updated?.verified_at).toBeNull();

		let event = logger.events.find(
			(entry) => entry.event === "job.verify_domain_ownership.pending",
		);
		expect(event).toBeDefined();
	});

	test("swallows a DNS lookup failure and logs it instead of throwing", async () => {
		let domain = await TeamDomain.create(db, "team-1", "example.com");
		server.use(http.get(DNS_URL, () => HttpResponse.error()));
		let logger = new BatchedLogger("test");

		await expect(run(domain.id, logger)).resolves.toBeUndefined();

		let updated = await TeamDomain.findById(db, domain.id);
		expect(updated?.verified_at).toBeNull();

		let event = logger.events.find(
			(entry) => entry.event === "job.verify_domain_ownership.lookup_failed",
		);
		expect(event?.error).toBe("Failed to fetch");
	});
});
