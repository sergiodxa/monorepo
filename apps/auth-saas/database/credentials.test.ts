/**
 * Proves the cross-cutting remaining-credential check: removing a password,
 * revoking a passkey, or removing an identifier is refused only when nothing else
 * the subject holds would still let it sign in, counting across all three kinds
 * rather than each module's own narrower view of the subject.
 *
 * Drives everything through the `Tenant` object, the level at which `tenant-do.ts`
 * computes the fuller answer before delegating — a passkey row is inserted directly
 * against the object's own storage rather than through a full WebAuthn ceremony,
 * since only its presence in the count matters here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurableObjectStateMock } from "@sdxc/cloudflare-mocks";

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { beforeEach, describe, expect, test } from "vitest";

import Tenant from "./tenant-do";

let state: DurableObjectStateMock;
let tenant: Tenant;

let adminActor = { kind: "admin" } as const;

beforeEach(() => {
	state = createDurableObjectState();
	tenant = new Tenant(state, {} as Cloudflare.Env);
});

/** Inserts a passkey row directly, standing in for a completed enrollment ceremony. */
function insertPasskey(subjectId: string, credentialId: string) {
	state.storage.sql.exec(
		`INSERT INTO passkeys
			(credential_id, subject_id, public_key, algorithm, counter, transports, aaguid, label, syncable, backed_up, suspended, created_at, last_used_at)
		 VALUES (?, ?, 'key', -7, 0, '[]', NULL, 'Passkey', 0, 0, 0, ?, NULL)`,
		credentialId,
		subjectId,
		Date.now(),
	);
}

describe("removePassword", () => {
	test("succeeds when the subject also holds a passkey, with no verified identifier", async () => {
		let created = await tenant.createSubject({
			identifiers: [{ kind: "email", value: "jane@example.com" }],
		});
		if (!created.ok) throw new Error("setup failed");

		await tenant.setPassword({
			subjectId: created.subjectId,
			password: "correct-horse-battery",
			actor: adminActor,
		});
		insertPasskey(created.subjectId, "cred_a");

		let result = await tenant.removePassword({ subjectId: created.subjectId });

		expect(result).toMatchObject({ ok: true });
	});

	test("refuses when the subject has no other credential", async () => {
		let created = await tenant.createSubject({
			identifiers: [{ kind: "email", value: "jane@example.com" }],
		});
		if (!created.ok) throw new Error("setup failed");

		await tenant.setPassword({
			subjectId: created.subjectId,
			password: "correct-horse-battery",
			actor: adminActor,
		});

		let result = await tenant.removePassword({ subjectId: created.subjectId });

		expect(result).toMatchObject({ ok: false, reason: "last-credential" });
	});
});

describe("revokePasskey", () => {
	test("succeeds when the subject also holds a password, with no verified identifier", async () => {
		let created = await tenant.createSubject({
			identifiers: [{ kind: "email", value: "jane@example.com" }],
		});
		if (!created.ok) throw new Error("setup failed");

		await tenant.setPassword({
			subjectId: created.subjectId,
			password: "correct-horse-battery",
			actor: adminActor,
		});
		insertPasskey(created.subjectId, "cred_a");

		let result = await tenant.revokePasskey({
			subjectId: created.subjectId,
			credentialId: "cred_a",
		});

		expect(result).toMatchObject({ ok: true });
	});

	test("refuses when the subject has no other credential", async () => {
		let created = await tenant.createSubject({
			identifiers: [{ kind: "email", value: "jane@example.com" }],
		});
		if (!created.ok) throw new Error("setup failed");

		insertPasskey(created.subjectId, "cred_a");

		let result = await tenant.revokePasskey({
			subjectId: created.subjectId,
			credentialId: "cred_a",
		});

		expect(result).toMatchObject({ ok: false, reason: "last-credential" });
	});
});

describe("removeIdentifier", () => {
	test("succeeds removing a subject's only verified email when a password remains", async () => {
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

		let result = await tenant.removeIdentifier({
			subjectId: created.subjectId,
			value: "jane@example.com",
			actor: adminActor,
		});

		expect(result).toMatchObject({ ok: true, promotedPrimary: null, notify: [] });
	});

	test("refuses removing a subject's only verified email with no other credential", async () => {
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

		let result = await tenant.removeIdentifier({
			subjectId: created.subjectId,
			value: "jane@example.com",
			actor: adminActor,
		});

		expect(result).toMatchObject({ ok: false, reason: "last-verified-identifier" });
	});
});
