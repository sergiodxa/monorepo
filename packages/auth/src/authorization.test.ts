/**
 * Specs for the two helper families, driven through a real router with the
 * middleware they depend on installed, so a thrown redirect is asserted as the
 * HTTP response the browser would get, cookie included.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { catchResponse } from "@sdxc/catch-response-middleware";
import { createCookie } from "remix/cookie";
import { asyncContext } from "remix/middleware/async-context";
import { getContext } from "remix/middleware/async-context";
import { session } from "remix/middleware/session";
import { createRouter } from "remix/router";
import { Session } from "remix/session";
import { createMemorySessionStorage } from "remix/session-storage/memory";
import { describe, expect, test } from "vitest";

import type { Authorization } from "./authorization.js";

import { AuthSession } from "./auth-session.js";
import { createAuthorization } from "./authorization.js";
import { Issuer } from "./issuer.js";
import { RelyingParty } from "./relying-party.js";

/** A route under test, which asks its questions of the request out of band. */
type Handler = () => Response | Promise<Response>;

/** The origin every fixture request is made against. */
const ORIGIN = "https://app.example.com";

/** Seconds in an hour, the lifetime the fixture tokens hand out. */
const ONE_HOUR = 3600;

/** Encodes bytes as unpadded base64url, the encoding a compact JWS segment uses. */
function base64url(bytes: Uint8Array): string {
	let binary = "";
	for (let byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Builds a compact JWS carrying the given claims. The helpers read a stored token
 * that was verified when it was written, so the signature segment is a placeholder.
 */
function token(claims: Record<string, unknown>): string {
	let header = base64url(new TextEncoder().encode(JSON.stringify({ alg: "ES256", typ: "JWT" })));
	let payload = base64url(new TextEncoder().encode(JSON.stringify(claims)));
	return `${header}.${payload}.signature`;
}

/** Seconds since the epoch, offset by the given number of seconds. */
function epoch(offset = 0): number {
	return Math.floor(Date.now() / 1000) + offset;
}

/** Claims a login of one factor, a minute ago, leaves on the ID token. */
function idClaims(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return { sub: "user-1", auth_time: epoch(-60), amr: ["pwd"], ...overrides };
}

/** A stored token set with a live access token, standing in for a completed login. */
function tokens(
	id: Record<string, unknown> = {},
	access: Record<string, unknown> = {},
): AuthSession.Tokens {
	return {
		idToken: token(idClaims(id)),
		accessToken: token({ sub: "user-1", scope: "openid monitors:read", ...access }),
		refreshToken: "refresh-1",
		expiresAt: epoch(ONE_HOUR),
	};
}

/** The relying party the fixture helpers read their MFA policy from. */
function createRelyingParty(): RelyingParty {
	return new RelyingParty(new Issuer(`${ORIGIN}/oidc`), {
		clientId: "client-1",
		clientSecret: "secret-1",
		redirectUri: `${ORIGIN}/auth/callback`,
		mfa: ["mfa", "urn:passkey"],
	});
}

/** The helpers as an app binds them, with each option open to a test that needs it. */
function createHelpers(overrides: Partial<Authorization.Options> = {}): Authorization.Helpers {
	return createAuthorization({
		login: "/login",
		signedIn: "/dashboard",
		relyingParty: createRelyingParty,
		...overrides,
	});
}

/**
 * Runs a handler behind the chain the helpers depend on: `session()` above
 * `catchResponse()` so a thrown redirect still carries the session cookie, `asyncContext()`
 * so an argument-free helper finds the request, and a wildcard route so a hostile path lands.
 *
 * @param handler - The route under test, called with no arguments of its own.
 * @param stored - The token set to sign the request in with, or `null` for a
 *   request nobody signed in on.
 */
function createApp(handler: Handler, stored: AuthSession.Tokens | null = null) {
	let cookie = createCookie("auth-test", { secrets: ["test-secret"] });
	let storage = createMemorySessionStorage();

	/** Stands in for a completed login, so the helpers read what a signed-in request carries. */
	let signIn: Middleware = (ctx, next) => {
		if (stored) AuthSession.write(ctx, stored);
		return next();
	};

	let router = createRouter({
		middleware: [session(cookie, storage), catchResponse(), asyncContext(), signIn],
	});
	router.get("*rest", handler);

	return router;
}

/** Fetches a path through the fixture app, following no redirect. */
function fetchPath(
	router: { fetch(request: Request): Promise<Response> },
	path: string,
): Promise<Response> {
	return router.fetch(new Request(`${ORIGIN}${path}`, { redirect: "manual" }));
}

/** The `returnTo` a login redirect carries, read back off the `Location` header. */
function returnToOf(response: Response, param = "returnTo"): string | null {
	let location = new URL(response.headers.get("Location") ?? "", ORIGIN);
	return location.searchParams.get(param);
}

/** The current request's session, read the way a handler with no arguments reads it. */
function getSession(): Session {
	let value = getContext().get(Session);
	if (!value) throw new Error("the fixture app installs the session middleware");
	return value;
}

describe("currentSession", () => {
	test("answers the token set a login stored", async () => {
		let { currentSession } = createHelpers();
		let router = createApp(
			() => Response.json({ sub: currentSession().idToken.subject }),
			tokens(),
		);

		let response = await fetchPath(router, "/settings");

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ sub: "user-1" });
	});

	test("redirects a signed-out request to the login route", async () => {
		let { currentSession } = createHelpers();
		let router = createApp(() => Response.json({ sub: currentSession().idToken.subject }));

		let response = await fetchPath(router, "/settings");

		expect(response.status).toBe(302);
		expect(new URL(response.headers.get("Location") ?? "", ORIGIN).pathname).toBe("/login");
	});

	test("carries the path and query the request came from as returnTo", async () => {
		let { currentSession } = createHelpers();
		let router = createApp(() => Response.json({ session: currentSession().tokens }));

		let response = await fetchPath(router, "/settings?tab=billing");

		expect(returnToOf(response)).toBe("/settings?tab=billing");
	});

	test("carries returnTo under the parameter name the login route reads", async () => {
		let { currentSession } = createHelpers({ returnToParam: "next" });
		let router = createApp(() => Response.json({ session: currentSession().tokens }));

		let response = await fetchPath(router, "/settings");

		expect(returnToOf(response, "next")).toBe("/settings");
	});

	test("returns to the signed-in destination when the request path resolves off-site", async () => {
		let { currentSession } = createHelpers();
		let router = createApp(() => Response.json({ session: currentSession().tokens }));

		let response = await fetchPath(router, "//evil.com");

		expect(returnToOf(response)).toBe("/dashboard");
	});

	test("returns to the signed-in destination for a path that normalizes protocol-relative", async () => {
		let { currentSession } = createHelpers();
		let router = createApp(() => Response.json({ session: currentSession().tokens }));

		let response = await fetchPath(router, "/settings/..//evil.com");

		expect(returnToOf(response)).toBe("/dashboard");
	});

	test("keeps the session cookie on the redirect it throws", async () => {
		let { currentSession } = createHelpers();
		let router = createApp(() => {
			let requestSession = getSession();
			requestSession.set("flash", "sign in first");
			return Response.json({ session: currentSession().tokens });
		});

		let response = await fetchPath(router, "/settings");

		expect(response.status).toBe(302);
		expect(response.headers.getSetCookie().some((value) => value.startsWith("auth-test="))).toBe(
			true,
		);
	});

	test("reports a router that installs no async context", async () => {
		let { currentSession } = createHelpers();
		let router = createRouter();
		router.get("*rest", () => Response.json({ session: currentSession().tokens }));

		await expect(fetchPath(router, "/settings")).rejects.toThrow(/asyncContext/);
	});
});

