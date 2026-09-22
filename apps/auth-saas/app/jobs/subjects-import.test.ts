/**
 * Exercises the `subjectsImport` cron end to end: a queued run with a small NDJSON
 * source file processes to completion in one tick, writing a failure report with
 * exactly the failing lines and reaching `status: "completed"` with the right
 * counts; a run whose declared total would cross the tenant object's own storage
 * ceiling is refused and reaches `status: "failed"` instead; a run's cursor
 * resumes mid-file across two separate ticks; and a malformed JSON line fails
 * that one row rather than the run. Nothing upstream of this job exists yet — no
 * controller writes a `tenant_import_runs` row with a real source file — so every
 * run here is inserted directly against the control-plane test database with a
 * real R2-mock-backed source file, the way `check-attack-signal-baseline.test.ts`
 * drives its own job from fixture data.
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
import { beforeEach, describe, expect, test, vi } from "vitest";

import type Tenant from "~/database/tenant-do";

/**
 * Created once and cleared with its own `reset()` between tests, rather than
 * replaced, so the "cloudflare:workers" mock below can close over one stable
 * reference instead of capturing whatever bucket existed when the module first
 * loaded.
 */
let bucket: R2BucketMock = createR2Bucket();

/**
 * Overrides the pacing module's own per-tick batch cap for the one test that
 * needs a run to stop mid-file, read back live rather than snapshotted so it can
 * be flipped between two calls to the same handler within a single test.
 */
let maxBatchesOverride: number | undefined;

vi.doMock("cloudflare:workers", async (importOriginal) => {
	let actual = await importOriginal<typeof import("cloudflare:workers")>();
	return { ...actual, env: createEnv<Cloudflare.Env>({ R2: bucket }) };
});

vi.doMock("~/app/jobs/lib/subjects-import-pacing", async (importOriginal) => {
	let actual = await importOriginal<typeof import("~/app/jobs/lib/subjects-import-pacing")>();

	return {
		...actual,
		get MAX_BATCHES_PER_RUN_PER_TICK() {
			return maxBatchesOverride ?? actual.MAX_BATCHES_PER_RUN_PER_TICK;
		},
	};
});

let { createJobContext } = await import("@sdxc/jobs");
let jobs = (await import("~/app/jobs")).default;
let { Database: JobDatabase } = await import("~/app/jobs/middleware/database");
let { TenantNamespace } = await import("~/app/jobs/middleware/tenant");
let { createTestDatabase } = await import("~/app/test/db");
let Customer = (await import("~/app/models/customer")).default;
let TenantModel = (await import("~/app/models/tenant")).default;
let TenantImportRun = (await import("~/app/models/tenant-import-run")).default;
let TenantObject = (await import("~/database/tenant-do")).default;
let subjectsImport = (await import("./subjects-import")).default;

let db: Database;

