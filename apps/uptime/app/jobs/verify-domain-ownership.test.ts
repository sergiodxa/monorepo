/**
 * Unit tests for the `verifyDomainOwnership` job: a missing or already-verified domain is
 * a silent no-op, a matching DNS-over-HTTPS TXT record marks the domain verified, a miss
 * leaves it pending, and a lookup failure — network, HTTP or DNS status — is logged without
 * reporting the domain unverified (the next pending-domains sweep retries it).
 * The DNS-over-HTTPS resolver is served by MSW, so a lookup the job should skip has no
 * route to the network at all.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { CLOUDFLARE } from "@sdxc/doh";
import { createJobContext } from "@sdxc/jobs";
import { Log } from "@sdxc/logger";
import { unwrap } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

import jobs from "~/app/jobs";
import { Database } from "~/app/jobs/middleware/database";
import verifyDomainOwnership from "~/app/jobs/verify-domain-ownership";
import { createTestDatabase } from "~/app/lib/test/db";
import { bindModels, publishModels, recordJobs } from "~/app/lib/test/models";

/** The DNS-over-HTTPS resolver the job queries for the TXT record. */
let DNS_URL = CLOUDFLARE.url;

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

/** Serves the resolver a `NOERROR` DNS-JSON body carrying the given TXT record `Answer`s. */
function serveDnsAnswers(answers: Array<{ data: string }> | undefined) {
	server.use(
		http.get(DNS_URL, ({ request }) => {
			lookups.push({ url: request.url, accept: request.headers.get("Accept") });
			let body: {
				Status: number;
				Answer?: Array<{ name: string; type: number; TTL: number; data: string }>;
			} = { Status: 0 };
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

/** One breadcrumb the run left, for the assertions that read a note's own fields. */
function noteOf(record: Record<string, unknown>, name: string): Log.Note | undefined {
	return (record.notes as Log.Note[] | undefined)?.find((note) => note.name === name);
}

describe("verifyDomainOwnership", () => {
	let db: ReturnType<typeof createTestDatabase>["db"];

	beforeEach(() => {
		({ db } = createTestDatabase());
	});

	/** Adds a pending domain to team `team-1` without queueing its verification. */
	async function addDomain(hostname: string) {
		let models = bindModels(db, recordJobs().jobs);
		return unwrap(await models.teamDomains.create({ team_id: "team-1", hostname }));
	}

	/** Runs the handler over a context carrying the test's database, and returns its record. */
	async function run(teamDomainId: string) {
		let record: Record<string, unknown> = {};
		let log = new Log({ kind: "job", sink: (emitted) => void (record = emitted) });
		let ctx = createJobContext(jobs.verifyDomainOwnership, {
			id: "message-1",
			attempts: 1,
			input: { teamDomainId },
			log,
		});
		ctx.set(Database, db, { property: "database" });
		publishModels(ctx, db);

		await verifyDomainOwnership(ctx);
		log.emit();
		return record;
	}

	test("does nothing when the domain does not exist", async () => {
		serveDnsAnswers([]);

		await run("missing-domain");

		expect(lookups).toHaveLength(0);
	});

	test("does nothing when the domain is already verified", async () => {
		let domain = await addDomain("example.com");
		unwrap(await bindModels(db).teamDomains.update(domain.id, { verified_at: Date.now() }));
		serveDnsAnswers([]);

		await run(domain.id);

		expect(lookups).toHaveLength(0);
	});

	test("marks the domain verified when the TXT record matches", async () => {
		let domain = await addDomain("example.com");
		serveDnsAnswers([{ data: JSON.stringify(`ping_${domain.id}`) }]);

		let record = await run(domain.id);

		let query = new URL(lookups[0]?.url ?? "");
		expect(query.searchParams.get("name")).toBe("_ping-verification.example.com");
		expect(query.searchParams.get("type")).toBe("TXT");
		expect(lookups[0]?.accept).toBe("application/dns-json");

		let updated = await bindModels(db).teamDomains.find(domain.id);
		expect(updated?.verified_at).not.toBeNull();

		expect(record).toMatchObject({
			"domain.id": domain.id,
			"team.id": "team-1",
			"domain.verified": true,
		});
	});

	test("leaves the domain pending when the TXT record does not match", async () => {
		let domain = await addDomain("example.com");
		serveDnsAnswers([{ data: JSON.stringify("some_other_value") }]);

		let record = await run(domain.id);

		let updated = await bindModels(db).teamDomains.find(domain.id);
		expect(updated?.verified_at).toBeNull();

		expect(record).toMatchObject({ "domain.id": domain.id, "domain.verified": false });
	});

	test("leaves the domain pending when there is no Answer at all", async () => {
		let domain = await addDomain("example.com");
		serveDnsAnswers(undefined);

		let record = await run(domain.id);

		let updated = await bindModels(db).teamDomains.find(domain.id);
		expect(updated?.verified_at).toBeNull();

		expect(record).toMatchObject({ "domain.verified": false });
	});

	test("swallows a DNS lookup failure and logs it instead of throwing", async () => {
		let domain = await addDomain("example.com");
		server.use(http.get(DNS_URL, () => HttpResponse.error()));

		/** The run settles instead of throwing, which is what the handler's catch is for. */
		let record = await run(domain.id);

		let updated = await bindModels(db).teamDomains.find(domain.id);
		expect(updated?.verified_at).toBeNull();

		expect(noteOf(record, "domains.lookup_failed")?.error).toBe(
			"The DNS query failed: Failed to fetch",
		);
	});

	test("marks the domain verified when the TXT record arrives as several character-strings", async () => {
		let domain = await addDomain("example.com");
		let token = `ping_${domain.id}`;
		serveDnsAnswers([{ data: `"${token.slice(0, 7)}" "${token.slice(7)}"` }]);

		let record = await run(domain.id);

		let updated = await bindModels(db).teamDomains.find(domain.id);
		expect(updated?.verified_at).not.toBeNull();
		expect(record).toMatchObject({ "domain.verified": true });
	});

	test("leaves the domain pending when the verification name does not exist", async () => {
		let domain = await addDomain("example.com");
		server.use(http.get(DNS_URL, () => HttpResponse.json({ Status: 3 })));

		let record = await run(domain.id);

		expect(record).toMatchObject({ "domain.verified": false });
		expect(noteOf(record, "domains.lookup_failed")).toBeUndefined();
	});

	test("reports a SERVFAIL as a failed lookup, not as an unverified domain", async () => {
		let domain = await addDomain("example.com");
		server.use(http.get(DNS_URL, () => HttpResponse.json({ Status: 2 })));

		let record = await run(domain.id);

		let updated = await bindModels(db).teamDomains.find(domain.id);
		expect(updated?.verified_at).toBeNull();
		expect(record).not.toHaveProperty(["domain.verified"]);
		expect(noteOf(record, "domains.lookup_failed")?.error).toBe(
			"The resolver failed to answer for _ping-verification.example.com (SERVFAIL)",
		);
	});

	test("reports an HTTP error from the resolver as a failed lookup, not as an unverified domain", async () => {
		let domain = await addDomain("example.com");
		server.use(http.get(DNS_URL, () => HttpResponse.json({}, { status: 500 })));

		let record = await run(domain.id);

		let updated = await bindModels(db).teamDomains.find(domain.id);
		expect(updated?.verified_at).toBeNull();
		expect(record).not.toHaveProperty(["domain.verified"]);
		expect(noteOf(record, "domains.lookup_failed")?.error).toBe("The resolver answered HTTP 500");
	});
});