describe("anonymous", () => {
	test("lets a request nobody signed in on through", async () => {
		let { anonymous } = createHelpers();
		let router = createApp(() => {
			anonymous();
			return new Response("the login form");
		});

		let response = await fetchPath(router, "/login");

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("the login form");
	});

	test("redirects a request that is already signed in to the signed-in destination", async () => {
		let { anonymous } = createHelpers();
		let router = createApp(() => {
			anonymous();
			return new Response("the login form");
		}, tokens());

		let response = await fetchPath(router, "/login");

		expect(response.status).toBe(302);
		expect(response.headers.get("Location")).toBe("/dashboard");
	});
});

describe("capability helpers", () => {
	test("answer for an anonymous request without throwing, so a view may call them", async () => {
		let { subject, scope, authenticated, mfa } = createHelpers();
		let router = createApp(() => {
			expect(subject).not.toThrow();
			expect(() => scope("monitors:read")).not.toThrow();
			expect(authenticated).not.toThrow();
			expect(() => authenticated("5m")).not.toThrow();
			expect(mfa).not.toThrow();

			return Response.json({
				subject: subject(),
				scope: scope("monitors:read"),
				authenticated: authenticated(),
				recently: authenticated("5m"),
				mfa: mfa(),
			});
		});

		let response = await fetchPath(router, "/settings");

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			subject: null,
			scope: false,
			authenticated: false,
			recently: false,
			mfa: false,
		});
	});

	test("answer for a stored ID token whose claims no longer read", async () => {
		let { subject, authenticated, mfa } = createHelpers();
		let router = createApp(
			() => Response.json({ subject: subject(), authenticated: authenticated(), mfa: mfa() }),
			{ ...tokens(), idToken: "not-a-token" },
		);

		let response = await fetchPath(router, "/settings");

		expect(await response.json()).toEqual({ subject: null, authenticated: false, mfa: false });
	});

	/**
	 * The answer is the whole guard: reading a capability leaves the request alone, so a
	 * route that reads one it lacks and carries on deletes the record anyway. The caller's
	 * own branch is what turns a `false` answer into a refusal.
	 */
	test("answer a capability the request lacks, and only a branch on it refuses", async () => {
		let { scope } = createHelpers();
		let carryingOn = createApp(() => {
			let granted = scope("monitors:write");
			return Response.json({ granted, deleted: true });
		});
		let refusing = createApp(() => {
			if (!scope("monitors:write")) return new Response("forbidden", { status: 403 });
			return new Response("deleted");
		});

		let carriedOn = await fetchPath(carryingOn, "/monitors/1");
		let refused = await fetchPath(refusing, "/monitors/1");

		expect(carriedOn.status).toBe(200);
		expect(await carriedOn.json()).toEqual({ granted: false, deleted: true });
		expect(refused.status).toBe(403);
		expect(await refused.text()).toBe("forbidden");
	});
});

