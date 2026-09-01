/**
 * Tests the `/auth` controller against a stubbed identity provider: POST starts the OIDC
 * flow and leaves a login transaction behind; GET completes that transaction, provisions
 * customer, team and owed trial targets, stores the token set, and redirects.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Renderer } from "remix/middleware/render";
import type { Middleware } from "remix/router";
import type { RemixNode } from "remix/ui";

import { createEnv, createKVNamespace } from "@pkg/cloudflare-mocks";
import { JWK, JWT } from "@pkg/jwt";
import logger from "@pkg/logger/middleware";
import { PolarClient } from "@pkg/polar";
import { ServiceContainer } from "@pkg/service-container";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { Session } from "remix/session";
import { renderToString } from "remix/ui/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import Lead from "~/app/data/lead";
import TrialWatch from "~/app/data/trial-watch";
import UserPreferences from "~/app/data/user-preferences";
import { language as languageCookie, returnTo } from "~/app/http/cookies";
import { createTestDatabase } from "~/app/lib/test/db";
import { monitors, teamDomains, teams } from "~/database/schema";
import routes from "~/routes/web";

/** Origin the identity provider this app's accounts live at serves its documents on. */
const AUTH_ORIGIN = "https://auth.sergiodxa.com";

/**
 * The `iss` the provider publishes and writes into every token it signs, carried
 * without a scheme exactly as production does, so a login that only works against a
 * URL identifier fails here.
 */
const AUTH_IDENTIFIER = "auth.sergiodxa.com";

/** The client this app is registered as, matching the mocked `CLIENT_ID` binding. */
const CLIENT_ID = "client-id";

/** Seconds in an hour, the lifetime every fixture token carries. */
const ONE_HOUR = 3600;

/** The session key `@pkg/auth` holds the login transaction under. */
const TRANSACTION_SESSION_KEY = "auth:transaction";

/** The session key `@pkg/auth` holds the signed-in token set under. */
const TOKENS_SESSION_KEY = "auth";

/**
 * The claims the provider's ID token carries beyond the fixture profile, set per test
 * so a callback can be given the `nonce` its own transaction asked for.
 */
let idTokenClaims: Record<string, unknown> = {};

/** What the token endpoint answers with, replaced by a test exercising a refusal. */
let tokenResponse: () => Promise<Response> = grantedTokens;

let keys: JWK.KeyPair[];

/**
 * The provider's endpoints, answering with the document production publishes down to
 * its scheme-less `issuer`. Discovery and the key set answer for the whole file, so a
 * per-test handler reset leaves every login working.
 */
let server = setupServer(
	http.get(`${AUTH_ORIGIN}/.well-known/openid-configuration`, () =>
		HttpResponse.json({
			issuer: AUTH_IDENTIFIER,
			authorization_endpoint: `${AUTH_ORIGIN}/authorize`,
			token_endpoint: `${AUTH_ORIGIN}/oauth/token`,
			jwks_uri: `${AUTH_ORIGIN}/.well-known/jwks.json`,
			userinfo_endpoint: `${AUTH_ORIGIN}/userinfo`,
			end_session_endpoint: `${AUTH_ORIGIN}/oidc/logout`,
			revocation_endpoint: `${AUTH_ORIGIN}/oauth/revoke`,
			introspection_endpoint: `${AUTH_ORIGIN}/oauth/introspect`,
			scopes_supported: ["openid", "email", "profile"],
			response_types_supported: ["code"],
			token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
			code_challenge_methods_supported: ["S256", "plain"],
		}),
	),
	http.get(`${AUTH_ORIGIN}/.well-known/jwks.json`, () => HttpResponse.json(JWK.toJSON(keys))),
	http.post(`${AUTH_ORIGIN}/oauth/token`, () => tokenResponse()),
);

vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Env>({
		CLIENT_ID,
		CLIENT_SECRET: "client-secret",
		KV: createKVNamespace(),
	}),
	waitUntil: (promise: Promise<unknown>) => promise,
}));

/**
 * Imported after the binding mock, since the middleware chain reaches the shared
 * issuer, which reads the KV binding the moment it is built.
 */
let { default: auth } = await import("~/app/http/middleware/auth");
let { default: i18n } = await import("~/app/http/middleware/i18n");
let { default: authController } = await import("./auth");

