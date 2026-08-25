/**
 * Tests the `/auth` controller: POST starts the OIDC flow and clears the
 * `returnTo` cookie; GET completes it, provisions the Polar customer, resolves
 * or creates the subject's team, converts any owed trial targets, writes the
 * session, seeds the `language` cookie, and redirects.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Renderer } from "remix/middleware/render";
import type { Middleware } from "remix/router";
import type { RemixNode } from "remix/ui";

import { createEnv } from "@pkg/cloudflare-mocks";
import logger from "@pkg/logger/middleware";
import { PolarClient } from "@pkg/polar";
import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { Session } from "remix/session";
import { renderToString } from "remix/ui/server";
import { afterEach, describe, expect, test, vi } from "vitest";

import Lead from "~/app/data/lead";
import TrialWatch from "~/app/data/trial-watch";
import UserPreferences from "~/app/data/user-preferences";
import { language as languageCookie } from "~/app/http/cookies";
import auth from "~/app/http/middleware/auth";
import i18n from "~/app/http/middleware/i18n";
import { createTestDatabase } from "~/app/lib/test/db";
import { IdTokenVerificationKeyService } from "~/app/services/id-token-verification-key";
import { monitors, teamDomains, teams } from "~/database/schema";
import routes from "~/routes/web";

/** Standing in for the `remix/auth` PKCE runtime, mocked so no real HTTP call is made. */
let finishExternalAuthImpl: () => Promise<unknown> = async () => ({
	result: { tokens: { idToken: "raw-id-token" } },
	returnTo: undefined,
});
let finishExternalAuthMock = vi.fn(() => finishExternalAuthImpl());
let startExternalAuthMock = vi.fn(
	async () =>
		new Response(null, {
			status: 302,
			headers: { Location: "https://auth.sergiodxa.com/authorize?state=abc" },
		}),
);

/**
 * The real provider's internals are never exercised — `finishExternalAuth`/
 * `startExternalAuth` are fully replaced below — so a bare stub is enough to
 * satisfy `createAuthProvider`'s call to it.
 */
vi.doMock("remix/auth", () => ({
	createOIDCAuthProvider: () => ({ name: "sergiodxa" }),
	finishExternalAuth: finishExternalAuthMock,
	startExternalAuth: startExternalAuthMock,
}));

/** Standing in for a verified ID token; every field the controller/`Team`/`Customer` touch. */
let fakeIdToken = {
	subject: "user-1",
	name: "Ada Lovelace",
	email: "ada@example.com",
	picture: "https://example.com/ada.png",
	username: "ada",
	emailVerified: true,
};
let verifyIdTokenMock = vi.fn(async () => fakeIdToken);

vi.doMock("~/app/auth/value-objects/id-token", () => ({
	verifyIdToken: verifyIdTokenMock,
}));

vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Env>({ CLIENT_ID: "client-id", CLIENT_SECRET: "client-secret" }),
	waitUntil: (promise: Promise<unknown>) => promise,
}));

let { default: authController } = await import("./auth");

/** A `PolarClient` stand-in whose `getExternalCustomer` short-circuits `Customer.findOrCreate`. */
function createFakePolar() {
	return {
		getExternalCustomer: vi.fn(async () => ({ id: "cus_1", externalId: "user-1" })),
		findCustomerByEmail: vi.fn(async () => null),
		createCustomer: vi.fn(async () => ({ id: "cus_1", externalId: null })),
		updateCustomer: vi.fn(async () => ({ id: "cus_1", externalId: "user-1" })),
	};
}

/** Renders through `renderToString` — these pages render no `<Frame>`, so no `resolveFrame` is needed. */
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
	container.instance(IdTokenVerificationKeyService, {
		value: Promise.resolve(null),
	} as unknown as IdTokenVerificationKeyService);

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

