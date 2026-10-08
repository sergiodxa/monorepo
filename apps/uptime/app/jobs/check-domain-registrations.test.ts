/**
 * Tests for the `checkDomainRegistrations` sweep against MSW-mocked IANA and registry
 * servers: persisting a lookup onto the DNS monitor, notifying only when the outcome
 * warrants it, skipping monitors that are disabled or not yet due, and recording an
 * outage as a retry rather than a failed sweep.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { QueueMock } from "@sdxc/cloudflare-mocks";

import { MemoryCache } from "@sdxc/cache/memory";
import { createEnv, createQueue } from "@sdxc/cloudflare-mocks";
import { DAY_MS } from "@sdxc/dates/zone";
import { createJobContext } from "@sdxc/jobs";
import { Log } from "@sdxc/logger";
import { Mailer } from "@sdxc/mail";
import { MemoryTransport } from "@sdxc/mail/memory";
import { RDAP } from "@sdxc/rdap";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { Database } from "remix/data-table";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import type { NotifyMessage } from "~/app/lib/notify-queue";
import type { InsertDnsMonitor } from "~/database/schema";

import { MAIL_FROM } from "~/app/emails/sender";
import { createTestDatabase } from "~/app/lib/test/db";

/** One `notify` message as it travels: the job it names, and the transition under `body`. */
interface NotifyEnvelope {
	job: "notify";
	body: NotifyMessage;
}

const VERISIGN = "https://rdap.verisign.com/com/v1/domain";

/**
 * The queue the sweep notifies through, at module scope because the modules under test
 * capture `env` on import, so `beforeEach` empties it rather than re-creating it.
 */
let queue: QueueMock<NotifyEnvelope> = createQueue<NotifyEnvelope>({ name: "notify" });

vi.doMock("cloudflare:workers", () => ({ env: createEnv<Env>({ QUEUE: queue }) }));

let realRegistration = await import("~/app/services/domain-registration");

/** The client the sweep looks up through, with its bootstrap copy kept in memory per test. */
let rdap = new RDAP({ cache: new MemoryCache(), userAgent: "UptimeTest/1.0" });

vi.doMock("~/app/services/domain-registration", () => ({
	...realRegistration,
	rdapClient: () => rdap,
}));

let jobs = (await import("~/app/jobs")).default;
let { Database: JobDatabase } = await import("~/app/jobs/middleware/database");
let { Mailer: JobMailer } = await import("~/app/jobs/middleware/mailer");
let checkDomainRegistrations = (await import("./check-domain-registrations")).default;
let { default: DnsMonitor } = await import("~/app/data/dns-monitor");

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
	queue.reset();
	rdap = new RDAP({ cache: new MemoryCache(), userAgent: "UptimeTest/1.0" });
	server.use(
		http.get("https://data.iana.org/rdap/dns.json", () =>
			HttpResponse.json({
				version: "1.0",
				publication: "2026-10-01T00:00:00Z",
				services: [[["com"], ["https://rdap.verisign.com/com/v1/"]]],
			}),
		),
	);
});

/** A registry answer for `name` expiring `days` from now, with the given EPP statuses. */
function registryAnswers(name: string, days: number, status: string[] = ["active"]) {
	return http.get(`${VERISIGN}/${name}`, () =>
		HttpResponse.json({
			objectClassName: "domain",
			ldhName: name.toUpperCase(),
			status,
			events: [
				{
					eventAction: "expiration",
					eventDate: new Date(Date.now() + days * DAY_MS).toISOString(),
				},
			],
			entities: [
				{
					roles: ["registrar"],
					vcardArray: ["vcard", [["fn", {}, "text", "Example Registrar, LLC"]]],
				},
			],
		}),
	);
}

/** Every message the sweep put on the queue, in order. */
function enqueued(): NotifyEnvelope[] {
	return queue.sent.map((message) => message.body);
}