/** Signs a token for the fixture issuer with the key set discovery publishes. */
function signToken(claims: Record<string, unknown>): Promise<string> {
	return new JWT({
		iss: AUTH_IDENTIFIER,
		aud: CLIENT_ID,
		exp: "1h",
		iat: Math.floor(Date.now() / 1000),
		...claims,
	}).sign(JWK.Algorithm.ES256, keys);
}

/**
 * The grant the provider answers a login's code with. It grants the three scopes it
 * publishes and no `offline_access`, so it hands out no refresh token, and the access
 * token it signs is good for the hour discovery advertises.
 */
async function grantedTokens(): Promise<Response> {
	return HttpResponse.json({
		access_token: await signToken({
			sub: "user-1",
			client_id: CLIENT_ID,
			scope: "openid profile email",
		}),
		id_token: await signIdToken(),
		token_type: "Bearer",
		expires_in: ONE_HOUR,
	});
}

/**
 * The grant a provider that honors `offline_access` answers with, which pins the
 * refresh-token path against the day this one starts granting the scope it is asked for.
 */
async function grantedTokensWithRefresh(): Promise<Response> {
	return HttpResponse.json({
		access_token: await signToken({
			sub: "user-1",
			client_id: CLIENT_ID,
			scope: "openid profile email offline_access",
		}),
		id_token: await signIdToken(),
		refresh_token: "refresh-1",
		token_type: "Bearer",
		expires_in: ONE_HOUR,
	});
}

/** The ID token the provider issues for the person every test signs in as. */
function signIdToken(): Promise<string> {
	return signToken({
		sub: "user-1",
		name: "Ada Lovelace",
		email: "ada@example.com",
		email_verified: true,
		picture: "https://example.com/ada.png",
		preferred_username: "ada",
		...idTokenClaims,
	});
}

beforeAll(async () => {
	keys = [await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256))];
	server.listen({ onUnhandledRequest: "error" });
});

beforeEach(() => {
	idTokenClaims = {};
	tokenResponse = grantedTokens;
});

afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** A `PolarClient` stand-in whose `getExternalCustomer` short-circuits `Customer.findOrCreate`. */
function createFakePolar() {
	return {
		getExternalCustomer: vi.fn(async () => ({ id: "cus_1", externalId: "user-1" })),
		findCustomerByEmail: vi.fn(async () => null),
		createCustomer: vi.fn(async () => ({ id: "cus_1", externalId: null })),
		updateCustomer: vi.fn(async () => ({ id: "cus_1", externalId: "user-1" })),
	};
}

/** Renders straight through `renderToString`, the whole document these pages produce. */
function createTestRenderer(): Renderer<RemixNode> {
	return async (node, init) => {
		let html = await renderToString(node);
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(html, { ...init, headers });
	};
}

/** Installs a given `Session` instance directly, standing in for the real session middleware. */
function seedSession(session: Session): Middleware {
	return (ctx, next) => {
		ctx.set(Session, session, { property: "session" });
		return next();
	};
}

/** Builds a minimal router mapping the whole `/auth` controller with a fresh service container. */
function createTestRouter(db: ReturnType<typeof createTestDatabase>["db"], session: Session) {
	let container = new ServiceContainer();
	container.instance(Database, db);
	container.instance(PolarClient, createFakePolar() as unknown as PolarClient);

	let router = createRouter({
		middleware: [
			asyncContext(),
			logger as Middleware,
			seedSession(session),
			auth as Middleware,
			i18n as Middleware,
			renderWith(createTestRenderer) as Middleware,
		],
	});
	router.map(routes.auth, authController);

	return { container, router };
}

/** One browser: a session that carries across both legs of a login. */
interface Agent {
	session: Session;
	/** Runs POST /auth, optionally presenting a `returnTo` cookie. */
	start(returnToCookie?: string): Promise<Response>;
	/** The login transaction the authorization redirect left on the server. */
	transaction(): { state: string; nonce: string; returnTo: string };
	/** Runs GET /auth carrying a code correlated with the stored transaction. */
	finish(): Promise<Response>;
	/** Runs any request through this agent's router and session. */
	visit(request: Request): Promise<Response>;
	/** The token set a completed login stored. */
	tokens(): { idToken: string; accessToken: string; refreshToken: string | null } | undefined;
}

/**
 * Drives both legs of a login through one router and one session, so the callback
 * answers the transaction the authorization request actually wrote.
 */