describe("subject", () => {
	test("answers the identity anchor a login stored", async () => {
		let { subject } = createHelpers();
		let router = createApp(() => Response.json({ subject: subject() }), tokens());

		expect(await (await fetchPath(router, "/settings")).json()).toEqual({ subject: "user-1" });
	});

	test("answers null for an ID token carrying no subject claim", async () => {
		let { subject } = createHelpers();
		let stored = tokens();
		let router = createApp(() => Response.json({ subject: subject() }), {
			...stored,
			idToken: token({ auth_time: epoch(-60) }),
		});

		expect(await (await fetchPath(router, "/settings")).json()).toEqual({ subject: null });
	});
});

describe("scope", () => {
	test("answers true for a scope the access token was granted", async () => {
		let { scope } = createHelpers();
		let router = createApp(() => Response.json({ granted: scope("monitors:read") }), tokens());

		expect(await (await fetchPath(router, "/settings")).json()).toEqual({ granted: true });
	});

	test("answers false for a scope the access token carries no grant of", async () => {
		let { scope } = createHelpers();
		let router = createApp(() => Response.json({ granted: scope("monitors:write") }), tokens());

		expect(await (await fetchPath(router, "/settings")).json()).toEqual({ granted: false });
	});
});

describe("authenticated", () => {
	test("answers true with no window for any request that signed in", async () => {
		let { authenticated } = createHelpers();
		let router = createApp(() => Response.json({ signedIn: authenticated() }), tokens());

		expect(await (await fetchPath(router, "/settings")).json()).toEqual({ signedIn: true });
	});

	test("answers true for an authentication inside the window", async () => {
		let { authenticated } = createHelpers();
		let router = createApp(
			() => Response.json({ recently: authenticated("5m") }),
			tokens({ auth_time: epoch(-60) }),
		);

		expect(await (await fetchPath(router, "/settings")).json()).toEqual({ recently: true });
	});

	test("answers false for an authentication older than the window", async () => {
		let { authenticated } = createHelpers();
		let router = createApp(
			() => Response.json({ recently: authenticated("5m") }),
			tokens({ auth_time: epoch(-2 * ONE_HOUR) }),
		);

		expect(await (await fetchPath(router, "/settings")).json()).toEqual({ recently: false });
	});

	test("reads auth_time, so a session refreshed a moment ago with an old authentication answers false", async () => {
		let { authenticated } = createHelpers();
		let stored: AuthSession.Tokens = {
			...tokens({ auth_time: epoch(-2 * ONE_HOUR) }),
			expiresAt: epoch(ONE_HOUR),
		};
		let router = createApp(
			() =>
				Response.json({
					signedIn: authenticated(),
					recently: authenticated("5m"),
					expired: AuthSession.from(getContext())?.expired ?? null,
				}),
			stored,
		);

		expect(await (await fetchPath(router, "/settings")).json()).toEqual({
			signedIn: true,
			recently: false,
			expired: false,
		});
	});

	test("answers false with a window for a provider that reported no auth_time", async () => {
		let { authenticated } = createHelpers();
		let router = createApp(
			() => Response.json({ signedIn: authenticated(), recently: authenticated("5m") }),
			tokens({ auth_time: undefined }),
		);

		expect(await (await fetchPath(router, "/settings")).json()).toEqual({
			signedIn: true,
			recently: false,
		});
	});
});

describe("mfa", () => {
	test("answers true for an amr value the relying party counts as several factors", async () => {
		let { mfa } = createHelpers();
		let router = createApp(() => Response.json({ mfa: mfa() }), tokens({ amr: ["pwd", "mfa"] }));

		expect(await (await fetchPath(router, "/settings")).json()).toEqual({ mfa: true });
	});

	test("answers true for an acr value the relying party counts as several factors", async () => {
		let { mfa } = createHelpers();
		let router = createApp(
			() => Response.json({ mfa: mfa() }),
			tokens({ amr: undefined, acr: "urn:passkey" }),
		);

		expect(await (await fetchPath(router, "/settings")).json()).toEqual({ mfa: true });
	});

	test("answers false for a login of one factor", async () => {
		let { mfa } = createHelpers();
		let router = createApp(() => Response.json({ mfa: mfa() }), tokens({ amr: ["pwd"] }));

		expect(await (await fetchPath(router, "/settings")).json()).toEqual({ mfa: false });
	});
});
