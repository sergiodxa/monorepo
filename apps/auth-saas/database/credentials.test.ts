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

/** Inserts a connection row directly, standing in for one `saveConnection` would have written. */
function insertConnection(connectionId: string, enabled: boolean) {
	state.storage.sql.exec(
		`INSERT INTO connections
			(id, slug, kind, catalog_entry, display_name, enabled, issuer, authorization_endpoint, token_endpoint, userinfo_endpoint, client_id, client_secret_sealed, scopes, subject_claim, email_authority, auto_link, on_unknown_subject, created_at, updated_at, organization_id)
		 VALUES (?, ?, 'oidc', NULL, 'Test Connection', ?, NULL, NULL, NULL, NULL, 'client', NULL, '[]', 'sub', 0, 0, 'create', ?, ?, NULL)`,
		connectionId,
		connectionId,
		enabled ? 1 : 0,
		Date.now(),
		Date.now(),
	);
}

/** Inserts a linked identity row directly, standing in for one a completed sign-in would have written. */
function insertConnectionIdentity(connectionId: string, subjectId: string) {
	state.storage.sql.exec(
		`INSERT INTO connection_identities
			(connection_id, provider_subject, subject_id, access_token_sealed, refresh_token_sealed, token_expires_at, provider_email, provider_email_verified, linked_by, linked_at, last_sign_in_at, granted_scopes, claims_json, created_at, updated_at)
		 VALUES (?, ?, ?, NULL, NULL, NULL, NULL, NULL, 'jit', ?, NULL, NULL, NULL, ?, ?)`,
		connectionId,
		`provider-subject-${subjectId}`,
		subjectId,
		Date.now(),
		Date.now(),
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

	test("succeeds when the subject also holds a linked identity on an enabled connection, with no verified identifier", async () => {
		let created = await tenant.createSubject({
			identifiers: [{ kind: "email", value: "jane@example.com" }],
		});
		if (!created.ok) throw new Error("setup failed");

		await tenant.setPassword({
			subjectId: created.subjectId,
			password: "correct-horse-battery",
			actor: adminActor,
		});
		insertConnection("conn_enabled", true);
		insertConnectionIdentity("conn_enabled", created.subjectId);

		let result = await tenant.removePassword({ subjectId: created.subjectId });

		expect(result).toMatchObject({ ok: true });
	});

	test("refuses when the subject's only linked identity is on a disabled connection", async () => {
		let created = await tenant.createSubject({
			identifiers: [{ kind: "email", value: "jane@example.com" }],
		});
		if (!created.ok) throw new Error("setup failed");

		await tenant.setPassword({
			subjectId: created.subjectId,
			password: "correct-horse-battery",
			actor: adminActor,
		});
		insertConnection("conn_disabled", false);
		insertConnectionIdentity("conn_disabled", created.subjectId);

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