function createAgent(db: ReturnType<typeof createTestDatabase>["db"]): Agent {
	let session = new Session();
	let { container, router } = createTestRouter(db, session);

	return {
		session,

		async start(returnToCookie) {
			let headers = new Headers();
			if (returnToCookie !== undefined) {
				headers.set("Cookie", await returnTo.serialize(returnToCookie));
			}

			let request = new Request(`https://uptime.test${routes.auth.action.href()}`, {
				method: "POST",
				headers,
			});
			return await container.scope(() => router.fetch(request));
		},

		transaction() {
			return session.get(TRANSACTION_SESSION_KEY) as {
				state: string;
				nonce: string;
				returnTo: string;
			};
		},

		async finish() {
			let { state, nonce } = this.transaction();
			idTokenClaims = { ...idTokenClaims, nonce };

			return await this.visit(new Request(callbackUrl(state)));
		},

		async visit(request) {
			return await container.scope(() => router.fetch(request));
		},

		tokens() {
			return session.get(TOKENS_SESSION_KEY) as
				| { idToken: string; accessToken: string; refreshToken: string | null }
				| undefined;
		},
	};
}

/** The callback URL the provider sends a browser back to, correlated by `state`. */
function callbackUrl(state: string): URL {
	let url = new URL(routes.auth.index.href(), "https://uptime.test");
	url.searchParams.set("code", "code-1");
	url.searchParams.set("state", state);
	return url;
}

/** Signs a person in end to end and answers with the callback's response. */
async function signInThrough(agent: Agent, returnToCookie?: string): Promise<Response> {
	await agent.start(returnToCookie);
	return await agent.finish();
}

/** Seeds the team `user-1` already belongs to, so the callback lands in an existing team. */
async function seedExistingTeam(
	db: ReturnType<typeof createTestDatabase>["db"],
	slug = "ada-team",
) {
	let { memberships } = await import("~/database/schema");
	let team = await db.create(
		teams,
		{ id: crypto.randomUUID(), owner_id: "user-1", name: "Ada's Team", slug, logo: null },
		{ touch: true, returnRow: true },
	);
	await db.create(
		memberships,
		{ id: crypto.randomUUID(), subject_id: "user-1", team_id: team.id, role: "admin" },
		{ touch: true, returnRow: true },
	);

	return team;
}

describe("POST /auth", () => {
	test("redirects to the provider's authorization endpoint and clears the returnTo cookie", async () => {
		let { db } = createTestDatabase();
		let agent = createAgent(db);

		let response = await agent.start();

		expect(response.status).toBe(303);
		let location = new URL(response.headers.get("Location")!);
		expect(location.origin + location.pathname).toBe(`${AUTH_ORIGIN}/authorize`);
		expect(location.searchParams.get("client_id")).toBe(CLIENT_ID);
		expect(location.searchParams.get("redirect_uri")).toBe(
			`https://uptime.test${routes.auth.index.href()}`,
		);
		expect(location.searchParams.get("code_challenge_method")).toBe("S256");
		expect(location.searchParams.get("state")).toBe(agent.transaction().state);
		/**
		 * The login asks for `offline_access`, so a provider that grants it issues the
		 * refresh token that renews an access token on the server.
		 */
		expect(location.searchParams.get("scope")?.split(" ")).toContain("offline_access");

		let setCookieHeaders = response.headers.getSetCookie();
		expect(setCookieHeaders.some((value) => value.startsWith("uptime:return-to="))).toBe(true);
		expect(setCookieHeaders.some((value) => /max-age=0/i.test(value))).toBe(true);
	});

	test("carries the returnTo cookie's path into the login transaction", async () => {
		let { db } = createTestDatabase();
		let agent = createAgent(db);

		await agent.start("/app/ada-team/monitors?tab=dns#latest");

		expect(agent.transaction().returnTo).toBe("/app/ada-team/monitors?tab=dns#latest");
	});

	test("falls back to /app when the returnTo cookie names nothing", async () => {
		let { db } = createTestDatabase();
		let agent = createAgent(db);

		await agent.start();

		expect(agent.transaction().returnTo).toBe(routes.app.index.href());
	});

	/**
	 * Each payload survives a leading-slash test yet resolves to an attacker origin
	 * once a browser follows it, so none of them may reach the transaction.
	 */
	test.each([["//evil.com"], ["/\\/evil.com"], ["/\\evil.com"], ["/..//evil.com"]])(
		"stores /app instead of the returnTo cookie %j",
		async (target) => {
			let { db } = createTestDatabase();
			let agent = createAgent(db);

			await agent.start(target);

			expect(agent.transaction().returnTo).toBe(routes.app.index.href());
		},
	);
});

