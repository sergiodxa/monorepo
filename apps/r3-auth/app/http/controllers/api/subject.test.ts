/**
 * Router-level tests of the subject-lookup API. It is a frozen contract with software
 * that is already deployed, so these assert the exact envelope, the exact payload field
 * names and formats, the exact KV key the cache lives under, that a token issued for
 * anything other than this server is refused, and that a client reads only its own users.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test } from "vitest";

import type { TestApp } from "~/app/lib/test/http";
import type { Fixtures } from "~/app/lib/test/seed";

import Grant from "~/app/data/grant";
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
 * Runs the grant byte for byte the way the published client library sends it: a multipart
 * body and an `Authorization: Basic` header encoded with base64url. Both details break
 * silently, leaving a client that fails to authenticate with no message saying why.
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

async function fetchSubject(subjectId: string, token?: string): Promise<Response> {
	return await app.fetch(
		new Request(`${ORIGIN}${routes.api.subject.href({ subjectId })}`, {
			headers: token ? { Authorization: `Bearer ${token}` } : {},
		}),
	);
}

/**
 * The seeded subject starts out having authorized the seeded client, the consent every
 * real sign-in records, since that is what entitles the client to look them up.
 */
beforeEach(async () => {
	app = await createTestApp();
	fixtures = await seed(app);
	await Grant.findOrCreate(app.db, fixtures.subjectId, fixtures.clientId);
});

describe("GET /api/subjects/:subjectId", () => {
	test("returns the subject for a client-credentials token", async () => {
		let token = await clientCredentialsToken();

		let response = await fetchSubject(fixtures.subjectId, token);
		expect(response.status).toBe(200);

		let body = (await response.json()) as SubjectEnvelope;

		expect(body.subject.id).toBe(fixtures.subjectId);
		expect(body.subject.displayName).toBe("Jane Doe");
		expect(body.subject.username).toBe("jane");
		expect(body.subject.emailAddress).toBe("jane@example.com");
		expect(body.subject.avatar).toBe("https://example.com/jane.png");
		expect(body.subject.role).toBe("user");
		expect(body.subject.emailVerifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
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

		await new Promise((resolve) => setTimeout(resolve, 0));

		let key = `clients:${fixtures.clientId}:subjects:${fixtures.subjectId}`;
		let cached = await app.kv.get(key, "json");

		expect(cached).toMatchObject({
			id: fixtures.subjectId,
			displayName: "Jane Doe",
			emailAddress: "jane@example.com",
			role: "user",
		});
	});

	test("serves a cached payload instead of re-reading the subject", async () => {
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

		await Subject.update(app.db, fixtures.subjectId, { display_name: "Stored Name" });

		let response = await fetchSubject(fixtures.subjectId, token);
		expect(response.status).toBe(200);

		let body = (await response.json()) as SubjectEnvelope;
		expect(body.subject.displayName).toBe("Cached Name");
		expect(body.subject.role).toBe("admin");
	});

	test("falls back to the database when the cached entry is unreadable", async () => {
		let token = await clientCredentialsToken();
		let key = `clients:${fixtures.clientId}:subjects:${fixtures.subjectId}`;

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

	/**
	 * A client looks up the people who signed in to it. Anyone else answers exactly like a
	 * subject that does not exist, so a client cannot even confirm an id belongs to someone.
	 */
	test("answers 404 for a subject who never authorized the calling client", async () => {
		let stranger = await Subject.create(app.db, {
			email_address: "stranger@example.com",
			display_name: "Stranger",
			username: "stranger",
			avatar: "https://example.com/stranger.png",
		});
		let token = await clientCredentialsToken();

		let response = await fetchSubject(stranger.id, token);
		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: "Subject not found" });
	});

	/**
	 * The account area promises that revoking an app's access cuts it off, so withdrawn
	 * consent is honored on the next request, ahead of a copy this client already cached.
	 */
	test("answers 404 once the subject revokes the client's access, cached copy or not", async () => {
		let token = await clientCredentialsToken();
		expect((await fetchSubject(fixtures.subjectId, token)).status).toBe(200);
		await new Promise((resolve) => setTimeout(resolve, 0));

		await Grant.deleteBySubjectAndClient(app.db, fixtures.subjectId, fixtures.clientId);

		let response = await fetchSubject(fixtures.subjectId, token);
		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: "Subject not found" });
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
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(await app.kv.get(`clients:${fixtures.clientId}`, "json")).toMatchObject({
			id: fixtures.clientId,
		});
	});

	test("accepts a client entry written in the other worker's shape", async () => {
		let token = await clientCredentialsToken();

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
		await new Promise((resolve) => setTimeout(resolve, 0));

		let raw = await app.kv.get(`clients:${fixtures.clientId}`, "text");
		expect(raw).not.toContain(fixtures.clientSecret);
	});
});
