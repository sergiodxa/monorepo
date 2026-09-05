/**
 * Specs for the one session key this package writes: what a signed-out request
 * reads, what a stored token set reads back as, when an access token counts as
 * spent, and what a refresh leaves in the session.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { AuthError, AuthErrorCode } from "./auth-error.js";
import { AuthSession } from "./auth-session.js";

/** Seconds in an hour, the lifetime the fixtures hand out. */
const ONE_HOUR = 3600;

/** Encodes bytes as unpadded base64url, the encoding a compact JWS segment uses. */
function base64url(bytes: Uint8Array): string {
	let binary = "";
	for (let byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Builds a compact JWS carrying the given claims. `AuthSession` reads a stored token
 * that was verified when it was written, so the signature segment stays a placeholder.
 */
function token(claims: Record<string, unknown>): string {
	let header = base64url(new TextEncoder().encode(JSON.stringify({ alg: "ES256", typ: "JWT" })));
	let payload = base64url(new TextEncoder().encode(JSON.stringify(claims)));
	return `${header}.${payload}.signature`;
}

/** The store a session middleware would hold for one browser, kept in memory. */
class MemoryStore implements AuthSession.Store {
	#values = new Map<string, unknown>();

	get(key: string): unknown {
		return this.#values.get(key);
	}

	set(key: string, value: unknown): void {
		this.#values.set(key, value);
	}

	unset(key: string): void {
		this.#values.delete(key);
	}
}

/** A fresh store, standing in for the session of a browser that has just arrived. */
function createStore(): AuthSession.Store {
	return new MemoryStore();
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
		expect(AuthSession.from(createStore())).toBeNull();
	});

	test("answers null for a record that no longer matches the stored shape", () => {
		let store = createStore();
		store.set("auth", { idToken: "only-this" });

		expect(AuthSession.from(store)).toBeNull();
	});

	test("reads back the token set a login wrote", () => {
		let store = createStore();
		let stored = tokens();
		AuthSession.write(store, stored);

		let auth = AuthSession.from(store);

		expect(auth?.tokens).toEqual(stored);
		expect(auth?.refreshToken).toBe("refresh-1");
	});

	test("reads the tokens through the classes that name their claims", () => {
		let store = createStore();
		AuthSession.write(store, tokens());

		let auth = AuthSession.from(store);

		expect(auth?.idToken.subject).toBe("user-1");
		expect(auth?.idToken.name).toBe("Ada Lovelace");
		expect(auth?.accessToken.has("monitors:read")).toBe(true);
	});
});

describe("expired", () => {
	test("reads false while the stated lifetime is still running", () => {
		let store = createStore();
		AuthSession.write(store, tokens({ expiresAt: epoch(ONE_HOUR) }));

		expect(AuthSession.from(store)?.expired).toBe(false);
	});

	test("reads true once the stated lifetime has run out", () => {
		let store = createStore();
		AuthSession.write(store, tokens({ expiresAt: epoch(-1) }));

		expect(AuthSession.from(store)?.expired).toBe(true);
	});

	test("reads true within the reserve, so a token cannot lapse mid-request", () => {
		let store = createStore();
		AuthSession.write(store, tokens({ expiresAt: epoch(5) }));

		expect(AuthSession.from(store)?.expired).toBe(true);
	});

	test("reads the access token's own `exp` where the endpoint stated no lifetime", () => {
		let store = createStore();
		AuthSession.write(
			store,
			tokens({
				accessToken: token({ sub: "user-1", exp: epoch(ONE_HOUR) }),
				expiresAt: null,
			}),
		);

		expect(AuthSession.from(store)?.expired).toBe(false);
	});

	test("reads the access token's own `exp` over a stored lifetime that disagrees", () => {
		let live = createStore();
		AuthSession.write(
			live,
			tokens({ accessToken: token({ sub: "user-1", exp: epoch(ONE_HOUR) }), expiresAt: epoch(-1) }),
		);

		let lapsed = createStore();
		AuthSession.write(
			lapsed,
			tokens({ accessToken: token({ sub: "user-1", exp: epoch(-1) }), expiresAt: epoch(ONE_HOUR) }),
		);

		expect(AuthSession.from(live)?.expired).toBe(false);
		expect(AuthSession.from(lapsed)?.expired).toBe(true);
	});

	test("reads the ID token's `exp` where neither the token nor the endpoint states one", () => {
		let live = createStore();
		AuthSession.write(
			live,
			tokens({ idToken: token({ sub: "user-1", exp: epoch(ONE_HOUR) }), expiresAt: null }),
		);

		let lapsed = createStore();
		AuthSession.write(
			lapsed,
			tokens({ idToken: token({ sub: "user-1", exp: epoch(-1) }), expiresAt: null }),
		);

		expect(AuthSession.from(live)?.expired).toBe(false);
		expect(AuthSession.from(lapsed)?.expired).toBe(true);
	});

	test("reads true for a token set that states no end at all", () => {
		let store = createStore();
		AuthSession.write(store, tokens({ expiresAt: null }));

		expect(AuthSession.from(store)?.expired).toBe(true);
	});

	test("reads true for an opaque access token the endpoint stated no lifetime for", () => {
		let store = createStore();
		AuthSession.write(store, tokens({ accessToken: "opaque-token", expiresAt: null }));

		expect(AuthSession.from(store)?.expired).toBe(true);
	});
});

