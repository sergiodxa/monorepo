/**
 * Drives `GET /tenants/:tenantId/api-keys` through the management router.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test, vi } from "vitest";

import type { ApiKeysHarness } from "~/app/http/controllers/management/api-keys/test-harness";
import type { AuditActor } from "~/database/audit-events";

import {
	buildApiKeysHarness,
	grantEntitlement,
} from "~/app/http/controllers/management/api-keys/test-harness";

let ACTOR: AuditActor = { type: "platform", id: "system" };

/** A tenant entitled to machine-to-machine access, with its own key prefix set. */
async function provisionedHarness(): Promise<ApiKeysHarness> {
	let harness = await buildApiKeysHarness();
	await grantEntitlement(harness.tenantDO, "machine_access");
	await harness.tenantDO.setApiKeyPrefix({ prefix: "acme", actor: ACTOR });
	return harness;
}

async function createTestSubject(harness: ApiKeysHarness): Promise<string> {
	let created = await harness.tenantDO.createSubject({});
	if (!created.ok) throw new Error("unreachable");
	return created.subjectId;
}

describe("GET /tenants/:tenantId/api-keys", () => {
	test("pages a subject's own keys, newest first", async () => {
		let harness = await provisionedHarness();
		let token = await harness.signToken();
		let subjectId = await createTestSubject(harness);

		vi.useFakeTimers();
		vi.setSystemTime(1_700_000_000_000);
		await harness.tenantDO.createApiKey({ subjectId, name: "First", scopes: [], actor: ACTOR });

		vi.setSystemTime(1_700_000_000_000 + 1000);
		await harness.tenantDO.createApiKey({ subjectId, name: "Second", scopes: [], actor: ACTOR });
		vi.useRealTimers();

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/api-keys?subjectId=${subjectId}&per_page=1`,
				token,
			),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("Link")).toContain('rel="next"');

		let body = (await response.json()) as Array<Record<string, unknown>>;
		expect(body).toHaveLength(1);
		expect(body[0]).toMatchObject({ name: "Second" });
	});

	test("answers a problem+json validation failure when subjectId is missing", async () => {
		let harness = await provisionedHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/api-keys`, token),
		);

		expect(response.status).toBe(400);
		expect(response.headers.get("Content-Type")).toBe("application/problem+json");
	});

	test("refuses a caller missing the keys:write scope", async () => {
		let harness = await provisionedHarness();
		let token = await harness.signToken({ scope: "subjects:read" });
		let subjectId = await createTestSubject(harness);

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/api-keys?subjectId=${subjectId}`, token),
		);

		expect(response.status).toBe(403);
	});

	test("refuses a token bound to a different tenant", async () => {
		let harness = await provisionedHarness();
		let subjectId = await createTestSubject(harness);
		let token = await harness.signToken({ tenantId: harness.otherTenantId });

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/api-keys?subjectId=${subjectId}`, token),
		);

		expect(response.status).toBe(403);
	});

	test("answers 400 for a cursor this ordering did not mint", async () => {
		let harness = await provisionedHarness();
		let token = await harness.signToken();
		let subjectId = await createTestSubject(harness);

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/api-keys?subjectId=${subjectId}&cursor=not-a-real-cursor`,
				token,
			),
		);

		expect(response.status).toBe(400);
		expect(response.headers.get("Content-Type")).toBe("application/problem+json");
	});
});
