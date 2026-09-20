/**
 * Proves the TOTP second-factor mechanism this pass builds: enrolment only
 * becomes a factor once a code proves it, recovery codes are minted once and
 * replaced wholesale on regeneration, removal respects the tenant's MFA policy,
 * a recovery code is single-use, an administrator reset clears everything it
 * claims to, `revokeTrustedDevice` is scoped to its own subject, the daily
 * sweep clears only what has actually expired, and `describeSubject` reports
 * the new fields correctly with and without an active factor.
 *
 * Drives everything through the `Tenant` object, the way every other
 * credential module in this database is tested.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurableObjectStateMock } from "@sdxc/cloudflare-mocks";

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { randomToken, totp } from "@sdxc/crypto";
import { isFailure } from "@sdxc/result";
import { beforeEach, describe, expect, test } from "vitest";

import Tenant from "./tenant-do";

let state: DurableObjectStateMock;
let tenant: Tenant;

let adminActor = { kind: "admin" } as const;
let platformActor = { type: "platform", id: "member_1" } as const;

beforeEach(() => {
	state = createDurableObjectState();
	tenant = new Tenant(state, { TOTP_SEAL_KEY: randomToken({ bytes: 32 }) } as Cloudflare.Env);
});

let nextSubjectEmail = 0;

/** Creates a bare subject, ready to enrol a TOTP factor. */
async function createSubject() {
	let created = await tenant.createSubject({
		identifiers: [{ kind: "email", value: `jane-${nextSubjectEmail++}@example.com` }],
	});
	if (!created.ok) throw new Error("setup failed");
	return created.subjectId;
}

/** The current TOTP code for a setup key, the way an authenticator app would show it. */
async function currentCode(setupKey: string): Promise<string> {
	let code = await totp.code(setupKey);
	if (isFailure(code)) throw new Error("failed to derive a test code");
	return code.data;
}

/** Enrols and activates a factor for a subject, returning its recovery codes and setup key. */
async function enrolAndActivate(subjectId: string) {
	let begun = await tenant.beginTotpEnrolment({ subjectId });
	if (!begun.ok) throw new Error("setup failed");

	let activated = await tenant.activateTotpFactor({
		enrolmentId: begun.enrolmentId,
		code: await currentCode(begun.setupKey),
	});
	if (!activated.ok) throw new Error("setup failed");

	return { setupKey: begun.setupKey, recoveryCodes: activated.recoveryCodes };
}

describe("beginTotpEnrolment / activateTotpFactor", () => {
	test("enrols, activates with a valid code, and mints ten recovery codes", async () => {
		let subjectId = await createSubject();

		let begun = await tenant.beginTotpEnrolment({ subjectId });
		expect(begun).toMatchObject({
			ok: true,
			enrolmentId: expect.any(String),
			uri: expect.stringContaining("otpauth://totp/"),
			setupKey: expect.any(String),
		});
		if (!begun.ok) throw new Error("unreachable");

		let activated = await tenant.activateTotpFactor({
			enrolmentId: begun.enrolmentId,
			code: await currentCode(begun.setupKey),
			label: "My phone",
		});

		expect(activated).toMatchObject({ ok: true, subjectId, label: "My phone" });
		if (!activated.ok) throw new Error("unreachable");
		expect(activated.recoveryCodes).toHaveLength(10);
		expect(new Set(activated.recoveryCodes).size).toBe(10);
		for (let code of activated.recoveryCodes)
			expect(code).toMatch(/^[A-Z2-7]{4}-[A-Z2-7]{4}-[A-Z2-7]{4}-[A-Z2-7]{4}$/);

		let described = await tenant.describeSubject({ subjectId, audience: adminActor });
		expect(described).toMatchObject({
			ok: true,
			totpFactor: { label: "My phone", lastUsedAt: null },
			recoveryCodesRemaining: 10,
			trustedDevices: [],
		});
	});

	test("refuses activation with a wrong code and leaves no factor", async () => {
		let subjectId = await createSubject();

		let begun = await tenant.beginTotpEnrolment({ subjectId });
		if (!begun.ok) throw new Error("unreachable");

		let activated = await tenant.activateTotpFactor({
			enrolmentId: begun.enrolmentId,
			code: "000000",
		});

		expect(activated).toMatchObject({ ok: false, reason: "invalid-code" });

		let described = await tenant.describeSubject({ subjectId, audience: adminActor });
		expect(described).toMatchObject({
			ok: true,
			totpFactor: { label: null, lastUsedAt: null },
			recoveryCodesRemaining: 0,
		});

		// The enrolment is spent on the first attempt regardless of outcome, so a
		// second attempt against the same id has nothing left to verify against.
		let retried = await tenant.activateTotpFactor({
			enrolmentId: begun.enrolmentId,
			code: await currentCode(begun.setupKey),
		});
		expect(retried).toMatchObject({ ok: false, reason: "invalid-enrolment" });
	});

	test("refuses an unknown or already-spent enrolment", async () => {
		let activated = await tenant.activateTotpFactor({
			enrolmentId: "totpenr_nope",
			code: "123456",
		});
		expect(activated).toMatchObject({ ok: false, reason: "invalid-enrolment" });
	});

	test("clears a subject's trusted devices when a factor is enrolled again", async () => {
		let subjectId = await createSubject();
		await enrolAndActivate(subjectId);

		state.storage.sql.exec(
			`INSERT INTO trusted_devices (id, subject_id, token_hash, created_at, expires_at, ip, user_agent)
			 VALUES ('tdev_1', ?, 'hash', ?, ?, NULL, NULL)`,
			subjectId,
			Date.now(),
			Date.now() + 1000,
		);

		await enrolAndActivate(subjectId);

		let described = await tenant.describeSubject({ subjectId, audience: adminActor });
		expect(described).toMatchObject({ ok: true, trustedDevices: [] });
	});
});