describe("renewable", () => {
	test("reads true for a grant that carried a refresh token", () => {
		let store = createStore();
		AuthSession.write(store, tokens());

		expect(AuthSession.from(store)?.renewable).toBe(true);
	});

	/**
	 * The pair a holder branches on: the set is past its end, and nothing can bring it
	 * back, which is a session to read claims from rather than one to sign out.
	 */
	test("reads false past its expiry for a grant that carried none", () => {
		let store = createStore();
		AuthSession.write(store, tokens({ refreshToken: null, expiresAt: epoch(-1) }));

		let auth = AuthSession.from(store);

		expect(auth?.expired).toBe(true);
		expect(auth?.renewable).toBe(false);
	});
});

describe("refresh", () => {
	test("rewrites the session with the renewed tokens", async () => {
		let store = createStore();
		AuthSession.write(store, tokens({ expiresAt: epoch(-1) }));

		let renewed = token({ sub: "user-1", scope: "openid monitors:write" });
		let auth = AuthSession.from(store);
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

		let reread = AuthSession.from(store);
		expect(reread?.tokens.accessToken).toBe(renewed);
		expect(reread?.refreshToken).toBe("refresh-2");
		expect(reread?.expired).toBe(false);
		expect(reread?.accessToken.has("monitors:write")).toBe(true);
	});

	test("keeps the stored ID token when the response repeats none", async () => {
		let store = createStore();
		let stored = tokens();
		AuthSession.write(store, stored);

		let auth = AuthSession.from(store);
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

		expect(AuthSession.from(store)?.tokens.idToken).toBe(stored.idToken);
	});

	test("keeps the stored refresh token when the provider rotates none", async () => {
		let store = createStore();
		AuthSession.write(store, tokens());

		let auth = AuthSession.from(store);
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

		expect(AuthSession.from(store)?.refreshToken).toBe("refresh-1");
	});

	test("takes the reissued ID token when the provider sends one", async () => {
		let store = createStore();
		AuthSession.write(store, tokens());
		let reissued = token({ sub: "user-1", name: "Ada L" });

		let auth = AuthSession.from(store);
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

		expect(AuthSession.from(store)?.idToken.name).toBe("Ada L");
	});

	test("throws missing_refresh_token when the grant carried none", async () => {
		let store = createStore();
		AuthSession.write(store, tokens({ refreshToken: null }));

		let auth = AuthSession.from(store);
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
		let store = createStore();
		store.set("locale", "es");
		AuthSession.write(store, tokens());

		AuthSession.from(store)?.clear();

		expect(AuthSession.from(store)).toBeNull();
		expect(store.get("locale")).toBe("es");
	});
});