describe("POST /auth", () => {
	test("delegates to startExternalAuth and clears the returnTo cookie", async () => {
		let { db } = createTestDatabase();
		let { container, router } = createTestRouter(db, new Session());

		let request = new Request(`https://uptime.test${routes.auth.action.href()}`, {
			method: "POST",
		});

		let response = await container.scope(() => router.fetch(request));

		expect(response.status).toBe(302);
		expect(response.headers.get("Location")).toBe("https://auth.sergiodxa.com/authorize?state=abc");
		let setCookieHeaders = response.headers.getSetCookie();
		expect(setCookieHeaders.some((value) => value.startsWith("uptime:return-to="))).toBe(true);
		expect(setCookieHeaders.some((value) => /max-age=0/i.test(value))).toBe(true);
	});
});

describe("GET /auth", () => {
	test("signs in an existing team member and redirects to /app", async () => {
		let { db } = createTestDatabase();
		let team = await db.create(
			teams,
			{
				id: crypto.randomUUID(),
				owner_id: "user-1",
				name: "Ada's Team",
				slug: "ada-team",
				logo: null,
			},
			{ touch: true, returnRow: true },
		);
		let { memberships } = await import("~/database/schema");
		await db.create(
			memberships,
			{ id: crypto.randomUUID(), subject_id: "user-1", team_id: team.id, role: "admin" },
			{ touch: true, returnRow: true },
		);

		finishExternalAuthImpl = async () => ({
			result: { tokens: { idToken: "raw-id-token" } },
			returnTo: undefined,
		});

		let session = new Session();
		let { container, router } = createTestRouter(db, session);

		let request = new Request(`https://uptime.test${routes.auth.index.href()}`);
		let response = await container.scope(() => router.fetch(request));

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(routes.app.index.href());

		expect(session.get("id")).toBe("user-1");
		expect(session.get("name")).toBe("Ada Lovelace");
		expect(session.get("email")).toBe("ada@example.com");
		expect(session.get("avatar")).toBe("https://example.com/ada.png");
		expect(session.get("idToken")).toBe("raw-id-token");
	});

	test("creates a personal team when the subject has none and no domain matches", async () => {
		let { db } = createTestDatabase();
		expect(await db.findMany(teamDomains, { where: { hostname: "example.com" } })).toHaveLength(0);

		finishExternalAuthImpl = async () => ({
			result: { tokens: { idToken: "raw-id-token" } },
			returnTo: undefined,
		});

		let session = new Session();
		let { container, router } = createTestRouter(db, session);

		let request = new Request(`https://uptime.test${routes.auth.index.href()}`);
		let response = await container.scope(() => router.fetch(request));

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(routes.app.index.href());

		let created = await db.findOne(teams, { where: { owner_id: "user-1" } });
		expect(created).not.toBeNull();
		expect(created?.name).toBe("Ada Lovelace's Team");
	});

	test("redirects to the saved returnTo path instead of /app when one was preserved", async () => {
		let { db } = createTestDatabase();
		let team = await db.create(
			teams,
			{
				id: crypto.randomUUID(),
				owner_id: "user-1",
				name: "Ada's Team",
				slug: "ada-team-2",
				logo: null,
			},
			{ touch: true, returnRow: true },
		);
		let { memberships } = await import("~/database/schema");
		await db.create(
			memberships,
			{ id: crypto.randomUUID(), subject_id: "user-1", team_id: team.id, role: "admin" },
			{ touch: true, returnRow: true },
		);

		finishExternalAuthImpl = async () => ({
			result: { tokens: { idToken: "raw-id-token" } },
			returnTo: "/app/ada-team/settings",
		});

		let session = new Session();
		let { container, router } = createTestRouter(db, session);

		let request = new Request(`https://uptime.test${routes.auth.index.href()}`);
		let response = await container.scope(() => router.fetch(request));

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe("/app/ada-team/settings");
	});

	test("seeds the language cookie from the subject's stored preference", async () => {
		let { db } = createTestDatabase();
		await UserPreferences.setLanguage(db, "user-1", "es");

		finishExternalAuthImpl = async () => ({
			result: { tokens: { idToken: "raw-id-token" } },
			returnTo: undefined,
		});

		let { container, router } = createTestRouter(db, new Session());
		let request = new Request(`https://uptime.test${routes.auth.index.href()}`);
		let response = await container.scope(() => router.fetch(request));

		expect(response.status).toBe(303);
		expect(response.headers.getSetCookie()).toContain(await languageCookie.serialize("es"));
	});

	test("sets no language cookie when the subject has no stored preference", async () => {
		let { db } = createTestDatabase();

		finishExternalAuthImpl = async () => ({
			result: { tokens: { idToken: "raw-id-token" } },
			returnTo: undefined,
		});

		let { container, router } = createTestRouter(db, new Session());
		let request = new Request(`https://uptime.test${routes.auth.index.href()}`);
		let response = await container.scope(() => router.fetch(request));

		expect(response.status).toBe(303);
		expect(
			response.headers.getSetCookie().some((value) => value.startsWith("uptime:language=")),
		).toBe(false);
	});

	test("renders the sign-in-failed page when the provider callback fails", async () => {
		finishExternalAuthImpl = async () => {
			throw new Error("invalid state");
		};

		let { db } = createTestDatabase();
		let { container, router } = createTestRouter(db, new Session());

		let request = new Request(`https://uptime.test${routes.auth.index.href()}?error=access_denied`);
		let response = await container.scope(() => router.fetch(request));

		expect(response.status).toBe(400);
		let body = await response.text();
		expect(body).toContain("Sign-in failed");
		expect(body).toContain("The sign-in attempt could not be completed");
	});

	test("renders the sign-in-failed page when the provider returns no id token", async () => {
		finishExternalAuthImpl = async () => ({ result: { tokens: {} }, returnTo: undefined });

		let { db } = createTestDatabase();
		let { container, router } = createTestRouter(db, new Session());

		let request = new Request(`https://uptime.test${routes.auth.index.href()}`);
		let response = await container.scope(() => router.fetch(request));

		expect(response.status).toBe(400);
		let body = await response.text();
		expect(body).toContain("The identity provider did not return an ID token.");
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
			email: fakeIdToken.email,
			locale: "en",
			consented: false,
		});

		return await TrialWatch.create(db, lead.id, { url: "https://ada.example" });
	}

	test("converts the targets left under the signed-in address into the team it provisions", async () => {
		let { db } = createTestDatabase();
		let watch = await seedClaimableTarget(db);

		finishExternalAuthImpl = async () => ({
			result: { tokens: { idToken: "raw-id-token" } },
			returnTo: undefined,
		});

		let { container, router } = createTestRouter(db, new Session());
		let request = new Request(`https://uptime.test${routes.auth.index.href()}`);
		let response = await container.scope(() => router.fetch(request));

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

		finishExternalAuthImpl = async () => ({
			result: { tokens: { idToken: "raw-id-token" } },
			returnTo: undefined,
		});

		let { container, router } = createTestRouter(db, new Session());
		let request = new Request(`https://uptime.test${routes.auth.index.href()}`);
		await container.scope(() => router.fetch(request));

		let owned = await db.findOne(teams, { where: { slug: "ada-own-team" } });
		let created = await db.findMany(monitors, {});
		expect(created.map((monitor) => monitor.team_id)).toEqual([owned?.id ?? ""]);
	});

	test("signs the user in even when the conversion fails outright", async () => {
		let { db } = createTestDatabase();
		await seedClaimableTarget(db);
		vi.spyOn(Lead, "findByEmail").mockRejectedValue(new Error("d1 unavailable"));

		finishExternalAuthImpl = async () => ({
			result: { tokens: { idToken: "raw-id-token" } },
			returnTo: undefined,
		});

		let session = new Session();
		let { container, router } = createTestRouter(db, session);
		let request = new Request(`https://uptime.test${routes.auth.index.href()}`);
		let response = await container.scope(() => router.fetch(request));

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(routes.app.index.href());
		expect(session.get("id")).toBe("user-1");
		expect(await db.findMany(monitors, {})).toHaveLength(0);
	});
});
