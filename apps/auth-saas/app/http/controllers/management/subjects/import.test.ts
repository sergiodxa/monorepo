/**
 * Drives the subject import management-API surface through real requests:
 * `POST .../subjects/import` begins a run with a streamed, counted NDJSON
 * body; `GET .../subjects/import/:runId` polls its status; and
 * `GET .../subjects/import/:runId/download` spends the ticket that poll
 * hands back. A run is driven to completion by invoking the `subjectsImport`
 * cron handler directly against the same control-plane database and tenant
 * object the router itself writes through, the way `jobs/subjects-import.test.ts`
 * already drives that job, so the completed-poll and download assertions
 * exercise the real end-to-end path rather than a faked completion.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { R2BucketMock } from "@sdxc/cloudflare-mocks";

import { createDurableObjectNamespace, createEnv, createR2Bucket } from "@sdxc/cloudflare-mocks";
import { Log } from "@sdxc/logger";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type Tenant from "~/database/tenant-do";

/**
 * Created once and cleared between tests, so the "cloudflare:workers" mock
 * below can close over one stable reference the way `subjects-import.test.ts`
 * already does for the same job.
 */
let bucket: R2BucketMock = createR2Bucket();

vi.doMock("cloudflare:workers", async (importOriginal) => {
	let actual = await importOriginal<typeof import("cloudflare:workers")>();
	return { ...actual, env: createEnv<Cloudflare.Env>({ R2: bucket }) };
});

let { createJobContext } = await import("@sdxc/jobs");
let jobs = (await import("~/app/jobs")).default;
let { Database: JobDatabase } = await import("~/app/jobs/middleware/database");
let { TenantNamespace } = await import("~/app/jobs/middleware/tenant");
let subjectsImport = (await import("~/app/jobs/subjects-import")).default;
let { mintTransferDownloadTicket } = await import("~/app/lib/transfer-storage");
let { buildSubjectsHarness, ISSUER } =
	await import("~/app/http/controllers/management/subjects/test-harness");

beforeEach(() => {
	bucket.reset();
});

/** Builds the tenant namespace the job resolves stubs through, routing the one tenant name to the harness's own real object. */
function makeTenantNamespace(tenantId: string, tenantDO: InstanceType<typeof Tenant>) {
	return createDurableObjectNamespace<Tenant>((name) => {
		if (name !== tenantId) return {};

		return {
			beginImportRun: tenantDO.beginImportRun.bind(tenantDO),
			importSubjects: tenantDO.importSubjects.bind(tenantDO),
			completeImportRun: tenantDO.completeImportRun.bind(tenantDO),
		};
	});
}

/** Runs the `subjectsImport` cron handler once, against the harness's own control-plane database and tenant object. */
async function runImportJob(harness: {
	db: import("remix/data-table").Database;
	tenantId: string;
	tenantDO: InstanceType<typeof Tenant>;
}): Promise<void> {
	let namespace = makeTenantNamespace(harness.tenantId, harness.tenantDO);
	let log = new Log({ kind: "job", sink: () => {} });
	let ctx = createJobContext(jobs.subjectsImport, { id: "message-1", attempts: 1, log });
	ctx.set(JobDatabase, harness.db, { property: "database" });
	ctx.set(TenantNamespace, namespace, { property: "tenant" });

	await subjectsImport(ctx);
}

/** An NDJSON body of the given rows, newline-terminated the way `writeTransferFile` writes one. */
function ndjsonBody(rows: unknown[]): string {
	return rows.map((row) => JSON.stringify(row)).join("\n") + "\n";
}