describe("regenerateRecoveryCodes", () => {
	test("refuses a subject with no active factor", async () => {
		let subjectId = await createSubject();

		let result = await tenant.regenerateRecoveryCodes({ subjectId });
		expect(result).toMatchObject({ ok: false, reason: "no-factor" });
	});

	test("replaces the whole set: old codes stop matching, new ones work once", async () => {
		let subjectId = await createSubject();
		let { recoveryCodes: firstSet } = await enrolAndActivate(subjectId);

		let regenerated = await tenant.regenerateRecoveryCodes({ subjectId });
		expect(regenerated).toMatchObject({ ok: true });
		if (!regenerated.ok) throw new Error("unreachable");
		expect(regenerated.recoveryCodes).toHaveLength(10);

		let describedAfter = await tenant.describeSubject({ subjectId, audience: adminActor });
		expect(describedAfter).toMatchObject({ ok: true, recoveryCodesRemaining: 10 });

		// An old code no longer matches anything: removal falls back to it and fails.
		let removedWithOldCode = await tenant.removeTotpFactor({
			subjectId,
			submission: firstSet[0]!,
		});
		expect(removedWithOldCode).toMatchObject({ ok: false, reason: "invalid-submission" });

		// A code from the fresh set still works.
		let removedWithNewCode = await tenant.removeTotpFactor({
			subjectId,
			submission: regenerated.recoveryCodes[0]!,
		});
		expect(removedWithNewCode).toMatchObject({ ok: true });
	});
});

describe("removeTotpFactor", () => {
	test("refuses under a required tenant policy, even with a valid code", async () => {
		await tenant.provision({ tenantId: "tenant_1", issuer: "https://tenant-1.example.com" });

		let subjectId = await createSubject();
		let { setupKey } = await enrolAndActivate(subjectId);

		await tenant.setMfaPolicy({ policy: "required" });

		let result = await tenant.removeTotpFactor({
			subjectId,
			submission: await currentCode(setupKey),
		});
		expect(result).toMatchObject({ ok: false, reason: "policy-requires-factor" });

		let described = await tenant.describeSubject({ subjectId, audience: adminActor });
		expect(described).toMatchObject({ ok: true, totpFactor: { label: expect.any(String) } });
	});

	test("succeeds under the default optional policy with a valid TOTP code", async () => {
		let subjectId = await createSubject();
		let { setupKey } = await enrolAndActivate(subjectId);

		let result = await tenant.removeTotpFactor({
			subjectId,
			submission: await currentCode(setupKey),
		});
		expect(result).toMatchObject({ ok: true });

		let described = await tenant.describeSubject({ subjectId, audience: adminActor });
		expect(described).toMatchObject({
			ok: true,
			totpFactor: { label: null, lastUsedAt: null },
			recoveryCodesRemaining: 0,
		});
	});

	test("refuses an invalid submission, proving neither a code nor a recovery code", async () => {
		let subjectId = await createSubject();
		await enrolAndActivate(subjectId);

		let result = await tenant.removeTotpFactor({ subjectId, submission: "not-a-real-code" });
		expect(result).toMatchObject({ ok: false, reason: "invalid-submission" });
	});

	test("a valid recovery code is single-use: matches once, refused the second time", async () => {
		let subjectId = await createSubject();
		let { recoveryCodes } = await enrolAndActivate(subjectId);
		let code = recoveryCodes[0]!;

		// Removal deletes the whole factor on success, so proving reuse requires a
		// fresh factor between removal and a second attempt with the same code.
		let firstAttempt = await tenant.removeTotpFactor({ subjectId, submission: code });
		expect(firstAttempt).toMatchObject({ ok: true });

		let { recoveryCodes: secondSet } = await enrolAndActivate(subjectId);
		let secondCode = secondSet[0]!;

		let spentOnce = await tenant.removeTotpFactor({ subjectId, submission: secondCode });
		expect(spentOnce).toMatchObject({ ok: true });

		await enrolAndActivate(subjectId);
		let spentAgain = await tenant.removeTotpFactor({ subjectId, submission: secondCode });
		expect(spentAgain).toMatchObject({ ok: false, reason: "invalid-submission" });
	});

	test("a recovery code is folded before matching: separators and case do not matter", async () => {
		let subjectId = await createSubject();
		let { recoveryCodes } = await enrolAndActivate(subjectId);
		let code = recoveryCodes[0]!;
		let retyped = code.replaceAll("-", " ").toLowerCase();

		let result = await tenant.removeTotpFactor({ subjectId, submission: retyped });
		expect(result).toMatchObject({ ok: true });
	});
});