describe("GET /auth", () => {
	test("signs in an existing team member and redirects to /app", async () => {
		let { db } = createTestDatabase();
		await seedExistingTeam(db);
		let agent = createAgent(db);

		let response = await signInThrough(agent);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(routes.app.index.href());

		let tokens = agent.tokens();
		expect(tokens).toBeDefined();
		expect(JWT.decode(tokens!.idToken).subject).toBe("user-1");
	});

	/**
	 * The provider publishes `openid`, `email` and `profile` and grants nothing else, so
	 * `offline_access` is filtered out of the request and no refresh token comes back. The
	 * session that results is renewed by nothing, and lasts as long as its own cookie.
	 */
	test("stores no refresh token, since the provider grants no offline_access", async () => {
		let { db } = createTestDatabase();
		await seedExistingTeam(db);
		let agent = createAgent(db);

		await signInThrough(agent);

		expect(agent.tokens()?.refreshToken).toBeNull();
	});

	/** A provider that does grant `offline_access` has its refresh token stored to spend. */
	test("stores the refresh token a grant carrying one leaves", async () => {
		let { db } = createTestDatabase();
		await seedExistingTeam(db);
		let agent = createAgent(db);
		tokenResponse = grantedTokensWithRefresh;

		await signInThrough(agent);

		expect(agent.tokens()?.refreshToken).toBe("refresh-1");
	});

	/** The transaction answers one callback, so a replayed callback URL signs nobody in. */
	test("refuses a callback whose transaction was already spent", async () => {
		let { db } = createTestDatabase();
		await seedExistingTeam(db);
		let agent = createAgent(db);

		await agent.start();
		let { state } = agent.transaction();

		expect((await agent.finish()).status).toBe(303);

		let replayed = await agent.visit(new Request(callbackUrl(state)));

		expect(replayed.status).toBe(400);
		expect(await replayed.text()).toContain("Sign-in failed");
	});

	test("creates a personal team when the subject has none and no domain matches", async () => {
		let { db } = createTestDatabase();
		expect(await db.findMany(teamDomains, { where: { hostname: "example.com" } })).toHaveLength(0);

		let response = await signInThrough(createAgent(db));

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(routes.app.index.href());

		let created = await db.findOne(teams, { where: { owner_id: "user-1" } });
		expect(created).not.toBeNull();
		expect(created?.name).toBe("Ada Lovelace's Team");
	});

	test("redirects to the saved returnTo path instead of /app when one was preserved", async () => {
		let { db } = createTestDatabase();
		await seedExistingTeam(db, "ada-team-2");

		let response = await signInThrough(createAgent(db), "/app/ada-team/settings");

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe("/app/ada-team/settings");
	});

	test("preserves the query string and hash of a saved returnTo path", async () => {
		let { db } = createTestDatabase();

		let response = await signInThrough(createAgent(db), "/app/ada-team/monitors?tab=dns#latest");

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe("/app/ada-team/monitors?tab=dns#latest");
	});

	test("seeds the language cookie from the subject's stored preference", async () => {
		let { db } = createTestDatabase();
		await UserPreferences.setLanguage(db, "user-1", "es");

		let response = await signInThrough(createAgent(db));

		expect(response.status).toBe(303);
		expect(response.headers.getSetCookie()).toContain(await languageCookie.serialize("es"));
	});

	test("sets no language cookie when the subject has no stored preference", async () => {
		let { db } = createTestDatabase();

		let response = await signInThrough(createAgent(db));

		expect(response.status).toBe(303);
		expect(
			response.headers.getSetCookie().some((value) => value.startsWith("uptime:language=")),
		).toBe(false);
	});

	test("renders the sign-in-failed page when the provider refuses the authorization request", async () => {
		let { db } = createTestDatabase();
		let { container, router } = createTestRouter(db, new Session());

		let request = new Request(`https://uptime.test${routes.auth.index.href()}?error=access_denied`);
		let response = await container.scope(() => router.fetch(request));

		expect(response.status).toBe(400);
		let body = await response.text();
		expect(body).toContain("Sign-in failed");
		expect(body).toContain("The sign-in attempt could not be completed");
	});

	test("renders the sign-in-failed page when the token response carries no id token", async () => {
		let { db } = createTestDatabase();
		let agent = createAgent(db);

		tokenResponse = async () =>
			HttpResponse.json({
				access_token: await signToken({ sub: "user-1", client_id: CLIENT_ID }),
				token_type: "Bearer",
				expires_in: ONE_HOUR,
			});

		let response = await signInThrough(agent);

		expect(response.status).toBe(400);
		expect(await response.text()).toContain("The identity provider did not return an ID token.");
	});

	/** A token signed by a key the provider does not publish never becomes a session. */
	test("renders the sign-in-failed page when the id token fails verification", async () => {
		let { db } = createTestDatabase();
		let agent = createAgent(db);
		let strangerKeys = [await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256))];

		tokenResponse = async () =>
			HttpResponse.json({
				access_token: await signToken({ sub: "user-1", client_id: CLIENT_ID }),
				id_token: await new JWT({
					iss: AUTH_IDENTIFIER,
					aud: CLIENT_ID,
					sub: "user-1",
					exp: "1h",
					...idTokenClaims,
				}).sign(JWK.Algorithm.ES256, strangerKeys),
				token_type: "Bearer",
				expires_in: ONE_HOUR,
			});

		let response = await signInThrough(agent);

		expect(response.status).toBe(400);
		expect(await response.text()).toContain("Sign-in failed");
		expect(agent.tokens()).toBeUndefined();
	});
});