describe("POST /tenants/:tenantId/subjects/import", () => {
	test("streams and counts a valid NDJSON body, queuing a run with the right total", async () => {
		let harness = await buildSubjectsHarness({ r2: bucket });
		let token = await harness.signToken();

		let body = ndjsonBody([
			{ externalId: "ext_1", identifiers: [{ kind: "email", value: "a@example.com" }] },
			{ externalId: "ext_2", identifiers: [{ kind: "email", value: "b@example.com" }] },
			{ externalId: "ext_3", identifiers: [{ kind: "email", value: "c@example.com" }] },
		]);

		let response = await harness.router.fetch(
			new Request(`${ISSUER}/tenants/${harness.tenantId}/subjects/import?mode=apply`, {
				method: "POST",
				headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-ndjson" },
				body,
			}),
		);

		expect(response.status).toBe(201);
		let payload = (await response.json()) as { id: string; status: string; total: number };
		expect(payload.status).toBe("queued");
		expect(payload.total).toBe(3);
	});

	test("refuses an empty body", async () => {
		let harness = await buildSubjectsHarness({ r2: bucket });
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			new Request(`${ISSUER}/tenants/${harness.tenantId}/subjects/import?mode=apply`, {
				method: "POST",
				headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-ndjson" },
				body: "",
			}),
		);

		expect(response.status).toBe(400);
		expect(response.headers.get("Content-Type")).toBe("application/problem+json");
	});

	test("refuses a missing mode query parameter", async () => {
		let harness = await buildSubjectsHarness({ r2: bucket });
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			new Request(`${ISSUER}/tenants/${harness.tenantId}/subjects/import`, {
				method: "POST",
				headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-ndjson" },
				body: ndjsonBody([{ externalId: "ext_1" }]),
			}),
		);

		expect(response.status).toBe(400);
		let body = (await response.json()) as { errors: Array<{ pointer: string }> };
		expect(body.errors[0]?.pointer).toBe("/mode");
	});

	test("refuses an unrecognized mode query parameter", async () => {
		let harness = await buildSubjectsHarness({ r2: bucket });
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			new Request(`${ISSUER}/tenants/${harness.tenantId}/subjects/import?mode=wipe`, {
				method: "POST",
				headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-ndjson" },
				body: ndjsonBody([{ externalId: "ext_1" }]),
			}),
		);

		expect(response.status).toBe(400);
	});

	test("refuses a caller missing the subjects:write scope", async () => {
		let harness = await buildSubjectsHarness({ r2: bucket });
		let token = await harness.signToken({ scope: "subjects:read" });

		let response = await harness.router.fetch(
			new Request(`${ISSUER}/tenants/${harness.tenantId}/subjects/import?mode=apply`, {
				method: "POST",
				headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-ndjson" },
				body: ndjsonBody([{ externalId: "ext_1" }]),
			}),
		);

		expect(response.status).toBe(403);
	});
});