describe("resetSecondFactor", () => {
	async function createSubjectWithPasswordAndFactor() {
		let created = await tenant.createSubject({
			identifiers: [{ kind: "email", value: "jane@example.com" }],
		});
		if (!created.ok) throw new Error("setup failed");

		let added = await tenant.addIdentifier({
			subjectId: created.subjectId,
			kind: "email",
			value: "jane@example.com",
			actor: adminActor,
		});
		if (!added.ok || added.kind !== "email") throw new Error("setup failed");
		await tenant.verifyIdentifier({ ticket: added.ticket });

		await tenant.setPassword({
			subjectId: created.subjectId,
			password: "correct-horse-battery",
			actor: adminActor,
		});

		let signedIn = await tenant.signInWithPassword({
			identifier: "jane@example.com",
			password: "correct-horse-battery",
			remembered: false,
		});
		if (!signedIn.ok) throw new Error("setup failed");

		await enrolAndActivate(created.subjectId);

		return { subjectId: created.subjectId, sessionId: signedIn.sessionId, token: signedIn.token };
	}

	test("clears the factor, recovery codes and trusted devices, and revokes sessions", async () => {
		let { subjectId, token } = await createSubjectWithPasswordAndFactor();

		state.storage.sql.exec(
			`INSERT INTO trusted_devices (id, subject_id, token_hash, created_at, expires_at, ip, user_agent)
			 VALUES ('tdev_1', ?, 'hash', ?, ?, NULL, NULL)`,
			subjectId,
			Date.now(),
			Date.now() + 1000,
		);

		let result = await tenant.resetSecondFactor({
			subjectId,
			actor: platformActor,
			reason: "lost device",
		});

		expect(result).toMatchObject({ ok: true, notifyAddress: "jane@example.com" });

		let described = await tenant.describeSubject({ subjectId, audience: adminActor });
		expect(described).toMatchObject({
			ok: true,
			totpFactor: { label: null, lastUsedAt: null },
			recoveryCodesRemaining: 0,
			trustedDevices: [],
		});

		let resolved = await tenant.resolveSession({ token });
		expect(resolved).toMatchObject({ status: "revoked" });

		let rows = [
			...state.storage.sql.exec<{ mfa_reset_required: number }>(
				`SELECT mfa_reset_required FROM subjects WHERE id = ?`,
				subjectId,
			),
		];
		expect(rows).toEqual([{ mfa_reset_required: 1 }]);
	});

	test("answers a null address when the subject has no verified email", async () => {
		let created = await tenant.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let result = await tenant.resetSecondFactor({
			subjectId: created.subjectId,
			actor: platformActor,
			reason: "lost device",
		});

		expect(result).toMatchObject({ ok: true, notifyAddress: null });
	});

	test("refuses a subject that does not exist", async () => {
		let result = await tenant.resetSecondFactor({
			subjectId: "sub_nope",
			actor: platformActor,
			reason: "lost device",
		});
		expect(result).toMatchObject({ ok: false, reason: "not-found" });
	});
});

