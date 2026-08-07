/**
 * Router-level tests of the subject-lookup API. It is a frozen contract with software
 * that is already deployed, so these assert the exact envelope, the exact payload field
 * names and formats, the exact KV key the cache lives under, and that a token issued for
 * anything other than this server is refused.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test } from "bun:test";

import type { TestApp } from "~/app/lib/test/http";
import type { Fixtures } from "~/app/lib/test/seed";

import Subject from "~/app/data/subject";
import { createTestApp } from "~/app/lib/test/http";
import { ORIGIN, seed, signIn } from "~/app/lib/test/seed";
import { clients } from "~/database/schema";
import routes from "~/routes/web";

let app: TestApp;
let fixtures: Fixtures;

/** The payload shape every caller of this endpoint parses. */
interface SubjectEnvelope {
	subject: {
		id: string;
		createdAt: string;
		updatedAt: string;
		emailVerifiedAt: string | null;
		displayName: string;
		avatar: string;
		role: string;
		username: string;
		emailAddress: string;
	};
}

/** Runs a `client_credentials` grant and returns the access token it issued. */
async function clientCredentialsToken(): Promise<string> {
	let credentials = btoa(`${fixtures.clientId}:${fixtures.clientSecret}`);

	let response = await app.fetch(
		new Request(`${ORIGIN}${routes.oauth.token.href()}`, {
			method: "POST",
			headers: {
				"content-type": "application/x-www-form-urlencoded",
				Authorization: `Basic ${credentials}`,
			},
			body: new URLSearchParams({ grant_type: "client_credentials" }),
		}),
	);

	expect(response.status).toBe(200);
	let tokens = (await response.json()) as { access_token: string };
	return tokens.access_token;
}

/**
 * Runs the grant exactly the way the published client library sends it: a multipart body
 * and an `Authorization: Basic` header encoded with base64url rather than base64.
 *
 * Both details are easy to break and neither fails visibly — the symptom is a client that
 * cannot authenticate and no message saying why — so this is the byte-level companion to
 * the library-driven test, which cannot post a multipart body through its interception.
 */
