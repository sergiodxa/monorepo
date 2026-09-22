/**
 * Exercises the `subjectsExport` cron end to end: a queued run with
 * `includeCredentials: false` processes a small directory to completion in one
 * tick, writing NDJSON that never carries a password hash; a run with
 * `includeCredentials: true` carries every hash in its output and mails the
 * tenant's owners exactly once, at the point the run starts rather than when it
 * finishes; and a run's cursor resumes mid-directory across two separate ticks,
 * with the final NDJSON exactly the union of every tick's own pages. Nothing
 * upstream of this job exists yet — no controller writes a `tenant_export_runs`
 * row — so every run here is inserted directly against the control-plane test
 * database, the way `subjects-import.test.ts` drives its own job.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { R2BucketMock } from "@sdxc/cloudflare-mocks";
import type { Database } from "remix/data-table";

import {
	createDurableObjectNamespace,
	createDurableObjectState,
	createEnv,
	createR2Bucket,
} from "@sdxc/cloudflare-mocks";
import { randomToken } from "@sdxc/crypto";
import { Log } from "@sdxc/logger";
import { Mailer } from "@sdxc/mail";
import { MemoryTransport } from "@sdxc/mail/memory";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type Tenant from "~/database/tenant-do";

/**
 * The platform's own tenant hostname, the name its dashboard subjects live
 * under. Fixed to the app's own configured `PLATFORM_DOMAIN`, since
 * `wrangler.jsonc` pins that var to a literal type `createEnv` must match.
 */
const PLATFORM_DOMAIN = "auth.sergiodxa.com";

/**
 * Created once and cleared with its own `reset()` between tests, rather than
 * replaced, so the "cloudflare:workers" mock below can close over one stable
 * reference instead of capturing whatever bucket existed when the module first
 * loaded.
 */
let bucket: R2BucketMock = createR2Bucket();

/**
 * Overrides the pacing module's own per-tick page cap for the tests that need a
 * run to stop mid-directory, read back live rather than snapshotted so it can be
 * flipped between two calls to the same handler within a single test.
 */
let maxPagesOverride: number | undefined;

vi.doMock("cloudflare:workers", async (importOriginal) => {
	let actual = await importOriginal<typeof import("cloudflare:workers")>();
	return {
		...actual,
		env: createEnv<Cloudflare.Env>({
			R2: bucket,
			PLATFORM_DOMAIN,
			EMAIL_FROM: "Auth SaaS <noreply@auth.sergiodxa.com>",
		}),
	};
});

vi.doMock("~/app/jobs/lib/subjects-export-pacing", async (importOriginal) => {
	let actual = await importOriginal<typeof import("~/app/jobs/lib/subjects-export-pacing")>();

	return {
		...actual,
		get MAX_PAGES_PER_RUN_PER_TICK() {
			return maxPagesOverride ?? actual.MAX_PAGES_PER_RUN_PER_TICK;
		},
	};
});

let { createJobContext } = await import("@sdxc/jobs");
let jobs = (await import("~/app/jobs")).default;
let { Database: JobDatabase } = await import("~/app/jobs/middleware/database");
let { Mail } = await import("~/app/jobs/middleware/mail");
let { TenantNamespace } = await import("~/app/jobs/middleware/tenant");
let { createTestDatabase } = await import("~/app/test/db");
let Customer = (await import("~/app/models/customer")).default;
let Membership = (await import("~/app/models/membership")).default;
let TenantModel = (await import("~/app/models/tenant")).default;
let TenantExportRun = (await import("~/app/models/tenant-export-run")).default;
let TenantObject = (await import("~/database/tenant-do")).default;
let subjectsExport = (await import("./subjects-export")).default;

let db: Database;
let transport: MemoryTransport;

beforeEach(async () => {
	bucket.reset();
	maxPagesOverride = undefined;
	db = await createTestDatabase();
	transport = new MemoryTransport();
});

/** Creates a provisioned tenant row in the control plane. */
async function makeTenant(name: string) {
	let customer = await Customer.create(db, { name });
	return TenantModel.create(db, {
		customerId: customer.id,
		name,
		slug: name.toLowerCase(),
		issuer: `https://${name.toLowerCase()}.example.com`,
	});
}

