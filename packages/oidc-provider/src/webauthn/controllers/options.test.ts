/**
 * Integration tests for the WebAuthn options endpoints, driven through the real
 * provider router's `fetch` path (the same service-container scope the host uses).
 *
 * They guard two fixed correctness bugs: registration options must not persist a
 * subject (so the options->verify flow works for a genuinely new email), and
 * authentication options must return each authenticator's WebAuthn `credential_id`
 * (base64url) in `allowCredentials` — never the database primary key — while
 * excluding legacy passkeys that have no stored credential id.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Database as SqliteDatabase } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { Logger } from "@pkg/logger/request";
import { createDatabase, type Database } from "remix/data-table";

import type { AnalyticsSink } from "../../index";

import { createProviderRouter } from "../../provider";
import { clearUserRateLimitCache } from "../../shared/lib/user-rate-limit";
import { createBunSqliteDatabaseAdapter } from "../../shared/test/db";
import { createSubject } from "../../shared/test/fixtures";
import Subject from "../../subjects/models/subject";
import Passkey from "../models/passkey";

/** No-op analytics sink, mirroring the provider's self-hosted default. */
let analytics: AnalyticsSink = {
	trackAuthentication() {},
	trackRegistration() {},
};

/** Shape of the successful options response envelope. */
interface OptionsResponse {
	challengeId: string;
	options: {
		challenge: string;
		allowCredentials?: Array<{ id: string; type: string; transports?: string[] }>;
	};
}

let sqliteDb: SqliteDatabase;
let db: Database;

/**
 * Drives a request through the real provider router bound to the shared test `db`,
 * exercising the same per-request container scope as production.
 * @param request - The request to dispatch.
 * @returns The router's response.
 */
function fetchThroughProvider(request: Request): Promise<Response> {
	let logger = new Logger(request);
	let router = createProviderRouter(db, logger, { internalSecret: "test-secret", analytics });
	return router.fetch(request);
}

/**
 * Builds a form-encoded POST request for a WebAuthn options endpoint.
 * @param path - The endpoint path (e.g. `webauthn/register/options`).
 * @param fields - The form fields to send.
 * @returns A POST `Request` with a URL-encoded body.
 */
function formPost(path: string, fields: Record<string, string>): Request {
	let body = new URLSearchParams(fields);
	return new Request(`https://auth.example.com/${path}`, {
		method: "POST",
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body,
	});
}

describe("WebAuthn options endpoints", () => {
	beforeEach(async () => {
		sqliteDb = new SqliteDatabase(":memory:");
		let { default: migration0001 } = await import("../../migrations/0001-init.sql?raw");
		let { default: migration0006 } =
			await import("../../migrations/0006-add-passkey-credential-id.sql?raw");
		sqliteDb.run(migration0001);
		sqliteDb.run(migration0006);
		db = createDatabase(createBunSqliteDatabaseAdapter(sqliteDb));
		clearUserRateLimitCache();
	});

	afterEach(() => {
		sqliteDb.close();
		clearUserRateLimitCache();
	});

	describe("register/options", () => {
		test("succeeds for a genuinely new email without persisting a subject", async () => {
			let email = `new-${crypto.randomUUID()}@example.com`;

			let response = await fetchThroughProvider(formPost("webauthn/register/options", { email }));

			expect(response.status).toBe(200);
			let payload = (await response.json()) as OptionsResponse;
			expect(payload.challengeId).toBeString();
			expect(payload.options.challenge).toBeString();

			// The core regression: options must NOT create the subject. If it did, the
			// follow-up register/verify would reject with "subject already exists" and the
			// normal options->verify flow could never complete for a new email.
			let subject = await Subject.findByEmail(db, email);
			expect(subject).toBeNull();
		});

		test("still rejects an email whose subject already has a passkey", async () => {
			let subject = await createSubject(db, { verified: true });
			await Passkey.create(db, {
				subjectId: subject.id,
				credentialId: "existing-cred",
				publicKey: "key",
				counter: 0,
			});

			let response = await fetchThroughProvider(
				formPost("webauthn/register/options", { email: subject.email }),
			);

			expect(response.status).toBe(400);
			let payload = (await response.json()) as { error: string };
			expect(payload.error).toContain("already has a passkey");
		});
	});

	describe("auth/options", () => {
		test("returns the WebAuthn credential_id (base64url) in allowCredentials, not the db id", async () => {
			let subject = await createSubject(db, { verified: true });

			// A realistic unpadded base64url credential id, distinct from any UUID pk.
			let credentialId = "AQIDBAUGBwgJCgsMDQ4PEA";
			await Passkey.create(db, {
				subjectId: subject.id,
				credentialId,
				publicKey: "key",
				counter: 0,
				transports: "internal,hybrid",
			});

			let stored = (await Passkey.listBySubject(db, subject.id))[0]!;

			let response = await fetchThroughProvider(
				formPost("webauthn/auth/options", { email: subject.email }),
			);

			expect(response.status).toBe(200);
			let payload = (await response.json()) as OptionsResponse;
			let allow = payload.options.allowCredentials ?? [];
			expect(allow).toHaveLength(1);
			// The id must be the credential_id, not the database primary key (UUID).
			expect(allow[0]!.id).toBe(credentialId);
			expect(allow[0]!.id).not.toBe(stored.id);
			expect(allow[0]!.transports).toEqual(["internal", "hybrid"]);
		});

		test("excludes passkeys that have no stored credential_id", async () => {
			let subject = await createSubject(db, { verified: true });

			// Usable passkey with a credential id.
			let usableCredentialId = "dXNhYmxlLWNyZWQtaWQ";
			await Passkey.create(db, {
				subjectId: subject.id,
				credentialId: usableCredentialId,
				publicKey: "key-usable",
				counter: 0,
			});

			// Legacy passkey migrated before credential_id was persisted (migration 0006).
			await db.create(Passkey.table, {
				id: crypto.randomUUID(),
				subject_id: subject.id,
				credential_id: null,
				public_key: "key-legacy",
				counter: 0,
				device_type: null,
				backed_up: false,
				transports: null,
				name: null,
				created_at: new Date().toISOString(),
				last_used_at: null,
			});

			let response = await fetchThroughProvider(
				formPost("webauthn/auth/options", { email: subject.email }),
			);

			expect(response.status).toBe(200);
			let payload = (await response.json()) as OptionsResponse;
			let allow = payload.options.allowCredentials ?? [];
			expect(allow).toHaveLength(1);
			expect(allow[0]!.id).toBe(usableCredentialId);
		});

		test("rejects a subject whose only passkey has a null credential_id", async () => {
			let subject = await createSubject(db, { verified: true });

			await db.create(Passkey.table, {
				id: crypto.randomUUID(),
				subject_id: subject.id,
				credential_id: null,
				public_key: "key-legacy",
				counter: 0,
				device_type: null,
				backed_up: false,
				transports: null,
				name: null,
				created_at: new Date().toISOString(),
				last_used_at: null,
			});

			let response = await fetchThroughProvider(
				formPost("webauthn/auth/options", { email: subject.email }),
			);

			expect(response.status).toBe(400);
			let payload = (await response.json()) as { error: string };
			expect(payload.error).toContain("No passkey found");
		});
	});
});
