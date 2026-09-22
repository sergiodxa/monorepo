/**
 * Drives `POST .../second-factor/reset` and `POST
 * .../second-factor/trusted-devices/:deviceId/revoke` through the management
 * router.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { totp } from "@sdxc/crypto";
import { isFailure } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { CredentialsHarness } from "~/app/http/controllers/management/credentials/test-harness";

import { buildCredentialsHarness } from "~/app/http/controllers/management/credentials/test-harness";
import { trustedDevices } from "~/database/totp";

/** Enrols and activates a TOTP factor for a subject, the way `activateTotpFactor`'s own tests prove one. */
async function enrolAndActivate(harness: CredentialsHarness, subjectId: string): Promise<void> {
	let begun = await harness.tenantDO.beginTotpEnrolment({ subjectId });
	if (!begun.ok) throw new Error("setup failed");

	let code = await totp.code(begun.setupKey);
	if (isFailure(code)) throw new Error("setup failed");

	let activated = await harness.tenantDO.activateTotpFactor({
		enrolmentId: begun.enrolmentId,
		code: code.data,
	});
	if (!activated.ok) throw new Error("setup failed");
}

describe("POST /tenants/:tenantId/subjects/:subjectId/second-factor/reset", () => {
	test("strips a subject's second-factor state", async () => {
		let harness = await buildCredentialsHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");
		await enrolAndActivate(harness, created.subjectId);

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/second-factor/reset`,
				token,
				{ method: "POST", body: JSON.stringify({ reason: "suspected_compromise" }) },
			),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body).toHaveProperty("notifyAddress");
	});

	test("answers a problem+json not-found for an unknown subject", async () => {
		let harness = await buildCredentialsHarness();
		let token = await harness.signToken();

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/sub_missing/second-factor/reset`,
				token,
				{ method: "POST", body: JSON.stringify({ reason: "suspected_compromise" }) },
			),
		);

		expect(response.status).toBe(404);
	});

	test("answers a problem+json validation failure for a missing reason", async () => {
		let harness = await buildCredentialsHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/second-factor/reset`,
				token,
				{ method: "POST", body: JSON.stringify({}) },
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

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/second-factor/reset`,
				token,
				{ method: "POST", body: JSON.stringify({ reason: "suspected_compromise" }) },
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
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/second-factor/reset`,
				token,
				{ method: "POST", body: JSON.stringify({ reason: "suspected_compromise" }) },
			),
		);

		expect(response.status).toBe(403);
	});
});

describe("POST /tenants/:tenantId/subjects/:subjectId/second-factor/trusted-devices/:deviceId/revoke", () => {
	test("revokes a remembered browser", async () => {
		let harness = await buildCredentialsHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");
		await harness.tenantDb.create(trustedDevices, {
			id: "trdev_1",
			subject_id: created.subjectId,
			token_hash: "test-hash",
			created_at: Date.now(),
			expires_at: Date.now() + 60_000,
			ip: null,
			user_agent: null,
		});

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/second-factor/trusted-devices/trdev_1/revoke`,
				token,
				{ method: "POST" },
			),
		);

		expect(response.status).toBe(204);
	});

	test("answers a problem+json not-found for a device this subject does not hold", async () => {
		let harness = await buildCredentialsHarness();
		let token = await harness.signToken();

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/second-factor/trusted-devices/trdev_missing/revoke`,
				token,
				{ method: "POST" },
			),
		);

		expect(response.status).toBe(404);
	});

	test("refuses a caller missing the subjects:write scope", async () => {
		let harness = await buildCredentialsHarness();
		let token = await harness.signToken({ scope: "sessions:write" });

		let created = await harness.tenantDO.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let response = await harness.router.fetch(
			harness.request(
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/second-factor/trusted-devices/trdev_1/revoke`,
				token,
				{ method: "POST" },
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
				`/tenants/${harness.tenantId}/subjects/${created.subjectId}/second-factor/trusted-devices/trdev_1/revoke`,
				token,
				{ method: "POST" },
			),
		);

		expect(response.status).toBe(403);
	});
});