/** A real, freshly-provisioned `Tenant` Durable Object, isolated from any other test's own. */
async function makeTenantObject(tenantId: string): Promise<InstanceType<typeof TenantObject>> {
	let state = createDurableObjectState();
	let tenantDO = new TenantObject(state, {
		TOTP_SEAL_KEY: randomToken({ bytes: 32 }),
	} as Cloudflare.Env);
	await tenantDO.provision({ tenantId, issuer: `https://${tenantId}.example.com` });
	return tenantDO;
}

/**
 * Creates `count` subjects in the given tenant object, each with a verified
 * email. A password is a genuinely slow hash to write, so it is only set when
 * a test actually inspects one — the pagination and mail-timing tests below
 * only need subjects to exist and to be told apart.
 */
async function makeSubjects(
	tenantDO: InstanceType<typeof TenantObject>,
	count: number,
	options?: { withPassword?: boolean },
): Promise<string[]> {
	let ids: string[] = [];

	for (let index = 0; index < count; index++) {
		let created = await tenantDO.createSubject({
			identifiers: [
				{
					kind: "email",
					value: `person${String(index)}@example.com`,
					verifiedAt: Date.now(),
				},
			],
		});
		if (!created.ok) throw new Error("failed to seed a test subject");

		if (options?.withPassword) {
			await tenantDO.setPassword({
				subjectId: created.subjectId,
				password: `Zx7!qLwPfM2-${String(index)}`,
				actor: { kind: "admin" },
			});
		}

		ids.push(created.subjectId);
	}

	return ids;
}

/**
 * Builds the namespace the job resolves stubs through: the tenant under test
 * routes to its real `Tenant` object's `exportSubjectPage`, and the platform
 * tenant answers `describeSubject` for whichever owner subject ids are
 * registered, the way `check-attack-signal-baseline.test.ts` mocks the same
 * platform lookup.
 */
function makeNamespace(
	tenants: Map<string, InstanceType<typeof TenantObject>>,
	emailsBySubject: Record<string, string> = {},
) {
	return createDurableObjectNamespace<Tenant>((name) => {
		if (name === PLATFORM_DOMAIN) {
			return {
				describeSubject: async (input: { subjectId: string }) => {
					let email = emailsBySubject[input.subjectId];
					if (!email) return { ok: false, reason: "not-found" };

					return {
						ok: true,
						identifiers: [
							{ kind: "email", value: email, verified: true, verifiedAt: 1, isPrimary: true },
						],
					};
				},
			};
		}

		let tenantDO = tenants.get(name);
		if (!tenantDO) return {};

		return { exportSubjectPage: tenantDO.exportSubjectPage.bind(tenantDO) };
	});
}

/** Builds the context the handler receives, wired to the control-plane `db`, a tenant namespace, and a recording mailer. */
function makeContext(namespace: ReturnType<typeof makeNamespace>) {
	let record: Record<string, unknown> = {};
	let log = new Log({ kind: "job", sink: (emitted) => void (record = emitted) });
	let ctx = createJobContext(jobs.subjectsExport, { id: "message-1", attempts: 1, log });
	ctx.set(JobDatabase, db, { property: "database" });
	ctx.set(TenantNamespace, namespace, { property: "tenant" });
	ctx.set(
		Mail,
		new Mailer({ transport, from: { email: "noreply@auth.example.com", name: "Auth SaaS" } }),
		{ property: "mail" },
	);

	return {
		ctx,
		emit: () => {
			log.emit();
			return record;
		},
	};
}