async function clientCredentialsTokenAsTheLibrarySendsIt(): Promise<Response> {
	let credentials = btoa(`${fixtures.clientId}:${fixtures.clientSecret}`)
		.replace(/=/g, "")
		.replace(/\+/g, "-")
		.replace(/\//g, "_");

	let body = new FormData();
	body.append("grant_type", "client_credentials");

	return await app.fetch(
		new Request(`${ORIGIN}${routes.oauth.token.href()}`, {
			method: "POST",
			headers: { Authorization: `Basic ${credentials}` },
			body,
		}),
	);
}

/** Calls the endpoint for a subject id, optionally with a bearer token. */
async function fetchSubject(subjectId: string, token?: string): Promise<Response> {
	return await app.fetch(
		new Request(`${ORIGIN}${routes.api.subject.href({ subjectId })}`, {
			headers: token ? { Authorization: `Bearer ${token}` } : {},
		}),
	);
}

beforeEach(async () => {
	app = await createTestApp();
	fixtures = await seed(app);
});

describe("GET /api/subjects/:subjectId", () => {
	test("returns the subject for a client-credentials token", async () => {
		let token = await clientCredentialsToken();

		let response = await fetchSubject(fixtures.subjectId, token);
		expect(response.status).toBe(200);

		let body = (await response.json()) as SubjectEnvelope;

		// Every field name and format here is parsed by deployed software.
		expect(body.subject.id).toBe(fixtures.subjectId);
		expect(body.subject.displayName).toBe("Jane Doe");
		expect(body.subject.username).toBe("jane");
		expect(body.subject.emailAddress).toBe("jane@example.com");
		expect(body.subject.avatar).toBe("https://example.com/jane.png");
		expect(body.subject.role).toBe("user");
		expect(body.subject.emailVerifiedAt).toBeNull();
		expect(new Date(body.subject.createdAt).getTime()).toBeGreaterThan(0);
		expect(body.subject.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
		expect(body.subject.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
	});

	test("accepts the token request in the exact form the published library sends it", async () => {
		let response = await clientCredentialsTokenAsTheLibrarySendsIt();
		expect(response.status).toBe(200);

		let tokens = (await response.json()) as { access_token: string };
		let subject = await fetchSubject(fixtures.subjectId, tokens.access_token);
		expect(subject.status).toBe(200);
	});

	test("reports Server-Timing measurements", async () => {
		let token = await clientCredentialsToken();
		let response = await fetchSubject(fixtures.subjectId, token);

		let timings = response.headers.get("Server-Timing");
		expect(timings).toContain("auth");
		expect(timings).toContain("db");
		expect(timings).toContain("cache");
	});

	test("caches the payload under the shared per-client key", async () => {
		let token = await clientCredentialsToken();
		await fetchSubject(fixtures.subjectId, token);

		// Let the background write settle: the put is handed to `waitUntil`.
		await Bun.sleep(0);

		let key = `clients:${fixtures.clientId}:subjects:${fixtures.subjectId}`;
		let cached = await app.kv.get(key, "json");

		// The stored JSON is the response payload verbatim, because the other worker
		// serving this API reads this same entry and returns it as-is.
		expect(cached).toMatchObject({
			id: fixtures.subjectId,
			displayName: "Jane Doe",
			emailAddress: "jane@example.com",
			role: "user",
		});
	});

	test("serves a cached payload without reading the database", async () => {
		let token = await clientCredentialsToken();
		let key = `clients:${fixtures.clientId}:subjects:${fixtures.subjectId}`;

		await app.kv.put(
			key,
			JSON.stringify({
				id: fixtures.subjectId,
				createdAt: "2026-01-01T00:00:00.000Z",
				updatedAt: "2026-01-02T00:00:00.000Z",
				emailVerifiedAt: null,
				displayName: "Cached Name",
				avatar: "https://example.com/cached.png",
				role: "admin",
				username: "cached",
				emailAddress: "cached@example.com",
			}),
		);

		// Deleting the row proves the answer came from the cache and not the database.
		await Subject.delete(app.db, fixtures.subjectId);

		let response = await fetchSubject(fixtures.subjectId, token);
		expect(response.status).toBe(200);

		let body = (await response.json()) as SubjectEnvelope;
		expect(body.subject.displayName).toBe("Cached Name");
		expect(body.subject.role).toBe("admin");
	});

	test("falls back to the database when the cached entry is unreadable", async () => {
		let token = await clientCredentialsToken();
		let key = `clients:${fixtures.clientId}:subjects:${fixtures.subjectId}`;

		// An entry no schema can read must never be handed to a client as-is.
		await app.kv.put(key, JSON.stringify({ id: fixtures.subjectId, displayName: 42 }));

		let response = await fetchSubject(fixtures.subjectId, token);
		expect(response.status).toBe(200);

		let body = (await response.json()) as SubjectEnvelope;
		expect(body.subject.displayName).toBe("Jane Doe");
	});

	test("does not answer one client from another client's cache", async () => {
		let token = await clientCredentialsToken();

		await app.kv.put(
			`clients:someone-else:subjects:${fixtures.subjectId}`,
			JSON.stringify({
				id: fixtures.subjectId,
				createdAt: "2026-01-01T00:00:00.000Z",
				updatedAt: "2026-01-01T00:00:00.000Z",
				emailVerifiedAt: null,
				displayName: "Other Client's Copy",
				avatar: "https://example.com/other.png",
				role: "user",
				username: "other",
				emailAddress: "other@example.com",
			}),
		);

		let body = (await (await fetchSubject(fixtures.subjectId, token)).json()) as SubjectEnvelope;
		expect(body.subject.displayName).toBe("Jane Doe");
	});

	test("answers 404 for an unknown subject", async () => {
		let token = await clientCredentialsToken();

		let response = await fetchSubject("00000000-0000-0000-0000-000000000000", token);
		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: "Subject not found" });
		expect(response.headers.get("Server-Timing")).toContain("auth");
	});

	test("answers 401 without a token", async () => {
		let response = await fetchSubject(fixtures.subjectId);
		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: "Unauthorized" });
	});

	test("answers 401 for a garbage or non-Bearer token", async () => {
		expect((await fetchSubject(fixtures.subjectId, "not-a-jwt")).status).toBe(401);

		let response = await app.fetch(
			new Request(`${ORIGIN}${routes.api.subject.href({ subjectId: fixtures.subjectId })}`, {
				headers: { Authorization: `Basic ${btoa("a:b")}` },
			}),
		);
		expect(response.status).toBe(401);
	});

	test("refuses a person's access token, which is issued for the client and not for this server", async () => {
		let tokens = await signIn(app, fixtures);

		let response = await fetchSubject(fixtures.subjectId, tokens.access_token);
		expect(response.status).toBe(401);
	});

	test("refuses a token whose client has been deleted before it was ever cached", async () => {
		let token = await clientCredentialsToken();
		await app.db.deleteMany(clients, { where: { id: fixtures.clientId } });

		let response = await fetchSubject(fixtures.subjectId, token);
		expect(response.status).toBe(401);
	});

	test("caches the resolved client under the shared key", async () => {
		let token = await clientCredentialsToken();
		await fetchSubject(fixtures.subjectId, token);
		await Bun.sleep(0);

		expect(await app.kv.get(`clients:${fixtures.clientId}`, "json")).toMatchObject({
			id: fixtures.clientId,
		});
	});

	test("accepts a client entry written in the other worker's shape", async () => {
		let token = await clientCredentialsToken();

		// The other worker caches its whole client row under this key. Reading it must
		// work, and it must not be treated as unreadable.
		await app.kv.put(
			`clients:${fixtures.clientId}`,
			JSON.stringify({
				id: fixtures.clientId,
				createdAt: "2026-01-01T00:00:00.000Z",
				name: "Client App",
				secret: fixtures.clientSecret,
				redirectUri: "https://client.example.com/callback",
			}),
		);

		expect((await fetchSubject(fixtures.subjectId, token)).status).toBe(200);
	});

	test("never returns the client secret in the cached client entry it writes", async () => {
		let token = await clientCredentialsToken();
		await fetchSubject(fixtures.subjectId, token);
		await Bun.sleep(0);

		let raw = await app.kv.get(`clients:${fixtures.clientId}`, "text");
		expect(raw).not.toContain(fixtures.clientSecret);
	});
});
