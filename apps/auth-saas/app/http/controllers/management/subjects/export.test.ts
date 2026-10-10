/**
 * Drives the subject export management-API surface through real requests:
 * `POST .../subjects/export` begins a run and enforces the two scopes it
 * gates on; `GET .../subjects/export/:runId` polls its status; and
 * `GET .../subjects/export/:runId/download` spends the ticket that poll
 * hands back. A run is driven to completion by invoking the `subjectsExport`
 * cron handler directly against the same control-plane database and tenant
 * object the router itself writes through, the way `jobs/subjects-export.test.ts`
 * already drives that job.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { R2BucketMock } from "@sdxc/cloudflare-mocks";

import { createDurableObjectNamespace, createEnv, createR2Bucket } from "@sdxc/cloudflare-mocks";
import { Log } from "@sdxc/logger";
import { Mailer } from "@sdxc/mail";
import { MemoryTransport } from "@sdxc/mail/memory";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type Tenant from "~/database/tenant-do";

/**
 * The platform's own tenant hostname the job resolves owners against.
 * Fixed to the app's own configured `PLATFORM_DOMAIN`, since `wrangler.jsonc`
 * pins that var to a literal type `createEnv` must match.
 */
const PLATFORM_DOMAIN = "auth.sergiodxa.com";

/**
 * Created once and cleared between tests, so the "cloudflare:workers" mock
 * below can close over one stable reference the way `subjects-export.test.ts`
 * already does for the same job.
 */
let bucket: R2BucketMock = createR2Bucket();

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

let { createJobContext } = await import("@sdxc/jobs");
let jobs = (await import("~/app/jobs")).default;
let { Database: JobDatabase } = await import("~/app/jobs/middleware/database");
let { publishModels } = await import("~/app/test/models");
let { Mail } = await import("~/app/jobs/middleware/mail");
let { TenantNamespace } = await import("~/app/jobs/middleware/tenant");
let subjectsExport = (await import("~/app/jobs/subjects-export")).default;
let { mintTransferDownloadTicket } = await import("~/app/lib/transfer-storage");
let { buildSubjectsHarness, ISSUER } =
	await import("~/app/http/controllers/management/subjects/test-harness");

beforeEach(() => {
	bucket.reset();
});

/** Builds the tenant namespace the job resolves stubs through, routing the one tenant name to the harness's own real object; the platform tenant answers nothing, since these tests seed no owner memberships. */
function makeTenantNamespace(tenantId: string, tenantDO: InstanceType<typeof Tenant>) {
	return createDurableObjectNamespace<Tenant>((name) => {
		if (name === PLATFORM_DOMAIN) return {};
		if (name !== tenantId) return {};

		return { exportSubjectPage: tenantDO.exportSubjectPage.bind(tenantDO) };
	});
}

/** Runs the `subjectsExport` cron handler once, against the harness's own control-plane database and tenant object. */
async function runExportJob(harness: {
	db: import("remix/data-table").Database;
	tenantId: string;
	tenantDO: InstanceType<typeof Tenant>;
}): Promise<void> {
	let namespace = makeTenantNamespace(harness.tenantId, harness.tenantDO);
	let log = new Log({ kind: "job", sink: () => {} });
	let ctx = createJobContext(jobs.subjectsExport, { id: "message-1", attempts: 1, log });
	ctx.set(JobDatabase, harness.db, { property: "database" });
	publishModels(ctx, harness.db);
	ctx.set(TenantNamespace, namespace, { property: "tenant" });
	ctx.set(
		Mail,
		new Mailer({
			transport: new MemoryTransport(),
			from: { email: "noreply@auth.example.com", name: "Auth SaaS" },
		}),
		{ property: "mail" },
	);

	await subjectsExport(ctx);
}

