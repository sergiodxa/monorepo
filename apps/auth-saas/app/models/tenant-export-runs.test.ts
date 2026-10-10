/**
 * Drives the tenant export runs model against the control-plane test database: a run starts
 * queued and untouched, `markRunning` and `advance` move it forward page by page, and
 * `complete`/`fail` close it out.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { NotFound } from "@sdxc/data-model";
import { isFailure, unwrap } from "@sdxc/result";
import { beforeEach, describe, expect, test } from "vitest";

import type { Models } from "~/app/models";
import type { TenantRow } from "~/app/models/tenants";

import { createTestDatabase } from "~/app/test/db";
import { bindModels, seedTenant } from "~/app/test/models";

let models: Models;

beforeEach(async () => {
	models = bindModels(await createTestDatabase());
});

/** Starts a run without credentials for `tenant`. */
async function startRun(tenant: TenantRow) {
	return unwrap(
		await models.tenantExportRuns.create({ tenant_id: tenant.id, include_credentials: false }),
	);
}

describe("tenantExportRuns.create", () => {
	test("starts a run queued, cursorless, with processed at zero", async () => {
		let tenant = await seedTenant(models, "Acme");

		let run = await startRun(tenant);

		expect(run).toMatchObject({
			tenant_id: tenant.id,
			include_credentials: false,
			report_key: null,
			status: "queued",
			cursor: null,
			total: null,
			processed: 0,
			started_at: null,
			finished_at: null,
		});
		expect(run.id).toMatch(/^exp_/);
	});

	test("stores a caller-supplied total for a progress display", async () => {
		let tenant = await seedTenant(models, "Acme");

		let run = unwrap(
			await models.tenantExportRuns.create({
				tenant_id: tenant.id,
				include_credentials: true,
				total: 500,
			}),
		);

		expect(run).toMatchObject({ include_credentials: true, total: 500 });
	});
});

describe("tenantExportRuns.find", () => {
	test("finds nothing for an id that was never created", async () => {
		expect(await models.tenantExportRuns.find("exp_does_not_exist")).toBeNull();
	});

	test("finds the row once a run is created", async () => {
		let tenant = await seedTenant(models, "Acme");
		let run = await startRun(tenant);

		let found = await models.tenantExportRuns.find(run.id);
		expect(found).toMatchObject({ id: run.id, tenant_id: tenant.id });
	});
});

describe("tenantExportRuns.active", () => {
	test("lists queued and running runs, leaving finished ones out", async () => {
		let tenant = await seedTenant(models, "Acme");
		let queued = await startRun(tenant);
		let running = await startRun(tenant);
		let finished = await startRun(tenant);
		unwrap(await models.tenantExportRuns.markRunning(running.id));
		unwrap(await models.tenantExportRuns.complete(finished.id));

		let active = await models.tenantExportRuns.active().all();
		expect(active.map((run) => run.id).sort()).toEqual([queued.id, running.id].sort());
	});
});

describe("tenantExportRuns.markRunning", () => {
	test("moves status to running and stamps a start time", async () => {
		let run = await startRun(await seedTenant(models, "Acme"));

		let updated = unwrap(await models.tenantExportRuns.markRunning(run.id));

		expect(updated.status).toBe("running");
		expect(updated.started_at).not.toBeNull();
	});
});

describe("tenantExportRuns.advance", () => {
	test("replaces the cursor and folds a page's count into the running total", async () => {
		let run = await startRun(await seedTenant(models, "Acme"));

		let afterFirstPage = await models.tenantExportRuns.advance({
			id: run.id,
			cursor: "cursor-1",
			processedDelta: 100,
		});
		expect(unwrap(afterFirstPage)).toMatchObject({ cursor: "cursor-1", processed: 100 });

		let afterSecondPage = await models.tenantExportRuns.advance({
			id: run.id,
			cursor: null,
			processedDelta: 42,
		});
		expect(unwrap(afterSecondPage)).toMatchObject({ cursor: null, processed: 142 });
	});

	test("fails with NotFound for a run that does not exist", async () => {
		let advanced = await models.tenantExportRuns.advance({
			id: "exp_does_not_exist",
			cursor: "cursor-1",
			processedDelta: 1,
		});

		expect(isFailure(advanced) && advanced.error).toBeInstanceOf(NotFound);
	});
});

describe("tenantExportRuns.setReportKey", () => {
	test("records the R2 key a run's output is written to", async () => {
		let tenant = await seedTenant(models, "Acme");
		let run = await startRun(tenant);

		let key = `exports/${tenant.id}/${run.id}.ndjson`;
		let updated = unwrap(await models.tenantExportRuns.setReportKey(run.id, key));

		expect(updated.report_key).toBe(key);
	});
});

describe("tenantExportRuns.complete", () => {
	test("moves status to completed and stamps a finish time", async () => {
		let run = await startRun(await seedTenant(models, "Acme"));

		let updated = unwrap(await models.tenantExportRuns.complete(run.id));

		expect(updated.status).toBe("completed");
		expect(updated.finished_at).not.toBeNull();
	});
});

describe("tenantExportRuns.fail", () => {
	test("moves status to failed and stamps a finish time", async () => {
		let run = await startRun(await seedTenant(models, "Acme"));

		let updated = unwrap(await models.tenantExportRuns.fail(run.id));

		expect(updated.status).toBe("failed");
		expect(updated.finished_at).not.toBeNull();
	});
});