/** Reads an NDJSON object back as parsed rows, or an empty array when it does not exist. */
async function readNdjson(key: string): Promise<Record<string, unknown>[]> {
	let object = await bucket.get(key);
	if (!object) return [];

	let text = (await object.text()).trim();
	if (text.length === 0) return [];

	return text.split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe("subjectsExport", () => {
	test("processes a small queued run with includeCredentials false to completion in one tick, writing no password hash", async () => {
		let tenant = await makeTenant("Acme");
		let tenantDO = await makeTenantObject(tenant.id);
		let subjectIds = await makeSubjects(tenantDO, 3, { withPassword: true });

		let run = await TenantExportRun.create(db, {
			tenantId: tenant.id,
			includeCredentials: false,
		});

		let namespace = makeNamespace(new Map([[tenant.id, tenantDO]]));
		let { ctx, emit } = makeContext(namespace);

		await subjectsExport(ctx);

		let finished = await TenantExportRun.findById(db, run.id);
		expect(finished).toMatchObject({ status: "completed", cursor: null, processed: 3 });
		expect(finished?.report_key).not.toBeNull();

		let rows = await readNdjson(finished?.report_key as string);
		expect(rows).toHaveLength(3);
		expect(rows.map((row) => (row.profile as { id: string }).id).sort()).toEqual(
			[...subjectIds].sort(),
		);

		let rawText = JSON.stringify(rows);
		expect(rawText).not.toContain('"hash"');
		for (let row of rows) {
			expect((row.credentials as { password: { exists: boolean } }).password.exists).toBe(true);
		}

		expect(emit()).toMatchObject({
			"runs.active": 1,
			"runs.advanced": 1,
			"runs.completed": 1,
			"runs.failed": 0,
			"subjects.processed": 3,
		});
	});

	test("a run with includeCredentials true carries every password hash in its output", async () => {
		let tenant = await makeTenant("Acme");
		let tenantDO = await makeTenantObject(tenant.id);
		await makeSubjects(tenantDO, 2, { withPassword: true });

		let run = await TenantExportRun.create(db, { tenantId: tenant.id, includeCredentials: true });

		let namespace = makeNamespace(new Map([[tenant.id, tenantDO]]));
		let { ctx } = makeContext(namespace);

		await subjectsExport(ctx);

		let finished = await TenantExportRun.findById(db, run.id);
		expect(finished?.status).toBe("completed");

		let rows = await readNdjson(finished?.report_key as string);
		expect(rows).toHaveLength(2);

		for (let row of rows) {
			let password = (row.credentials as { password: { exists: boolean; hash?: string } }).password;
			expect(password.exists).toBe(true);
			expect(typeof password.hash).toBe("string");
			expect(password.hash?.length).toBeGreaterThan(0);
		}
	});

	test("mails the tenant's owners exactly once, at the run's start rather than its completion", async () => {
		let tenant = await makeTenant("Acme");
		let tenantDO = await makeTenantObject(tenant.id);
		await makeSubjects(tenantDO, 150);

		await Membership.create(db, { tenantId: tenant.id, subjectId: "sub_owner", role: "owner" });

		let run = await TenantExportRun.create(db, { tenantId: tenant.id, includeCredentials: true });

		let namespace = makeNamespace(new Map([[tenant.id, tenantDO]]), {
			sub_owner: "owner@acme.example.com",
		});

		maxPagesOverride = 1;
		await subjectsExport(makeContext(namespace).ctx);

		let afterFirstTick = await TenantExportRun.findById(db, run.id);
		expect(afterFirstTick?.status).toBe("running");
		expect(transport.messages).toHaveLength(1);
		expect(transport.messages[0]?.to).toEqual([{ email: "owner@acme.example.com" }]);

		maxPagesOverride = undefined;
		await subjectsExport(makeContext(namespace).ctx);

		let afterSecondTick = await TenantExportRun.findById(db, run.id);
		expect(afterSecondTick?.status).toBe("completed");
		expect(transport.messages).toHaveLength(1);
	});

	test("a run's cursor resumes mid-directory across two ticks, with no duplicate or missing subjects in the final output", async () => {
		let tenant = await makeTenant("Acme");
		let tenantDO = await makeTenantObject(tenant.id);
		let subjectIds = await makeSubjects(tenantDO, 150);

		let run = await TenantExportRun.create(db, {
			tenantId: tenant.id,
			includeCredentials: false,
		});

		let namespace = makeNamespace(new Map([[tenant.id, tenantDO]]));

		maxPagesOverride = 1;
		await subjectsExport(makeContext(namespace).ctx);

		let afterFirstTick = await TenantExportRun.findById(db, run.id);
		expect(afterFirstTick).toMatchObject({ status: "running", processed: 100 });
		expect(afterFirstTick?.cursor).not.toBeNull();

		maxPagesOverride = undefined;
		await subjectsExport(makeContext(namespace).ctx);

		let afterSecondTick = await TenantExportRun.findById(db, run.id);
		expect(afterSecondTick).toMatchObject({ status: "completed", cursor: null, processed: 150 });

		let rows = await readNdjson(afterSecondTick?.report_key as string);
		expect(rows).toHaveLength(150);

		let exportedIds = rows.map((row) => (row.profile as { id: string }).id);
		expect(new Set(exportedIds).size).toBe(150);
		expect(exportedIds.sort()).toEqual([...subjectIds].sort());
	});
});