/** Runs the handler over a context carrying the test's database, and returns its record. */
async function runJob(db: Database) {
	let record: Record<string, unknown> = {};
	let log = new Log({ kind: "job", sink: (emitted) => void (record = emitted) });
	let ctx = createJobContext(jobs.checkDomainRegistrations, { id: "message-1", attempts: 1, log });
	ctx.set(JobDatabase, db, { property: "database" });
	ctx.set(JobMailer, new Mailer({ transport: new MemoryTransport(), from: MAIL_FROM }), {
		property: "mailer",
	});

	await checkDomainRegistrations(ctx);
	log.emit();
	return record;
}

async function seedMonitor(db: Database, overrides: Partial<InsertDnsMonitor> = {}) {
	return await DnsMonitor.create(db, "team-1", {
		name: "Acme",
		domain: "acme-widgets.com",
		...overrides,
	});
}

describe("checkDomainRegistrations", () => {
	test("stores the registration and schedules the next lookup a day later", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db);
		server.use(registryAnswers("acme-widgets.com", 200, ["clientTransferProhibited"]));

		let record = await runJob(db);

		let updated = await DnsMonitor.findByIdForTeam(db, "team-1", monitor.id);
		expect(updated?.registration_status).toBe("valid");
		expect(updated?.registrar).toBe("Example Registrar, LLC");
		expect(updated?.registration_epp_statuses).toEqual(["clientTransferProhibited"]);
		expect(updated?.registration_checked_at).not.toBeNull();
		expect(updated?.registration_next_check_at).toBeGreaterThan(Date.now() + DAY_MS - 60_000);
		expect(enqueued()).toEqual([]);
		expect(record).toMatchObject({ "checks.total": 1, "checks.notified": 0 });
	});

	test("notifies when the registration is inside a reminder threshold", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db);
		server.use(registryAnswers("acme-widgets.com", 10));

		await runJob(db);

		expect(enqueued()).toEqual([
			{
				job: "notify",
				body: {
					monitorType: "registration",
					monitorId: monitor.id,
					previousStatus: "unknown",
					newStatus: "expiring",
				},
			},
		]);
	});

	test("notifies while the registry holds the domain out of resolution", async () => {
		let { db } = createTestDatabase();
		await seedMonitor(db);
		server.use(registryAnswers("acme-widgets.com", 200, ["serverHold"]));

		await runJob(db);

		expect(enqueued().map((message) => message.body.newStatus)).toEqual(["valid"]);
	});

	test("records a domain the registry does not hold as unavailable, without alerting", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db);
		server.use(
			http.get(`${VERISIGN}/acme-widgets.com`, () => new HttpResponse(null, { status: 404 })),
		);

		await runJob(db);

		let updated = await DnsMonitor.findByIdForTeam(db, "team-1", monitor.id);
		expect(updated?.registration_status).toBe("unavailable");
		expect(updated?.registration_error).toBe("not-found");
		expect(enqueued()).toEqual([]);
	});

	test("records an outage as a retry and alerts once it has never succeeded", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db);
		server.use(
			http.get(`${VERISIGN}/acme-widgets.com`, () => new HttpResponse(null, { status: 503 })),
		);

		let record = await runJob(db);

		let updated = await DnsMonitor.findByIdForTeam(db, "team-1", monitor.id);
		expect(updated?.registration_status).toBe("error");
		expect(updated?.registration_error).toBe("server-error");
		expect(updated?.registration_failures).toBe(1);
		expect(enqueued().map((message) => message.body.newStatus)).toEqual(["error"]);
		expect(record).toMatchObject({ "checks.lookups_failed": 1, "checks.failed": 0 });
	});

	test("skips disabled monitors and monitors not yet due", async () => {
		let { db } = createTestDatabase();
		await seedMonitor(db, { is_enabled: false });
		await seedMonitor(db, { registration_next_check_at: Date.now() + DAY_MS });

		let record = await runJob(db);

		expect(record).toMatchObject({ "checks.total": 0 });
	});
});
