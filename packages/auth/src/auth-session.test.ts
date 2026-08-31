/**
 * Specs for the one session key this package writes: what a signed-out request
 * reads, what a stored token set reads back as, when an access token counts as
 * spent, and what a refresh leaves in the session.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createSession, Session } from "remix/session";
import { describe, expect, test } from "vitest";

import { AuthError, AuthErrorCode } from "./auth-error";
import { AuthSession } from "./auth-session";

/** Seconds in an hour, the lifetime the fixtures hand out. */
const ONE_HOUR = 3600;

/** Encodes bytes as unpadded base64url, the encoding a compact JWS segment uses. */
function base64url(bytes: Uint8Array): string {
	let binary = "";
	for (let byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Builds a compact JWS carrying the given claims. `AuthSession` reads a stored
 * token rather than verifying it, so the signature segment stays a placeholder.
 */
function token(claims: Record<string, unknown>): string {
	let header = base64url(new TextEncoder().encode(JSON.stringify({ alg: "ES256", typ: "JWT" })));
	let payload = base64url(new TextEncoder().encode(JSON.stringify(claims)));
	return `${header}.${payload}.signature`;
}

/** A request context carrying a session, standing in for the middleware chain. */
function createContext(session: Session = createSession()): AuthSession.Context {
	return {
		url: new URL("https://app.example.com/dashboard"),
		get(key) {
			return key === Session ? session : undefined;
		},
	};
}

/** Seconds since the epoch, offset by the given number of seconds. */
function epoch(offset = 0): number {
	return Math.floor(Date.now() / 1000) + offset;
}

/** A stored token set with a live access token. */
function tokens(overrides: Partial<AuthSession.Tokens> = {}): AuthSession.Tokens {
	return {
		idToken: token({ sub: "user-1", name: "Ada Lovelace" }),
		accessToken: token({ sub: "user-1", scope: "openid monitors:read" }),
		refreshToken: "refresh-1",
		expiresAt: epoch(ONE_HOUR),
		...overrides,
	};
}

describe("from", () => {
	test("answers null for a request nobody has signed in on", () => {
		expect(AuthSession.from(createContext())).toBeNull();
	});

	test("answers null for a record that no longer matches the stored shape", () => {
		let session = createSession();
		session.set("auth", { idToken: "only-this" });

		expect(AuthSession.from(createContext(session))).toBeNull();
	});

	test("reads back the token set a login wrote", () => {
		let ctx = createContext();
		let stored = tokens();
		AuthSession.write(ctx, stored);

		let auth = AuthSession.from(ctx);

		expect(auth?.tokens).toEqual(stored);
		expect(auth?.refreshToken).toBe("refresh-1");
	});

	test("reads the tokens through the classes that name their claims", () => {
		let ctx = createContext();
		AuthSession.write(ctx, tokens());

		let auth = AuthSession.from(ctx);

		expect(auth?.idToken.subject).toBe("user-1");
		expect(auth?.idToken.name).toBe("Ada Lovelace");
		expect(auth?.accessToken.has("monitors:read")).toBe(true);
	});

	test("throws when the session middleware has not run", () => {
		let ctx: AuthSession.Context = {
			url: new URL("https://app.example.com/"),
			get() {
				return undefined;
			},
		};

		expect(() => AuthSession.from(ctx)).toThrow(/remix\/middleware\/session/);
	});
});

describe("expired", () => {
	test("reads false while the stated lifetime is still running", () => {
		let ctx = createContext();
		AuthSession.write(ctx, tokens({ expiresAt: epoch(ONE_HOUR) }));

		expect(AuthSession.from(ctx)?.expired).toBe(false);
	});

	test("reads true once the stated lifetime has run out", () => {
		let ctx = createContext();
		AuthSession.write(ctx, tokens({ expiresAt: epoch(-1) }));

		expect(AuthSession.from(ctx)?.expired).toBe(true);
	});

	test("reads true within the reserve, so a token cannot lapse mid-request", () => {
		let ctx = createContext();
		AuthSession.write(ctx, tokens({ expiresAt: epoch(5) }));

		expect(AuthSession.from(ctx)?.expired).toBe(true);
	});

	test("reads the access token's own `exp` where the endpoint stated no lifetime", () => {
		let ctx = createContext();
		AuthSession.write(
			ctx,
			tokens({
				accessToken: token({ sub: "user-1", exp: epoch(ONE_HOUR) }),
				expiresAt: null,
			}),
		);

		expect(AuthSession.from(ctx)?.expired).toBe(false);
	});

	test("reads the access token's own `exp` over a stored lifetime that disagrees", () => {
		let live = createContext();
		AuthSession.write(
			live,
			tokens({ accessToken: token({ sub: "user-1", exp: epoch(ONE_HOUR) }), expiresAt: epoch(-1) }),
		);

		let lapsed = createContext();
		AuthSession.write(
			lapsed,
			tokens({ accessToken: token({ sub: "user-1", exp: epoch(-1) }), expiresAt: epoch(ONE_HOUR) }),
		);

		expect(AuthSession.from(live)?.expired).toBe(false);
		expect(AuthSession.from(lapsed)?.expired).toBe(true);
	});

	test("reads the ID token's `exp` where neither the token nor the endpoint states one", () => {
		let live = createContext();
		AuthSession.write(
			live,
			tokens({ idToken: token({ sub: "user-1", exp: epoch(ONE_HOUR) }), expiresAt: null }),
		);

		let lapsed = createContext();
		AuthSession.write(
			lapsed,
			tokens({ idToken: token({ sub: "user-1", exp: epoch(-1) }), expiresAt: null }),
		);

		expect(AuthSession.from(live)?.expired).toBe(false);
		expect(AuthSession.from(lapsed)?.expired).toBe(true);
	});

	test("reads true for a token set that states no end at all", () => {
		let ctx = createContext();
		AuthSession.write(ctx, tokens({ expiresAt: null }));

		expect(AuthSession.from(ctx)?.expired).toBe(true);
	});

	test("reads true for an opaque access token the endpoint stated no lifetime for", () => {
		let ctx = createContext();
		AuthSession.write(ctx, tokens({ accessToken: "opaque-token", expiresAt: null }));

		expect(AuthSession.from(ctx)?.expired).toBe(true);
	});
});

describe("refresh", () => {
	test("rewrites the session with the renewed tokens", async () => {
		let ctx = createContext();
		AuthSession.write(ctx, tokens({ expiresAt: epoch(-1) }));

		let renewed = token({ sub: "user-1", scope: "openid monitors:write" });
		let auth = AuthSession.from(ctx);
		await auth?.refresh({
			async exchangeRefreshToken(refreshToken) {
				expect(refreshToken).toBe("refresh-1");
				return {
					idToken: null,
					accessToken: renewed,
					refreshToken: "refresh-2",
					expiresAt: epoch(ONE_HOUR),
				};
			},
		});

		let reread = AuthSession.from(ctx);
		expect(reread?.tokens.accessToken).toBe(renewed);
		expect(reread?.refreshToken).toBe("refresh-2");
		expect(reread?.expired).toBe(false);
		expect(reread?.accessToken.has("monitors:write")).toBe(true);
	});

	test("keeps the stored ID token when the response repeats none", async () => {
		let ctx = createContext();
		let stored = tokens();
		AuthSession.write(ctx, stored);

		let auth = AuthSession.from(ctx);
		await auth?.refresh({
			async exchangeRefreshToken() {
				return {
					idToken: null,
					accessToken: token({ sub: "user-1" }),
					refreshToken: null,
					expiresAt: epoch(ONE_HOUR),
				};
			},
		});

		expect(AuthSession.from(ctx)?.tokens.idToken).toBe(stored.idToken);
	});

	test("keeps the stored refresh token when the provider rotates none", async () => {
		let ctx = createContext();
		AuthSession.write(ctx, tokens());

		let auth = AuthSession.from(ctx);
		await auth?.refresh({
			async exchangeRefreshToken() {
				return {
					idToken: null,
					accessToken: token({ sub: "user-1" }),
					refreshToken: null,
					expiresAt: epoch(ONE_HOUR),
				};
			},
		});

		expect(AuthSession.from(ctx)?.refreshToken).toBe("refresh-1");
	});

	test("takes the reissued ID token when the provider sends one", async () => {
		let ctx = createContext();
		AuthSession.write(ctx, tokens());
		let reissued = token({ sub: "user-1", name: "Ada L" });

		let auth = AuthSession.from(ctx);
		await auth?.refresh({
			async exchangeRefreshToken() {
				return {
					idToken: reissued,
					accessToken: token({ sub: "user-1" }),
					refreshToken: null,
					expiresAt: epoch(ONE_HOUR),
				};
			},
		});

		expect(AuthSession.from(ctx)?.idToken.name).toBe("Ada L");
	});

	test("throws missing_refresh_token when the grant carried none", async () => {
		let ctx = createContext();
		AuthSession.write(ctx, tokens({ refreshToken: null }));

		let auth = AuthSession.from(ctx);
		let error = await auth
			?.refresh({
				async exchangeRefreshToken() {
					throw new Error("the exchange must not be attempted");
				},
			})
			.catch((thrown: unknown) => thrown);

		expect(AuthError.is(error, AuthErrorCode.MissingRefreshToken)).toBe(true);
	});
});

describe("clear", () => {
	test("signs the request out and leaves the rest of the session standing", () => {
		let session = createSession();
		session.set("locale", "es");
		let ctx = createContext(session);
		AuthSession.write(ctx, tokens());

		AuthSession.from(ctx)?.clear();

		expect(AuthSession.from(ctx)).toBeNull();
		expect(session.get("locale")).toBe("es");
	});
});