describe("GET /tenants/:tenantId/subjects/import/:runId", () => {
	test("reports a queued run's counts with no download URL", async () => {
		let harness = await buildSubjectsHarness({ r2: bucket });
		let token = await harness.signToken();

		let begun = await harness.router.fetch(
			new Request(`${ISSUER}/tenants/${harness.tenantId}/subjects/import?mode=apply`, {
				method: "POST",
				headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-ndjson" },
				body: ndjsonBody([{ externalId: "ext_1" }]),
			}),
		);
		let { id: runId } = (await begun.json()) as { id: string };

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/import/${runId}`, token),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body).toMatchObject({ status: "queued", total: 1, processed: 0 });
		expect(body.reportDownloadUrl).toBeUndefined();
	});

	test("refuses a run belonging to a different tenant", async () => {
		let harness = await buildSubjectsHarness({ r2: bucket });
		let token = await harness.signToken();

		let begun = await harness.router.fetch(
			new Request(`${ISSUER}/tenants/${harness.tenantId}/subjects/import?mode=apply`, {
				method: "POST",
				headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-ndjson" },
				body: ndjsonBody([{ externalId: "ext_1" }]),
			}),
		);
		let { id: runId } = (await begun.json()) as { id: string };

		let otherToken = await harness.signToken({ tenantId: harness.otherTenantId });
		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.otherTenantId}/subjects/import/${runId}`, otherToken),
		);

		expect(response.status).toBe(404);
	});

	test("includes a working reportDownloadUrl once the run has completed with a report", async () => {
		let harness = await buildSubjectsHarness({ r2: bucket });
		let token = await harness.signToken();

		let begun = await harness.router.fetch(
			new Request(`${ISSUER}/tenants/${harness.tenantId}/subjects/import?mode=apply`, {
				method: "POST",
				headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-ndjson" },
				body: ndjsonBody([{ externalId: "ext_1" }]) + "not valid json\n",
			}),
		);
		let { id: runId } = (await begun.json()) as { id: string };

		await runImportJob(harness);

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/import/${runId}`, token),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as {
			status: string;
			failed: number;
			reportDownloadUrl?: string;
		};
		expect(body.status).toBe("completed");
		expect(body.failed).toBe(1);
		expect(body.reportDownloadUrl).toBeDefined();

		let download = await harness.router.fetch(new Request(body.reportDownloadUrl as string));
		expect(download.status).toBe(200);
		expect(download.headers.get("Content-Type")).toBe("application/x-ndjson");
		expect(download.headers.get("Content-Disposition")).toContain("attachment");

		let text = await download.text();
		expect(text).toContain("invalid-json");
	});
});

describe("GET /tenants/:tenantId/subjects/import/:runId/download", () => {
	test("refuses a missing ticket", async () => {
		let harness = await buildSubjectsHarness({ r2: bucket });

		let response = await harness.router.fetch(
			new Request(`${ISSUER}/tenants/${harness.tenantId}/subjects/import/imp_x/download`),
		);

		expect(response.status).toBe(404);
	});

	test("refuses a tampered ticket", async () => {
		let harness = await buildSubjectsHarness({ r2: bucket });
		await bucket.put("reports/tenant/report.ndjson", "line-1\n");
		let ticket = await mintTransferDownloadTicket(harness.db, {
			r2Key: "reports/tenant/report.ndjson",
			tenantId: harness.tenantId,
		});

		let response = await harness.router.fetch(
			new Request(
				`${ISSUER}/tenants/${harness.tenantId}/subjects/import/imp_x/download?ticket=${ticket}x`,
			),
		);

		expect(response.status).toBe(404);
	});

	test("refuses a reused ticket", async () => {
		let harness = await buildSubjectsHarness({ r2: bucket });
		await bucket.put("reports/tenant/report.ndjson", "line-1\n");
		let ticket = await mintTransferDownloadTicket(harness.db, {
			r2Key: "reports/tenant/report.ndjson",
			tenantId: harness.tenantId,
		});
		let url = `${ISSUER}/tenants/${harness.tenantId}/subjects/import/imp_x/download?ticket=${ticket}`;

		let first = await harness.router.fetch(new Request(url));
		expect(first.status).toBe(200);

		let second = await harness.router.fetch(new Request(url));
		expect(second.status).toBe(404);
	});

	test("refuses an expired ticket", async () => {
		let harness = await buildSubjectsHarness({ r2: bucket });
		await bucket.put("reports/tenant/report.ndjson", "line-1\n");
		let ticket = await mintTransferDownloadTicket(harness.db, {
			r2Key: "reports/tenant/report.ndjson",
			tenantId: harness.tenantId,
			expiresInMs: -1,
		});

		let response = await harness.router.fetch(
			new Request(
				`${ISSUER}/tenants/${harness.tenantId}/subjects/import/imp_x/download?ticket=${ticket}`,
			),
		);

		expect(response.status).toBe(404);
	});

	test("refuses a ticket minted for a different tenant than the URL names", async () => {
		let harness = await buildSubjectsHarness({ r2: bucket });
		await bucket.put("reports/tenant/report.ndjson", "line-1\n");
		let ticket = await mintTransferDownloadTicket(harness.db, {
			r2Key: "reports/tenant/report.ndjson",
			tenantId: harness.tenantId,
		});

		let response = await harness.router.fetch(
			new Request(
				`${ISSUER}/tenants/${harness.otherTenantId}/subjects/import/imp_x/download?ticket=${ticket}`,
			),
		);

		expect(response.status).toBe(404);
	});
});
