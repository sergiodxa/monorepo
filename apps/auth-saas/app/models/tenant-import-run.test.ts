/**
 * Drives `tenant-import-run.ts` directly against the control-plane test
 * database: a run starts queued and untouched, `markRunning` and `advance` move
 * it forward batch by batch, and `complete`/`fail` close it out.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { beforeEach, describe, expect, test } from "vitest";

import type { TenantRow } from "~/app/models/tenant";

import Customer from "~/app/models/customer";
import TenantModel from "~/app/models/tenant";
import { createTestDatabase } from "~/app/test/db";

import TenantImportRun from "./tenant-import-run";

let db: Database;

beforeEach(async () => {
	db = await createTestDatabase();
});

/** Creates a provisioned tenant row in the control plane, so a foreign key resolves. */
async function makeTenant(name: string): Promise<TenantRow> {
	let customer = await Customer.create(db, { name });
	return TenantModel.create(db, {
		customerId: customer.id,
		name,
		slug: name.toLowerCase(),
		issuer: `https://${name.toLowerCase()}.example.com`,
	});
}

describe("TenantImportRun.create", () => {
	test("starts a run queued, at cursor zero, with every counter at zero", async () => {
		let tenant = await makeTenant("Acme");

		let run = await TenantImportRun.create(db, {
			tenantId: tenant.id,
			mode: "validate",
			sourceKey: "imports/acme/directory.ndjson",
		});

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

describe("TenantImportRun.findById", () => {
	test("finds nothing for an id that was never created", async () => {
		let found = await TenantImportRun.findById(db, "imp_does_not_exist");
		expect(found).toBeNull();
	});

	test("finds the row once a run is created", async () => {
		let tenant = await makeTenant("Acme");
		let run = await TenantImportRun.create(db, {
			tenantId: tenant.id,
			mode: "apply",
			sourceKey: "imports/acme/directory.ndjson",
		});

		let found = await TenantImportRun.findById(db, run.id);
		expect(found).toMatchObject({ id: run.id, tenant_id: tenant.id });
	});
});

describe("TenantImportRun.markRunning", () => {
	test("moves status to running and stamps a start time", async () => {
		let tenant = await makeTenant("Acme");
		let run = await TenantImportRun.create(db, {
			tenantId: tenant.id,
			mode: "apply",
			sourceKey: "imports/acme/directory.ndjson",
		});

		let updated = await TenantImportRun.markRunning(db, run.id);

		expect(updated.status).toBe("running");
		expect(updated.started_at).not.toBeNull();
	});
});

describe("TenantImportRun.advance", () => {
	test("replaces the cursor and folds a batch's counts into the running totals", async () => {
		let tenant = await makeTenant("Acme");
		let run = await TenantImportRun.create(db, {
			tenantId: tenant.id,
			mode: "apply",
			sourceKey: "imports/acme/directory.ndjson",
		});

		let afterFirstBatch = await TenantImportRun.advance(db, {
			id: run.id,
			cursor: 200,
			processedDelta: 200,
			createdDelta: 190,
			updatedDelta: 5,
			failedDelta: 5,
		});

		expect(afterFirstBatch).toMatchObject({
			cursor: 200,
			processed: 200,
			created: 190,
			updated: 5,
			failed: 5,
		});

		let afterSecondBatch = await TenantImportRun.advance(db, {
			id: run.id,
			cursor: 400,
			processedDelta: 200,
			createdDelta: 198,
			updatedDelta: 0,
			failedDelta: 2,
		});

		expect(afterSecondBatch).toMatchObject({
			cursor: 400,
			processed: 400,
			created: 388,
			updated: 5,
			failed: 7,
		});
	});

	test("throws for a run that does not exist", async () => {
		await expect(
			TenantImportRun.advance(db, {
				id: "imp_does_not_exist",
				cursor: 200,
				processedDelta: 200,
				createdDelta: 200,
				updatedDelta: 0,
				failedDelta: 0,
			}),
		).rejects.toThrow();
	});
});

describe("TenantImportRun.complete", () => {
	test("moves status to completed and stamps a finish time", async () => {
		let tenant = await makeTenant("Acme");
		let run = await TenantImportRun.create(db, {
			tenantId: tenant.id,
			mode: "apply",
			sourceKey: "imports/acme/directory.ndjson",
		});

		let updated = await TenantImportRun.complete(db, run.id);

		expect(updated.status).toBe("completed");
		expect(updated.finished_at).not.toBeNull();
	});
});

describe("TenantImportRun.fail", () => {
	test("moves status to failed and stamps a finish time", async () => {
		let tenant = await makeTenant("Acme");
		let run = await TenantImportRun.create(db, {
			tenantId: tenant.id,
			mode: "apply",
			sourceKey: "imports/acme/directory.ndjson",
		});

		let updated = await TenantImportRun.fail(db, run.id);

		expect(updated.status).toBe("failed");
		expect(updated.finished_at).not.toBeNull();
	});
});