/** Seeds `count` subjects in the given tenant object, each with a password so a credentials export always has a hash to carry. */
async function makeSubjects(tenantDO: InstanceType<typeof Tenant>, count: number): Promise<void> {
	for (let index = 0; index < count; index++) {
		let created = await tenantDO.createSubject({
			identifiers: [
				{ kind: "email", value: `person${String(index)}@example.com`, verifiedAt: Date.now() },
			],
		});
		if (!created.ok) throw new Error("failed to seed a test subject");

		await tenantDO.setPassword({
			subjectId: created.subjectId,
			password: `Zx7!qLwPfM2-${String(index)}`,
			actor: { kind: "admin" },
		});
	}
}

describe("POST /tenants/:tenantId/subjects/export", () => {
	test("a caller with export:read begins an includeCredentials: false run", async () => {
		let harness = await buildSubjectsHarness({ r2: bucket });
		let token = await harness.signToken({ scope: "export:read" });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/export`, token, {
				method: "POST",
				body: JSON.stringify({ includeCredentials: false }),
			}),
		);

		expect(response.status).toBe(201);
		let payload = (await response.json()) as { id: string; status: string };
		expect(payload.status).toBe("queued");
	});

	test("answers 400 validationFailed for a body that is not JSON", async () => {
		let harness = await buildSubjectsHarness({ r2: bucket });
		let token = await harness.signToken({ scope: "export:read" });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/export`, token, {
				method: "POST",
				body: "{not json",
			}),
		);

		expect(response.status).toBe(400);
		expect(response.headers.get("Content-Type")).toBe("application/problem+json");
	});

	test("refuses a caller with only export:read asking for includeCredentials: true", async () => {
		let harness = await buildSubjectsHarness({ r2: bucket });
		let token = await harness.signToken({ scope: "export:read" });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/export`, token, {
				method: "POST",
				body: JSON.stringify({ includeCredentials: true }),
			}),
		);

		expect(response.status).toBe(403);
		let body = (await response.json()) as { detail?: string };
		expect(body.detail).toContain("export:credentials");
	});

	test("a caller with export:credentials begins an includeCredentials: true run", async () => {
		let harness = await buildSubjectsHarness({ r2: bucket });
		let token = await harness.signToken({ scope: "export:read export:credentials" });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/export`, token, {
				method: "POST",
				body: JSON.stringify({ includeCredentials: true }),
			}),
		);

		expect(response.status).toBe(201);
		let payload = (await response.json()) as { id: string; status: string };
		expect(payload.status).toBe("queued");
	});

	test("refuses a caller missing the export:read scope entirely", async () => {
		let harness = await buildSubjectsHarness({ r2: bucket });
		let token = await harness.signToken({ scope: "subjects:read" });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/export`, token, {
				method: "POST",
				body: JSON.stringify({ includeCredentials: false }),
			}),
		);

		expect(response.status).toBe(403);
	});
});

describe("GET /tenants/:tenantId/subjects/export/:runId", () => {
	test("reports a queued run's counts with no download URL", async () => {
		let harness = await buildSubjectsHarness({ r2: bucket });
		let token = await harness.signToken({ scope: "export:read" });

		let begun = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/export`, token, {
				method: "POST",
				body: JSON.stringify({ includeCredentials: false }),
			}),
		);
		let { id: runId } = (await begun.json()) as { id: string };

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/export/${runId}`, token),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body).toMatchObject({ status: "queued", processed: 0 });
		expect(body.exportDownloadUrl).toBeUndefined();
	});

	test("refuses a run belonging to a different tenant", async () => {
		let harness = await buildSubjectsHarness({ r2: bucket });
		let token = await harness.signToken({ scope: "export:read" });

		let begun = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/export`, token, {
				method: "POST",
				body: JSON.stringify({ includeCredentials: false }),
			}),
		);
		let { id: runId } = (await begun.json()) as { id: string };

		let otherToken = await harness.signToken({
			tenantId: harness.otherTenantId,
			scope: "export:read",
		});
		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.otherTenantId}/subjects/export/${runId}`, otherToken),
		);

		expect(response.status).toBe(404);
	});

	test("includes a working exportDownloadUrl once an includeCredentials: false run has completed", async () => {
		let harness = await buildSubjectsHarness({ r2: bucket });
		let token = await harness.signToken({ scope: "export:read" });

		await makeSubjects(harness.tenantDO, 3);

		let begun = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/export`, token, {
				method: "POST",
				body: JSON.stringify({ includeCredentials: false }),
			}),
		);
		let { id: runId } = (await begun.json()) as { id: string };

		await runExportJob(harness);

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/export/${runId}`, token),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as { status: string; exportDownloadUrl?: string };
		expect(body.status).toBe("completed");
		expect(body.exportDownloadUrl).toBeDefined();

		let download = await harness.router.fetch(new Request(body.exportDownloadUrl as string));
		expect(download.status).toBe(200);
		expect(download.headers.get("Content-Type")).toBe("application/x-ndjson");
		expect(download.headers.get("Content-Disposition")).toContain("attachment");

		let text = await download.text();
		expect(text).toContain('"profile"');
		expect(text).not.toContain('"hash"');
	});

	test("an includeCredentials: true run's output, once downloaded, genuinely carries a password hash", async () => {
		let harness = await buildSubjectsHarness({ r2: bucket });
		let token = await harness.signToken({ scope: "export:read export:credentials" });

		await makeSubjects(harness.tenantDO, 2);

		let begun = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/export`, token, {
				method: "POST",
				body: JSON.stringify({ includeCredentials: true }),
			}),
		);
		let { id: runId } = (await begun.json()) as { id: string };

		await runExportJob(harness);

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/export/${runId}`, token),
		);
		let body = (await response.json()) as { status: string; exportDownloadUrl?: string };
		expect(body.status).toBe("completed");
		expect(body.exportDownloadUrl).toBeDefined();

		let download = await harness.router.fetch(new Request(body.exportDownloadUrl as string));
		let text = await download.text();
		expect(text).toContain('"hash"');
	});
});

describe("GET /tenants/:tenantId/subjects/export/:runId/download", () => {
	test("refuses a missing ticket", async () => {
		let harness = await buildSubjectsHarness({ r2: bucket });

		let response = await harness.router.fetch(
			new Request(`${ISSUER}/tenants/${harness.tenantId}/subjects/export/exp_x/download`),
		);

		expect(response.status).toBe(404);
	});

	test("refuses a tampered ticket", async () => {
		let harness = await buildSubjectsHarness({ r2: bucket });
		await bucket.put("exports/tenant/report.ndjson", "line-1\n");
		let ticket = await mintTransferDownloadTicket(harness.db, {
			r2Key: "exports/tenant/report.ndjson",
			tenantId: harness.tenantId,
		});

		let response = await harness.router.fetch(
			new Request(
				`${ISSUER}/tenants/${harness.tenantId}/subjects/export/exp_x/download?ticket=${ticket}x`,
			),
		);

		expect(response.status).toBe(404);
	});

	test("refuses a reused ticket", async () => {
		let harness = await buildSubjectsHarness({ r2: bucket });
		await bucket.put("exports/tenant/report.ndjson", "line-1\n");
		let ticket = await mintTransferDownloadTicket(harness.db, {
			r2Key: "exports/tenant/report.ndjson",
			tenantId: harness.tenantId,
		});
		let url = `${ISSUER}/tenants/${harness.tenantId}/subjects/export/exp_x/download?ticket=${ticket}`;

		let first = await harness.router.fetch(new Request(url));
		expect(first.status).toBe(200);

		let second = await harness.router.fetch(new Request(url));
		expect(second.status).toBe(404);
	});

	test("refuses a ticket minted for a different tenant than the URL names", async () => {
		let harness = await buildSubjectsHarness({ r2: bucket });
		await bucket.put("exports/tenant/report.ndjson", "line-1\n");
		let ticket = await mintTransferDownloadTicket(harness.db, {
			r2Key: "exports/tenant/report.ndjson",
			tenantId: harness.tenantId,
		});

		let response = await harness.router.fetch(
			new Request(
				`${ISSUER}/tenants/${harness.otherTenantId}/subjects/export/exp_x/download?ticket=${ticket}`,
			),
		);

		expect(response.status).toBe(404);
	});
});
