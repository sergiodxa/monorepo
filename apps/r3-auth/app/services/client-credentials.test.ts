/**
 * Tests for reading client credentials off a token request. The base64 cases are the
 * point: HTTP Basic is standard base64, while some clients encode the pair with a
 * base64url helper, and refusing either alphabet is a client that can never authenticate
 * with no error message that says why.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import {
	credentialsFromBody,
	credentialsFromHeader,
	readClientCredentials,
} from "~/app/services/client-credentials";

/** Builds an `Authorization: Basic` header the way a client library does. */
function basic(clientId: string, clientSecret: string): Headers {
	return new Headers({ Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}` });
}

describe("credentialsFromHeader", () => {
	test("reads a Basic header", () => {
		expect(credentialsFromHeader(basic("client", "secret"))).toEqual({
			clientId: "client",
			clientSecret: "secret",
		});
	});

	test("reads a secret whose base64 encoding contains + and /", () => {
		// "??>?" and "???" encode with `+` and `/`, which base64url decoding would reject.
		expect(credentialsFromHeader(basic("client", "??>?"))?.clientSecret).toBe("??>?");
		expect(credentialsFromHeader(basic("client", "???"))?.clientSecret).toBe("???");
	});

	test("reads credentials a client encoded with base64url", () => {
		// What a JOSE `base64url.encode` produces: `+` and `/` substituted, padding
		// dropped. `atob` refuses both outright, so a client encoding its Basic header
		// this way could never authenticate — and one of this server's own clients does.
		let secret = "??>?";
		let token = btoa(`client:${secret}`).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

		expect(token).toMatch(/[-_]/);
		expect(credentialsFromHeader(new Headers({ Authorization: `Basic ${token}` }))).toEqual({
			clientId: "client",
			clientSecret: secret,
		});
	});

	test("splits on the first colon, so a secret may contain one", () => {
		expect(credentialsFromHeader(basic("client", "a:b:c"))?.clientSecret).toBe("a:b:c");
	});

	test("ignores a header that is not Basic", () => {
		expect(credentialsFromHeader(new Headers({ Authorization: "Bearer token" }))).toBeNull();
	});

	test("ignores a missing, empty or unreadable header", () => {
		expect(credentialsFromHeader(new Headers())).toBeNull();
		expect(credentialsFromHeader(new Headers({ Authorization: "Basic" }))).toBeNull();
		expect(credentialsFromHeader(new Headers({ Authorization: "Basic !!!" }))).toBeNull();
		expect(
			credentialsFromHeader(new Headers({ Authorization: `Basic ${btoa("no-colon")}` })),
		).toBeNull();
	});

	test("ignores a pair missing either half", () => {
		expect(credentialsFromHeader(basic("", "secret"))).toBeNull();
		expect(credentialsFromHeader(basic("client", ""))).toBeNull();
	});
});

describe("credentialsFromBody", () => {
	test("reads both fields from the body", () => {
		expect(credentialsFromBody({ client_id: "client", client_secret: "secret" })).toEqual({
			clientId: "client",
			clientSecret: "secret",
		});
	});

	test("needs both fields", () => {
		expect(credentialsFromBody({ client_id: "client" })).toBeNull();
		expect(credentialsFromBody({ client_secret: "secret" })).toBeNull();
		expect(credentialsFromBody({})).toBeNull();
	});
});

describe("readClientCredentials", () => {
	test("prefers the header when a request presents both", () => {
		expect(
			readClientCredentials(basic("header-client", "header-secret"), {
				client_id: "body-client",
				client_secret: "body-secret",
			}),
		).toEqual({ clientId: "header-client", clientSecret: "header-secret" });
	});

	test("falls back to the body, which is what the relying parties send", () => {
		expect(
			readClientCredentials(new Headers(), {
				client_id: "body-client",
				client_secret: "body-secret",
			}),
		).toEqual({ clientId: "body-client", clientSecret: "body-secret" });
	});

	test("reports nothing when neither is presented", () => {
		expect(readClientCredentials(new Headers(), {})).toBeNull();
	});
});
