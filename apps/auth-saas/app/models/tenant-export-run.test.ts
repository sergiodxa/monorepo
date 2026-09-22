/**
 * Drives `tenant-export-run.ts` directly against the control-plane test
 * database: a run starts queued and untouched, `markRunning` and `advance`
 * move it forward page by page, and `complete`/`fail` close it out.
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

import TenantExportRun from "./tenant-export-run";

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

describe("TenantExportRun.create", () => {
	test("starts a run queued, cursorless, with processed at zero", async () => {
		let tenant = await makeTenant("Acme");

		let run = await TenantExportRun.create(db, {
			tenantId: tenant.id,
			includeCredentials: false,
		});

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
		let tenant = await makeTenant("Acme");

		let run = await TenantExportRun.create(db, {
			tenantId: tenant.id,
			includeCredentials: true,
			total: 500,
		});

		expect(run).toMatchObject({ include_credentials: true, total: 500 });
	});
});

describe("TenantExportRun.findById", () => {
	test("finds nothing for an id that was never created", async () => {
		let found = await TenantExportRun.findById(db, "exp_does_not_exist");
		expect(found).toBeNull();
	});

	test("finds the row once a run is created", async () => {
		let tenant = await makeTenant("Acme");
		let run = await TenantExportRun.create(db, {
			tenantId: tenant.id,
			includeCredentials: false,
		});

		let found = await TenantExportRun.findById(db, run.id);
		expect(found).toMatchObject({ id: run.id, tenant_id: tenant.id });
	});
});

describe("TenantExportRun.markRunning", () => {
	test("moves status to running and stamps a start time", async () => {
		let tenant = await makeTenant("Acme");
		let run = await TenantExportRun.create(db, {
			tenantId: tenant.id,
			includeCredentials: false,
		});

		let updated = await TenantExportRun.markRunning(db, run.id);

		expect(updated.status).toBe("running");
		expect(updated.started_at).not.toBeNull();
	});
});

describe("TenantExportRun.advance", () => {
	test("replaces the cursor and folds a page's count into the running total", async () => {
		let tenant = await makeTenant("Acme");
		let run = await TenantExportRun.create(db, {
			tenantId: tenant.id,
			includeCredentials: false,
		});

		let afterFirstPage = await TenantExportRun.advance(db, {
			id: run.id,
			cursor: "cursor-1",
			processedDelta: 100,
		});

		expect(afterFirstPage).toMatchObject({ cursor: "cursor-1", processed: 100 });

		let afterSecondPage = await TenantExportRun.advance(db, {
			id: run.id,
			cursor: null,
			processedDelta: 42,
		});

		expect(afterSecondPage).toMatchObject({ cursor: null, processed: 142 });
	});

	test("throws for a run that does not exist", async () => {
		await expect(
			TenantExportRun.advance(db, {
				id: "exp_does_not_exist",
				cursor: "cursor-1",
				processedDelta: 1,
			}),
		).rejects.toThrow();
	});
});

describe("TenantExportRun.setReportKey", () => {
	test("records the R2 key a run's output is written to", async () => {
		let tenant = await makeTenant("Acme");
		let run = await TenantExportRun.create(db, {
			tenantId: tenant.id,
			includeCredentials: false,
		});

		let updated = await TenantExportRun.setReportKey(db, {
			id: run.id,
			reportKey: `exports/${tenant.id}/${run.id}.ndjson`,
		});

		expect(updated.report_key).toBe(`exports/${tenant.id}/${run.id}.ndjson`);
	});
});

describe("TenantExportRun.complete", () => {
	test("moves status to completed and stamps a finish time", async () => {
		let tenant = await makeTenant("Acme");
		let run = await TenantExportRun.create(db, {
			tenantId: tenant.id,
			includeCredentials: false,
		});

		let updated = await TenantExportRun.complete(db, run.id);

		expect(updated.status).toBe("completed");
		expect(updated.finished_at).not.toBeNull();
	});
});

describe("TenantExportRun.fail", () => {
	test("moves status to failed and stamps a finish time", async () => {
		let tenant = await makeTenant("Acme");
		let run = await TenantExportRun.create(db, {
			tenantId: tenant.id,
			includeCredentials: false,
		});

		let updated = await TenantExportRun.fail(db, run.id);

		expect(updated.status).toBe("failed");
		expect(updated.finished_at).not.toBeNull();
	});
});
