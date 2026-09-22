/**
 * Drives `GET .../passkeys`, `PATCH .../passkeys/:credentialId` and `DELETE
 * .../passkeys/:credentialId` through the management router.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test, vi } from "vitest";

import type { CredentialsHarness } from "~/app/http/controllers/management/credentials/test-harness";

import { buildCredentialsHarness } from "~/app/http/controllers/management/credentials/test-harness";
import { passkeys } from "~/database/passkeys";

/** Inserts a passkey row directly, the row shape a real ceremony would have stored. */
async function insertPasskey(
	harness: CredentialsHarness,
	input: { subjectId: string; credentialId: string; createdAt?: number },
) {
	await harness.tenantDb.create(passkeys, {
		credential_id: input.credentialId,
		subject_id: input.subjectId,
		public_key: "test-public-key",
		algorithm: -7,
		counter: 0,
		transports: ["internal"],
		aaguid: null,
		label: "Test passkey",
		syncable: false,
		backed_up: false,
		suspended: false,
		created_at: input.createdAt ?? Date.now(),
		last_used_at: null,
	});
}

describe("GET /tenants/:tenantId/subjects/:subjectId/passkeys", () => {
	test("lists a subject's own credentials, newest first", async () => {
		let harness = await buildCredentialsHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		vi.useFakeTimers();
		vi.setSystemTime(1_700_000_000_000);
		await insertPasskey(harness, { subjectId: created.subjectId, credentialId: "cred_first" });

		vi.setSystemTime(1_700_000_000_000 + 1000);
		await insertPasskey(harness, { subjectId: created.subjectId, credentialId: "cred_second" });
		vi.useRealTimers();

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/${created.subjectId}/passkeys`, token),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as Array<Record<string, unknown>>;
		expect(body).toHaveLength(2);
		expect(body[0]).toMatchObject({ credentialId: "cred_second" });
		expect(body[1]).toMatchObject({ credentialId: "cred_first" });
		expect(body[0]).not.toHaveProperty("publicKey");
	});

	test("refuses a caller missing the subjects:write scope", async () => {
		let harness = await buildCredentialsHarness();
		let token = await harness.signToken({ scope: "sessions:write" });

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/${created.subjectId}/passkeys`, token),
		);

		expect(response.status).toBe(403);
	});

	test("refuses a token bound to a different tenant", async () => {
		let harness = await buildCredentialsHarness();
		let token = await harness.signToken({ tenantId: harness.otherTenantId });

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(`/tenants/${harness.tenantId}/subjects/${created.subjectId}/passkeys`, token),
		);

		expect(response.status).toBe(403);
	});
});

describe("PATCH /tenants/:tenantId/subjects/:subjectId/passkeys/:credentialId", () => {
	test("renames a credential owned by the subject", async () => {
		let harness = await buildCredentialsHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");
		await insertPasskey(harness, { subjectId: created.subjectId, credentialId: "cred_1" });

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/passkeys/cred_1`,
				token,
				{ method: "PATCH", body: JSON.stringify({ label: "Work laptop" }) },
			),
		);

		expect(response.status).toBe(204);
	});

	test("answers a problem+json not-found for a credential this subject does not hold", async () => {
		let harness = await buildCredentialsHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/passkeys/cred_missing`,
				token,
				{ method: "PATCH", body: JSON.stringify({ label: "Work laptop" }) },
			),
		);

		expect(response.status).toBe(404);
	});

	test("answers a problem+json validation failure for a missing label", async () => {
		let harness = await buildCredentialsHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");
		await insertPasskey(harness, { subjectId: created.subjectId, credentialId: "cred_1" });

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/passkeys/cred_1`,
				token,
				{ method: "PATCH", body: JSON.stringify({}) },
			),
		);

		expect(response.status).toBe(400);
		expect(response.headers.get("Content-Type")).toBe("application/problem+json");
	});

	test("refuses a caller missing the subjects:write scope", async () => {
		let harness = await buildCredentialsHarness();
		let token = await harness.signToken({ scope: "sessions:write" });

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");
		await insertPasskey(harness, { subjectId: created.subjectId, credentialId: "cred_1" });

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/passkeys/cred_1`,
				token,
				{ method: "PATCH", body: JSON.stringify({ label: "Work laptop" }) },
			),
		);

		expect(response.status).toBe(403);
	});

	test("refuses a token bound to a different tenant", async () => {
		let harness = await buildCredentialsHarness();
		let token = await harness.signToken({ tenantId: harness.otherTenantId });

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/passkeys/cred_1`,
				token,
				{ method: "PATCH", body: JSON.stringify({ label: "Work laptop" }) },
			),
		);

		expect(response.status).toBe(403);
	});
});

describe("DELETE /tenants/:tenantId/subjects/:subjectId/passkeys/:credentialId", () => {
	test("removes a passkey once another passkey remains", async () => {
		let harness = await buildCredentialsHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");
		await insertPasskey(harness, { subjectId: created.subjectId, credentialId: "cred_1" });
		await insertPasskey(harness, { subjectId: created.subjectId, credentialId: "cred_2" });

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/passkeys/cred_1`,
				token,
				{ method: "DELETE" },
			),
		);

		expect(response.status).toBe(204);
	});

	test("answers a problem+json conflict for a subject's last remaining credential", async () => {
		let harness = await buildCredentialsHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");
		await insertPasskey(harness, { subjectId: created.subjectId, credentialId: "cred_1" });

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/passkeys/cred_1`,
				token,
				{ method: "DELETE" },
			),
		);

		expect(response.status).toBe(409);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.type).toBe("https://docs.example.com/errors/last-credential");
	});

	test("answers a problem+json not-found for a credential this subject does not hold", async () => {
		let harness = await buildCredentialsHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/passkeys/cred_missing`,
				token,
				{ method: "DELETE" },
			),
		);

		expect(response.status).toBe(404);
	});

	test("refuses a caller missing the subjects:write scope", async () => {
		let harness = await buildCredentialsHarness();
		let token = await harness.signToken({ scope: "sessions:write" });

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");
		await insertPasskey(harness, { subjectId: created.subjectId, credentialId: "cred_1" });

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/passkeys/cred_1`,
				token,
				{ method: "DELETE" },
			),
		);

		expect(response.status).toBe(403);
	});

	test("refuses a token bound to a different tenant", async () => {
		let harness = await buildCredentialsHarness();
		let token = await harness.signToken({ tenantId: harness.otherTenantId });

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/passkeys/cred_1`,
				token,
				{ method: "DELETE" },
			),
		);

		expect(response.status).toBe(403);
	});
});