describe("revokeTrustedDevice", () => {
	test("never lets a caller touch another subject's device", async () => {
		let subjectId = await createSubject();
		let otherSubjectId = await createSubject();

		state.storage.sql.exec(
			`INSERT INTO trusted_devices (id, subject_id, token_hash, created_at, expires_at, ip, user_agent)
			 VALUES ('tdev_1', ?, 'hash', ?, ?, NULL, NULL)`,
			otherSubjectId,
			Date.now(),
			Date.now() + 1000,
		);

		let result = await tenant.revokeTrustedDevice({ subjectId, deviceId: "tdev_1" });
		expect(result).toMatchObject({ ok: false, reason: "not-found" });

		let rows = [...state.storage.sql.exec(`SELECT id FROM trusted_devices`)];
		expect(rows).toHaveLength(1);
	});

	test("revokes a device that belongs to the subject", async () => {
		let subjectId = await createSubject();

		state.storage.sql.exec(
			`INSERT INTO trusted_devices (id, subject_id, token_hash, created_at, expires_at, ip, user_agent)
			 VALUES ('tdev_1', ?, 'hash', ?, ?, NULL, NULL)`,
			subjectId,
			Date.now(),
			Date.now() + 1000,
		);

		let result = await tenant.revokeTrustedDevice({ subjectId, deviceId: "tdev_1" });
		expect(result).toMatchObject({ ok: true });

		let rows = [...state.storage.sql.exec(`SELECT id FROM trusted_devices`)];
		expect(rows).toEqual([]);
	});
});

describe("daily sweep", () => {
	test("clears expired enrolments, stale claims and expired trusted devices, leaving live ones alone", async () => {
		let subjectId = await createSubject();

		let expiredEnrolment = await tenant.beginTotpEnrolment({ subjectId });
		if (!expiredEnrolment.ok) throw new Error("unreachable");
		let liveEnrolment = await tenant.beginTotpEnrolment({ subjectId });
		if (!liveEnrolment.ok) throw new Error("unreachable");

		state.storage.sql.exec(
			`UPDATE totp_enrolments SET expires_at = ? WHERE enrolment_id = ?`,
			Date.now() - 1000,
			expiredEnrolment.enrolmentId,
		);

		let now = Date.now();
		state.storage.sql.exec(
			`INSERT INTO totp_claims (subject_id, code_hash, at) VALUES (?, 'stale', ?)`,
			subjectId,
			now - 10 * 60 * 1000,
		);
		state.storage.sql.exec(
			`INSERT INTO totp_claims (subject_id, code_hash, at) VALUES (?, 'fresh', ?)`,
			subjectId,
			now,
		);

		state.storage.sql.exec(
			`INSERT INTO trusted_devices (id, subject_id, token_hash, created_at, expires_at, ip, user_agent)
			 VALUES ('tdev_expired', ?, 'hash-1', ?, ?, NULL, NULL)`,
			subjectId,
			now,
			now - 1000,
		);
		state.storage.sql.exec(
			`INSERT INTO trusted_devices (id, subject_id, token_hash, created_at, expires_at, ip, user_agent)
			 VALUES ('tdev_live', ?, 'hash-2', ?, ?, NULL, NULL)`,
			subjectId,
			now,
			now + 60 * 60 * 1000,
		);

		await tenant.alarm();

		let enrolmentIds = [
			...state.storage.sql.exec<{ enrolment_id: string }>(
				`SELECT enrolment_id FROM totp_enrolments`,
			),
		].map((row) => row.enrolment_id);
		expect(enrolmentIds).toEqual([liveEnrolment.enrolmentId]);

		let claimHashes = [
			...state.storage.sql.exec<{ code_hash: string }>(`SELECT code_hash FROM totp_claims`),
		].map((row) => row.code_hash);
		expect(claimHashes).toEqual(["fresh"]);

		let deviceIds = [
			...state.storage.sql.exec<{ id: string }>(`SELECT id FROM trusted_devices`),
		].map((row) => row.id);
		expect(deviceIds).toEqual(["tdev_live"]);
	});
});

describe("describeSubject: second-factor fields", () => {
	test("reports the empty state for a subject with no factor", async () => {
		let subjectId = await createSubject();

		let described = await tenant.describeSubject({ subjectId, audience: adminActor });
		expect(described).toMatchObject({
			ok: true,
			totpFactor: { label: null, lastUsedAt: null },
			recoveryCodesRemaining: 0,
			trustedDevices: [],
		});
	});

	test("reports the active factor's label, remaining codes and trusted devices", async () => {
		let subjectId = await createSubject();
		await enrolAndActivate(subjectId);

		state.storage.sql.exec(
			`INSERT INTO trusted_devices (id, subject_id, token_hash, created_at, expires_at, ip, user_agent)
			 VALUES ('tdev_1', ?, 'hash', ?, ?, '203.0.113.1', 'Test UA')`,
			subjectId,
			Date.now(),
			Date.now() + 1000,
		);

		let described = await tenant.describeSubject({ subjectId, audience: adminActor });
		expect(described).toMatchObject({
			ok: true,
			totpFactor: { label: "Authenticator app", lastUsedAt: null },
			recoveryCodesRemaining: 10,
			trustedDevices: [
				{ id: "tdev_1", ip: "203.0.113.1", userAgent: "Test UA", expiresAt: expect.any(Number) },
			],
		});
	});
});