beforeEach(async () => {
	bucket.reset();
	maxBatchesOverride = undefined;
	db = await createTestDatabase();
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
 * Builds the tenant namespace the job resolves stubs through, routing each name to
 * its own real `Tenant` object. Only the three RPC methods this job ever calls are
 * exposed, each bound back to the real instance: the mock namespace's own stub
 * assembly carries over a stub object's *own* properties, which a class
 * instance's prototype methods are not, so each method is bound explicitly here
 * rather than handed over as the bare instance.
 */
function makeTenantNamespace(tenants: Map<string, InstanceType<typeof TenantObject>>) {
	return createDurableObjectNamespace<Tenant>((name) => {
		let tenantDO = tenants.get(name);
		if (!tenantDO) return {};

		return {
			beginImportRun: tenantDO.beginImportRun.bind(tenantDO),
			importSubjects: tenantDO.importSubjects.bind(tenantDO),
			completeImportRun: tenantDO.completeImportRun.bind(tenantDO),
		};
	});
}

/** Builds the context the handler receives, wired to the control-plane `db` and a tenant namespace. */
function makeContext(namespace: ReturnType<typeof makeTenantNamespace>) {
	let record: Record<string, unknown> = {};
	let log = new Log({ kind: "job", sink: (emitted) => void (record = emitted) });
	let ctx = createJobContext(jobs.subjectsImport, { id: "message-1", attempts: 1, log });
	ctx.set(JobDatabase, db, { property: "database" });
	ctx.set(TenantNamespace, namespace, { property: "tenant" });

	return {
		ctx,
		emit: () => {
			log.emit();
			return record;
		},
	};
}

/** Writes an NDJSON fixture straight to the mock bucket, one line per element, exactly as `writeTransferFile` would. */
async function putSourceFile(key: string, lines: string[]): Promise<void> {
	await bucket.put(key, `${lines.join("\n")}\n`);
}

describe("subjectsImport", () => {
	test("processes a small queued run to completion in one tick, with a failure report for the bad rows", async () => {
		let tenant = await makeTenant("Acme");
		let tenantDO = await makeTenantObject(tenant.id);

		let sourceKey = `imports/${tenant.id}/directory.ndjson`;
		await putSourceFile(sourceKey, [
			JSON.stringify({
				externalId: "ext_1",
				identifiers: [{ kind: "email", value: "jane@example.com", verified: true }],
			}),
			JSON.stringify({
				externalId: "ext_2",
				identifiers: [{ kind: "email", value: "bad-hash@example.com", verified: true }],
				password: "$2a$10$N9qo8uLOickgx2ZMRZoMye.OmWJc0.vv.rMIFZQMWLQihlT4YLu8W",
			}),
			JSON.stringify({
				externalId: "ext_3",
				identifiers: [{ kind: "email", value: "jane@example.com", verified: true }],
			}),
			"{not valid json",
		]);

		let run = await TenantImportRun.create(db, { tenantId: tenant.id, mode: "apply", sourceKey });

		let namespace = makeTenantNamespace(new Map([[tenant.id, tenantDO]]));
		let { ctx, emit } = makeContext(namespace);

		await subjectsImport(ctx);

		let finished = await TenantImportRun.findById(db, run.id);
		expect(finished).toMatchObject({
			status: "completed",
			cursor: 4,
			processed: 4,
			created: 1,
			updated: 0,
			failed: 3,
		});
		expect(finished?.report_key).not.toBeNull();

		let reportKey = finished?.report_key as string;
		let reportObject = await bucket.get(reportKey);
		expect(reportObject).not.toBeNull();

		let reportLines = (await reportObject?.text())?.trim().split("\n") ?? [];
		expect(reportLines).toHaveLength(3);

		let externalIds = reportLines.map(
			(line) => (JSON.parse(line) as { externalId?: string }).externalId,
		);
		expect(externalIds).toContain("ext_2");
		expect(externalIds).toContain("ext_3");
		expect(externalIds.filter((id) => id === undefined)).toHaveLength(1);

		expect(emit()).toMatchObject({
			"runs.active": 1,
			"runs.advanced": 1,
			"runs.completed": 1,
			"runs.failed": 0,
			"rows.processed": 4,
		});
	});

	test("refuses a run whose declared total would cross the storage ceiling", async () => {
		let tenant = await makeTenant("Acme");
		let tenantDO = await makeTenantObject(tenant.id);

		let sourceKey = `imports/${tenant.id}/directory.ndjson`;
		await putSourceFile(sourceKey, [
			JSON.stringify({
				externalId: "ext_1",
				identifiers: [{ kind: "email", value: "jane@example.com", verified: true }],
			}),
		]);

		let run = await TenantImportRun.create(db, { tenantId: tenant.id, mode: "apply", sourceKey });
		await db.update(TenantImportRun.table, { id: run.id }, { total: 10_000_000 });

		let namespace = makeTenantNamespace(new Map([[tenant.id, tenantDO]]));
		let { ctx } = makeContext(namespace);

		await subjectsImport(ctx);

		let finished = await TenantImportRun.findById(db, run.id);
		expect(finished).toMatchObject({ status: "failed", processed: 0, cursor: 0 });
		expect(finished?.finished_at).not.toBeNull();
	});

	test("leaves a queued run with no declared total untouched by the storage-ceiling check", async () => {
		let tenant = await makeTenant("Acme");
		let tenantDO = await makeTenantObject(tenant.id);

		let sourceKey = `imports/${tenant.id}/directory.ndjson`;
		await putSourceFile(sourceKey, [
			JSON.stringify({
				externalId: "ext_1",
				identifiers: [{ kind: "email", value: "jane@example.com", verified: true }],
			}),
		]);

		let run = await TenantImportRun.create(db, { tenantId: tenant.id, mode: "apply", sourceKey });
		expect(run.total).toBeNull();

		let namespace = makeTenantNamespace(new Map([[tenant.id, tenantDO]]));
		let { ctx } = makeContext(namespace);

		await subjectsImport(ctx);

		let finished = await TenantImportRun.findById(db, run.id);
		expect(finished).toMatchObject({ status: "completed", processed: 1, created: 1 });
	});

	test("a run's cursor resumes mid-file across two ticks", async () => {
		let tenant = await makeTenant("Acme");
		let tenantDO = await makeTenantObject(tenant.id);

		let sourceKey = `imports/${tenant.id}/directory.ndjson`;
		let lines = Array.from({ length: 250 }, (_, index) =>
			JSON.stringify({
				externalId: `ext_${String(index)}`,
				identifiers: [
					{ kind: "email", value: `person${String(index)}@example.com`, verified: true },
				],
			}),
		);
		await putSourceFile(sourceKey, lines);

		let run = await TenantImportRun.create(db, { tenantId: tenant.id, mode: "apply", sourceKey });

		let namespace = makeTenantNamespace(new Map([[tenant.id, tenantDO]]));

		maxBatchesOverride = 1;
		await subjectsImport(makeContext(namespace).ctx);

		let afterFirstTick = await TenantImportRun.findById(db, run.id);
		expect(afterFirstTick).toMatchObject({ status: "running", cursor: 200, processed: 200 });

		maxBatchesOverride = undefined;
		await subjectsImport(makeContext(namespace).ctx);

		let afterSecondTick = await TenantImportRun.findById(db, run.id);
		expect(afterSecondTick).toMatchObject({
			status: "completed",
			cursor: 250,
			processed: 250,
			created: 250,
		});
	});

	test("a malformed JSON line fails that one row rather than the run", async () => {
		let tenant = await makeTenant("Acme");
		let tenantDO = await makeTenantObject(tenant.id);

		let sourceKey = `imports/${tenant.id}/directory.ndjson`;
		await putSourceFile(sourceKey, [
			"not json at all",
			JSON.stringify({
				externalId: "ext_1",
				identifiers: [{ kind: "email", value: "jane@example.com", verified: true }],
			}),
		]);

		let run = await TenantImportRun.create(db, { tenantId: tenant.id, mode: "apply", sourceKey });

		let namespace = makeTenantNamespace(new Map([[tenant.id, tenantDO]]));
		let { ctx } = makeContext(namespace);

		await subjectsImport(ctx);

		let finished = await TenantImportRun.findById(db, run.id);
		expect(finished).toMatchObject({ status: "completed", processed: 2, created: 1, failed: 1 });

		let reportKey = finished?.report_key as string;
		let reportObject = await bucket.get(reportKey);
		let reportLines = (await reportObject?.text())?.trim().split("\n") ?? [];
		expect(reportLines).toHaveLength(1);

		let reportRow = JSON.parse(reportLines[0] ?? "{}") as {
			problems: { kind: string; reason: string }[];
		};
		expect(reportRow.problems).toEqual([{ kind: "row", reason: "invalid-json" }]);
	});
});
