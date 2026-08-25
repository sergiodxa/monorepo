/**
 * Router-level tests of the three discovery documents. They assert the shape relying
 * parties read: the frozen scheme-less issuer, the endpoint URLs, the advertised
 * capabilities, that both metadata paths serve one identical document, and that the
 * published JWKS carries public key material only — the private scalar would let anybody
 * mint tokens this server's relying parties trust.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test } from "vitest";

import type { TestApp } from "~/app/lib/test/http";

import { createTestApp } from "~/app/lib/test/http";
import { ORIGIN } from "~/app/lib/test/seed";
import routes from "~/routes/web";

/** The subset of the metadata document these tests read. */
interface DiscoveryDocument {
	issuer: string;
	authorization_endpoint: string;
	token_endpoint: string;
	userinfo_endpoint: string;
	jwks_uri: string;
	end_session_endpoint: string;
	check_session_iframe: string;
	token_endpoint_auth_methods_supported: string[];
	grant_types_supported: string[];
	response_types_supported: string[];
	scopes_supported: string[];
	code_challenge_methods_supported: string[];
	backchannel_logout_supported: boolean;
	frontchannel_logout_supported: boolean;
}

/** A published JSON Web Key, as relying parties read it. */
interface PublishedKey {
	kty: string;
	crv?: string;
	alg?: string;
	kid?: string;
	d?: string;
}

let app: TestApp;

beforeEach(async () => {
	app = await createTestApp();
});

async function fetchJson<T>(path: string): Promise<{ response: Response; body: T }> {
	let response = await app.fetch(new Request(`${ORIGIN}${path}`));
	return { response, body: (await response.json()) as T };
}

describe("GET /.well-known/openid-configuration", () => {
	test("publishes the frozen issuer and every endpoint", async () => {
		let { response, body } = await fetchJson<DiscoveryDocument>(
			routes.wellKnown.openidConfiguration.href(),
		);

		expect(response.status).toBe(200);

		expect(body.issuer).toBe("auth.sergiodxa.com");

		expect(body.authorization_endpoint).toBe("https://auth.sergiodxa.com/authorize");
		expect(body.token_endpoint).toBe("https://auth.sergiodxa.com/oauth/token");
		expect(body.userinfo_endpoint).toBe("https://auth.sergiodxa.com/userinfo");
		expect(body.jwks_uri).toBe("https://auth.sergiodxa.com/.well-known/jwks.json");
		expect(body.end_session_endpoint).toBe("https://auth.sergiodxa.com/oidc/logout");
		expect(body.check_session_iframe).toBe("https://auth.sergiodxa.com/oidc/check-session");
	});

	test("advertises both client authentication methods the token endpoint accepts", async () => {
		let { body } = await fetchJson<DiscoveryDocument>(routes.wellKnown.openidConfiguration.href());

		expect(body.token_endpoint_auth_methods_supported).toEqual([
			"client_secret_basic",
			"client_secret_post",
		]);
	});

	test("advertises the grants, scopes and logout channels this server implements", async () => {
		let { body } = await fetchJson<DiscoveryDocument>(routes.wellKnown.openidConfiguration.href());

		expect(body.grant_types_supported).toEqual([
			"authorization_code",
			"refresh_token",
			"client_credentials",
		]);
		expect(body.response_types_supported).toEqual(["code"]);
		expect(body.scopes_supported).toEqual(["openid", "email", "profile"]);
		expect(body.code_challenge_methods_supported).toEqual(["S256", "plain"]);
		expect(body.backchannel_logout_supported).toBe(true);
		expect(body.frontchannel_logout_supported).toBe(true);
	});
});

describe("GET /.well-known/oauth-authorization-server", () => {
	test("serves the identical document RFC 8414 clients look for", async () => {
		let oidc = await fetchJson<DiscoveryDocument>(routes.wellKnown.openidConfiguration.href());
		let oauth = await fetchJson<DiscoveryDocument>(
			routes.wellKnown.oauthAuthorizationServer.href(),
		);

		expect(oauth.response.status).toBe(200);
		expect(oauth.body).toEqual(oidc.body);
	});
});

describe("GET /.well-known/jwks.json", () => {
	test("publishes the public half of the signing keys and nothing else", async () => {
		let { response, body } = await fetchJson<{ keys: PublishedKey[] }>(
			routes.wellKnown.jwks.href(),
		);

		expect(response.status).toBe(200);
		expect(body.keys.length).toBeGreaterThan(0);

		for (let key of body.keys) {
			expect(key.kty).toBe("EC");
			expect(key.crv).toBe("P-256");
			expect(key.d).toBeUndefined();
		}
	});
});