/**
 * Pins the trial-conversion claim's placement relative to team creation — the
 * conversion rule lives in `~/app/services/trial-conversion.test.ts`. The claim
 * lands in the team this request provisions, and sign-in still succeeds when it fails.
 */
describe("GET /auth trial conversion", () => {
	afterEach(() => {
		vi.spyOn(Lead, "findByEmail").mockRestore();
	});

	/** A lead for the signing-in address with one claimable target. */
	async function seedClaimableTarget(db: ReturnType<typeof createTestDatabase>["db"]) {
		let lead = await Lead.upsertByEmail(db, {
			email: "ada@example.com",
			locale: "en",
			consented: false,
		});

		return await TrialWatch.create(db, lead.id, { url: "https://ada.example" });
	}

	test("converts the targets left under the signed-in address into the team it provisions", async () => {
		let { db } = createTestDatabase();
		let watch = await seedClaimableTarget(db);

		let response = await signInThrough(createAgent(db));

		expect(response.status).toBe(303);

		let team = await db.findOne(teams, { where: { owner_id: "user-1" } });
		let created = await db.findMany(monitors, { where: { team_id: team?.id ?? "" } });
		expect(created.map((monitor) => monitor.url)).toEqual(["https://ada.example"]);
		expect((await TrialWatch.findById(db, watch.id))?.converted_at).not.toBeNull();
	});

	test("puts them in the team the subject owns rather than one they joined by domain", async () => {
		let { db } = createTestDatabase();
		await seedClaimableTarget(db);

		let { memberships } = await import("~/database/schema");
		for (let [slug, ownerId] of [
			["acme-team", "someone-else"],
			["ada-own-team", "user-1"],
		] as const) {
			let team = await db.create(
				teams,
				{ id: crypto.randomUUID(), owner_id: ownerId, name: slug, slug, logo: null },
				{ touch: true, returnRow: true },
			);
			await db.create(
				memberships,
				{ id: crypto.randomUUID(), subject_id: "user-1", team_id: team.id, role: "member" },
				{ touch: true, returnRow: true },
			);
		}

		await signInThrough(createAgent(db));

		let owned = await db.findOne(teams, { where: { slug: "ada-own-team" } });
		let created = await db.findMany(monitors, {});
		expect(created.map((monitor) => monitor.team_id)).toEqual([owned?.id ?? ""]);
	});

	test("signs the user in even when the conversion fails outright", async () => {
		let { db } = createTestDatabase();
		await seedClaimableTarget(db);
		vi.spyOn(Lead, "findByEmail").mockRejectedValue(new Error("d1 unavailable"));

		let agent = createAgent(db);
		let response = await signInThrough(agent);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(routes.app.index.href());
		expect(JWT.decode(agent.tokens()!.idToken).subject).toBe("user-1");
		expect(await db.findMany(monitors, {})).toHaveLength(0);
	});
});
