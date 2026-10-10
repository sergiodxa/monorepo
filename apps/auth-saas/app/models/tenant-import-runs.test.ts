/**
 * Drives the tenant import runs model against the control-plane test database: a run starts
 * queued at cursor zero, `markRunning` and `advance` move it forward batch by batch, and
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

/** Starts a run reading Acme's directory file in `mode`. */
async function startRun(tenant: TenantRow, mode: "validate" | "apply" = "apply") {
	return unwrap(
		await models.tenantImportRuns.create({
			tenant_id: tenant.id,
			mode,
			source_key: "imports/acme/directory.ndjson",
		}),
	);
}

describe("tenantImportRuns.create", () => {
	test("starts a run queued, at cursor zero, with every counter at zero", async () => {
		let tenant = await seedTenant(models, "Acme");

		let run = await startRun(tenant, "validate");

		expect(run).toMatchObject({
			tenant_id: tenant.id,
			mode: "validate",
			source_key: "imports/acme/directory.ndjson",
			report_key: null,
			status: "queued",
			total: null,
			processed: 0,
			created: 0,
			updated: 0,
			failed: 0,
			cursor: 0,
			started_at: null,
			finished_at: null,
		});
		expect(run.id).toMatch(/^imp_/);
	});
});

describe("tenantImportRuns.find", () => {
	test("finds nothing for an id that was never created", async () => {
		expect(await models.tenantImportRuns.find("imp_does_not_exist")).toBeNull();
	});

	test("finds the row once a run is created", async () => {
		let tenant = await seedTenant(models, "Acme");
		let run = await startRun(tenant);

		let found = await models.tenantImportRuns.find(run.id);
		expect(found).toMatchObject({ id: run.id, tenant_id: tenant.id });
	});
});

describe("tenantImportRuns.markRunning", () => {
	test("moves status to running and stamps a start time", async () => {
		let run = await startRun(await seedTenant(models, "Acme"));

		let updated = unwrap(await models.tenantImportRuns.markRunning(run.id));

		expect(updated.status).toBe("running");
		expect(updated.started_at).not.toBeNull();
	});
});

describe("tenantImportRuns.advance", () => {
	test("replaces the cursor and folds a batch's counts into the running totals", async () => {
		let run = await startRun(await seedTenant(models, "Acme"));

		let afterFirstBatch = await models.tenantImportRuns.advance({
			id: run.id,
			cursor: 200,
			processedDelta: 200,
			createdDelta: 190,
			updatedDelta: 5,
			failedDelta: 5,
		});
		expect(unwrap(afterFirstBatch)).toMatchObject({
			cursor: 200,
			processed: 200,
			created: 190,
			updated: 5,
			failed: 5,
		});

		let afterSecondBatch = await models.tenantImportRuns.advance({
			id: run.id,
			cursor: 400,
			processedDelta: 200,
			createdDelta: 198,
			updatedDelta: 0,
			failedDelta: 2,
		});
		expect(unwrap(afterSecondBatch)).toMatchObject({
			cursor: 400,
			processed: 400,
			created: 388,
			updated: 5,
			failed: 7,
		});
	});

	test("fails with NotFound for a run that does not exist", async () => {
		let advanced = await models.tenantImportRuns.advance({
			id: "imp_does_not_exist",
			cursor: 200,
			processedDelta: 200,
			createdDelta: 200,
			updatedDelta: 0,
			failedDelta: 0,
		});

		expect(isFailure(advanced) && advanced.error).toBeInstanceOf(NotFound);
	});
});

describe("tenantImportRuns.complete", () => {
	test("moves status to completed and stamps a finish time", async () => {
		let run = await startRun(await seedTenant(models, "Acme"));

		let updated = unwrap(await models.tenantImportRuns.complete(run.id));

		expect(updated.status).toBe("completed");
		expect(updated.finished_at).not.toBeNull();
	});
});

describe("tenantImportRuns.fail", () => {
	test("moves status to failed and stamps a finish time", async () => {
		let run = await startRun(await seedTenant(models, "Acme"));

		let updated = unwrap(await models.tenantImportRuns.fail(run.id));

		expect(updated.status).toBe("failed");
		expect(updated.finished_at).not.toBeNull();
	});
});
