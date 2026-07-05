/**
 * Drives the real `/oauth/token` controller end-to-end (through the same
 * asyncContext + form-data middleware and service-container DI the provider wires
 * in production) to cover two security invariants: RFC 8707 `allowed_resources`
 * enforcement on the client_credentials grant, and refresh-token gating so a
 * refresh token is issued only when `offline_access` was granted.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { Database as SqliteDatabase } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";

import { Logger } from "@pkg/logger/request";
import { ServiceContainer } from "@pkg/service-container";
import { asyncContext } from "remix/async-context-middleware";
import { Database, createDatabase } from "remix/data-table";
import { createRouter } from "remix/fetch-router";
import { formData } from "remix/form-data-middleware";

import Client from "../../clients/models/client";
import RedirectUri from "../../clients/models/redirect-uri";
import Secret from "../../clients/models/secret";
import TenantMeta from "../../management/models/tenant-meta";
import Resource from "../../resources/models/resource";
import routes from "../../routes";
import loggerMiddleware from "../../shared/middleware/logger";
import { createBunSqliteDatabaseAdapter } from "../../shared/test/db";
import { createSubject } from "../../shared/test/fixtures";
import SigningKey from "../../signing-keys/models/signing-key";
import AuthorizationCode from "../models/authorization-code";
import Session from "../models/session";

import token from "./token";

type Db = ReturnType<typeof createDatabase>;

/**
 * POSTs an application/x-www-form-urlencoded body to the token endpoint through a
 * minimal router that reuses the production middleware chain and resolves the
 * request `Database` from the service container, exactly as the provider does.
 */
async function postToken(db: Db, params: Record<string, string>): Promise<Response> {
	let request = new Request("https://auth.example.com/oauth/token", {
		method: "POST",
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams(params),
	});

	let container = new ServiceContainer();
	// Registered as a singleton (not `.instance`) so the request child-scope created
	// by `container.scope` can resolve it via `inject([Database])`.
	container.singleton(Database, () => db);

	let middleware = [asyncContext(), loggerMiddleware(new Logger(request)), formData() as never];
	let router = createRouter({ middleware });
	router.map(routes.oauth.token, token);

	return container.scope(() => router.fetch(request));
}

describe("POST /oauth/token — allowed_resources enforcement", () => {
	let sqliteDb: SqliteDatabase;
	let db: Db;
	let clientId: string;
	let clientSecret: string;

	beforeEach(async () => {
		sqliteDb = new SqliteDatabase(":memory:");
		let { default: migration } = await import("../../migrations/0001-init.sql?raw");
		sqliteDb.run(migration);
		db = createDatabase(createBunSqliteDatabaseAdapter(sqliteDb));

		await TenantMeta.setIssuer(db, "auth.example.com");
		await SigningKey.generate(db);

		await Client.create(db, {
			name: "M2M Client",
			type: "m2m",
			allowedResources: ["https://api.allowed.com"],
		});
		let client = (await Client.list(db)).find((c) => c.name === "M2M Client")!;
		clientId = client.id;
		clientSecret = (await Secret.create(db, client.id)).plainSecret;
	});

	test("rejects a resource that is not on the client's allow-list", async () => {
		let response = await postToken(db, {
			grant_type: "client_credentials",
			client_id: clientId,
			client_secret: clientSecret,
			resource: "https://api.evil.com",
		});

		expect(response.status).toBe(400);
		let body = (await response.json()) as { error: string; error_description: string };
		expect(body.error).toBe("invalid_target");
		expect(body.error_description).toContain("https://api.evil.com");
	});

	test("rejects an allow-listed resource that is not a registered resource", async () => {
		// On the allow-list, but never registered via Resource.create -> unknown target.
		let response = await postToken(db, {
			grant_type: "client_credentials",
			client_id: clientId,
			client_secret: clientSecret,
			resource: "https://api.allowed.com",
		});

		expect(response.status).toBe(400);
		let body = (await response.json()) as { error: string };
		expect(body.error).toBe("invalid_target");
	});

	test("issues a token for a resource that is both allow-listed and registered", async () => {
		await Resource.create(db, {
			identifier: "https://api.allowed.com",
			name: "Allowed API",
			scopes: [{ name: "read" }],
		});

		let response = await postToken(db, {
			grant_type: "client_credentials",
			client_id: clientId,
			client_secret: clientSecret,
			resource: "https://api.allowed.com",
		});

		expect(response.status).toBe(200);
		let body = (await response.json()) as { access_token: string; token_type: string };
		expect(body.token_type).toBe("Bearer");
		expect(body.access_token).toBeString();
	});

	test("issues a token when no resource is requested at all", async () => {
		let response = await postToken(db, {
			grant_type: "client_credentials",
			client_id: clientId,
			client_secret: clientSecret,
		});

		expect(response.status).toBe(200);
		let body = (await response.json()) as { access_token: string };
		expect(body.access_token).toBeString();
	});
});

describe("POST /oauth/token — refresh-token gating on offline_access", () => {
	let sqliteDb: SqliteDatabase;
	let db: Db;
	let clientId: string;
	let subjectId: string;
	let redirectUri = "https://app.example.com/callback";

	beforeEach(async () => {
		sqliteDb = new SqliteDatabase(":memory:");
		let { default: migration } = await import("../../migrations/0001-init.sql?raw");
		sqliteDb.run(migration);
		db = createDatabase(createBunSqliteDatabaseAdapter(sqliteDb));

		await TenantMeta.setIssuer(db, "auth.example.com");
		await SigningKey.generate(db);

		let subject = await createSubject(db, { verified: true });
		subjectId = subject.id;

		// A public client so a plain PKCE code_verifier suffices (no client secret).
		await Client.create(db, { name: "SPA", type: "public" });
		let client = (await Client.list(db)).find((c) => c.name === "SPA")!;
		clientId = client.id;
		await RedirectUri.create(db, client.id, redirectUri);
	});

	async function exchangeCode(scope: string[]): Promise<Response> {
		let sessionId = await Session.create(db, { subjectId, clientId });
		let code = await AuthorizationCode.create(db, {
			clientId,
			subjectId,
			sessionId,
			redirectUri,
			scope,
			pkce: { challenge: "verifier-as-plain-challenge", method: "plain" },
		});

		return postToken(db, {
			grant_type: "authorization_code",
			code,
			redirect_uri: redirectUri,
			client_id: clientId,
			code_verifier: "verifier-as-plain-challenge",
		});
	}

	test("issues a refresh token when offline_access is granted", async () => {
		let response = await exchangeCode(["openid", "offline_access"]);

		expect(response.status).toBe(200);
		let body = (await response.json()) as { refresh_token?: string; access_token: string };
		expect(body.access_token).toBeString();
		expect(body.refresh_token).toBeString();
	});

	test("does not issue a refresh token when offline_access is absent", async () => {
		let response = await exchangeCode(["openid", "profile"]);

		expect(response.status).toBe(200);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.access_token).toBeString();
		expect("refresh_token" in body).toBe(false);
	});
});
