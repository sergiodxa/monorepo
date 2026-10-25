/**
 * Exercises Client ID Metadata Documents against draft-ietf-oauth-client-id-metadata-document-02:
 * the §3 URL rules and its port example, the §4 `client_id` match, the §4.1 credential
 * rules around the §8.2 `private_key_jwt` example, and a round trip through the writer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import * as s from "@remix-run/data-schema";
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import {
	clientIdMetadataDocument,
	define,
	isClientIdentifierUrl,
	MEDIA_TYPE,
	parse,
	stringify,
} from "./client-id-metadata-document.js";
import { respond } from "./response.js";

/** The Client Identifier URL §3 uses for its comparison example. */
const CLIENT_ID = "https://example.com/client";

/** A public client's document, with the members an authorization server shows on consent. */
const PUBLIC_CLIENT = {
	client_id: CLIENT_ID,
	client_name: "Example Client",
	"client_name#es": "Cliente de ejemplo",
	client_uri: "https://example.com/",
	logo_uri: "https://example.com/logo.png",
	redirect_uris: ["https://example.com/callback"],
	scope: "openid profile",
	token_endpoint_auth_method: "none",
};

/** The §8.2 example, which establishes a confidential client through `jwks_uri`. */
const PRIVATE_KEY_JWT_CLIENT = {
	client_id: "https://client.example.com/metadata.json",
	redirect_uris: ["https://client.example.com/callback"],
	token_endpoint_auth_method: "private_key_jwt",
	jwks_uri: "https://client.example.com/jwks.json",
};

/**
 * The issue locations a failed read reports.
 *
 * @param document - The document to read.
 * @param clientId - The URL it was fetched from.
 */
function issuesOf(document: object, clientId = CLIENT_ID): Array<string | number> {
	let result = parse(JSON.stringify(document), { clientId });
	if (!isFailure(result)) throw new Error("The document parsed.");
	return result.error.issues.map((issue) => issue.at);
}

describe(isClientIdentifierUrl, () => {
	test("accepts an https URL with a path, a port or a query", () => {
		expect(isClientIdentifierUrl(CLIENT_ID)).toBe(true);
		expect(isClientIdentifierUrl("https://example.com:443/client")).toBe(true);
		expect(isClientIdentifierUrl("https://example.com/client?version=2")).toBe(true);
	});

	test("refuses another scheme, userinfo, a missing path, dot segments and a fragment", () => {
		expect(isClientIdentifierUrl("http://example.com/client")).toBe(false);
		expect(isClientIdentifierUrl("https://user@example.com/client")).toBe(false);
		expect(isClientIdentifierUrl("https://example.com")).toBe(false);
		expect(isClientIdentifierUrl("https://example.com?client")).toBe(false);
		expect(isClientIdentifierUrl("https://example.com/a/../client")).toBe(false);
		expect(isClientIdentifierUrl("https://example.com/./client")).toBe(false);
		expect(isClientIdentifierUrl("https://example.com/%2E%2E/client")).toBe(false);
		expect(isClientIdentifierUrl("https://example.com/client#main")).toBe(false);
		expect(isClientIdentifierUrl("client_01H8XYZ")).toBe(false);
	});
});

describe(parse, () => {
	test("reads a public client into camelCase fields with RFC 7591 defaults", () => {
		let client = unwrap(parse(JSON.stringify(PUBLIC_CLIENT), { clientId: CLIENT_ID }));
		expect(client.clientId).toBe(CLIENT_ID);
		expect(client.clientName).toEqual({
			value: "Example Client",
			translations: { es: "Cliente de ejemplo" },
		});
		expect(client.redirectUris).toEqual(["https://example.com/callback"]);
		expect(client.scope).toEqual(["openid", "profile"]);
		expect(client.logoUri).toEqual(new URL("https://example.com/logo.png"));
		expect(client.grantTypes).toEqual(["authorization_code"]);
		expect(client.responseTypes).toEqual(["code"]);
		expect(client.tosUri).toBeNull();
	});

	test("reads the §8.2 private_key_jwt example", () => {
		let client = unwrap(
			parse(JSON.stringify(PRIVATE_KEY_JWT_CLIENT), { clientId: PRIVATE_KEY_JWT_CLIENT.client_id }),
		);
		expect(client.tokenEndpointAuthMethod).toBe("private_key_jwt");
		expect(client.jwksUri).toEqual(new URL("https://client.example.com/jwks.json"));
	});

	test("reads an absent token_endpoint_auth_method as none", () => {
		let { token_endpoint_auth_method: _, ...document } = PUBLIC_CLIENT;
		let client = unwrap(parse(JSON.stringify(document), { clientId: CLIENT_ID }));
		expect(client.tokenEndpointAuthMethod).toBe("none");
	});

	test("compares client_id as a string, so §3's port example names another client", () => {
		expect(issuesOf({ ...PUBLIC_CLIENT, client_id: "https://example.com:443/client" })).toEqual([
			"/client_id",
		]);
	});

	test("refuses a client_id that is no Client Identifier URL", () => {
		expect(issuesOf({ ...PUBLIC_CLIENT, client_id: "https://example.com/client#x" })).toEqual([
			"/client_id",
		]);
		expect(issuesOf({ redirect_uris: ["https://example.com/callback"] })).toEqual(["/client_id"]);
	});

	test("refuses shared secrets and secret-based authentication", () => {
		expect(
			issuesOf({
				...PUBLIC_CLIENT,
				client_secret: "s3cr3t",
				client_secret_expires_at: 0,
				token_endpoint_auth_method: "client_secret_basic",
			}),
		).toEqual(["/client_secret", "/client_secret_expires_at", "/token_endpoint_auth_method"]);
		expect(issuesOf({ ...PUBLIC_CLIENT, token_endpoint_auth_method: "client_secret_jwt" })).toEqual(
			["/token_endpoint_auth_method"],
		);
		expect(issuesOf({ ...PUBLIC_CLIENT, token_endpoint_auth_method: "magic_link" })).toEqual([
			"/token_endpoint_auth_method",
		]);
	});

	test("requires exactly one key source for private_key_jwt", () => {
		let { jwks_uri: _, ...keyless } = PRIVATE_KEY_JWT_CLIENT;
		expect(issuesOf(keyless, keyless.client_id)).toEqual(["/token_endpoint_auth_method"]);
		expect(
			issuesOf({ ...PRIVATE_KEY_JWT_CLIENT, jwks: { keys: [] } }, PRIVATE_KEY_JWT_CLIENT.client_id),
		).toEqual([""]);
		expect(
			issuesOf(
				{ ...PRIVATE_KEY_JWT_CLIENT, jwks_uri: "http://client.example.com/jwks.json" },
				PRIVATE_KEY_JWT_CLIENT.client_id,
			),
		).toEqual(["/jwks_uri"]);
	});

	test("refuses private key material in jwks", () => {
		let { jwks_uri: _, ...keyless } = PRIVATE_KEY_JWT_CLIENT;
		let jwks = { keys: [{ kty: "EC", crv: "P-256", x: "x", y: "y", d: "private" }] };
		expect(issuesOf({ ...keyless, jwks }, keyless.client_id)).toEqual(["/jwks/keys/0/d"]);
	});

	test("refuses redirect URIs a client could not register", () => {
		expect(
			issuesOf({
				...PUBLIC_CLIENT,
				redirect_uris: ["https://example.com/cb#x", "javascript:alert(1)", "/callback"],
			}),
		).toEqual(["/redirect_uris/0", "/redirect_uris/1", "/redirect_uris/2"]);
		expect(issuesOf({ ...PUBLIC_CLIENT, redirect_uris: [] })).toEqual(["/redirect_uris"]);
	});

	test("accepts no redirect URI for a grant that uses none (§4.2)", () => {
		let client = unwrap(
			parse(JSON.stringify({ client_id: CLIENT_ID, grant_types: ["client_credentials"] }), {
				clientId: CLIENT_ID,
			}),
		);
		expect(client.redirectUris).toEqual([]);
	});

	test("refuses a display URL outside http and https (§8.6)", () => {
		expect(issuesOf({ ...PUBLIC_CLIENT, logo_uri: "javascript:alert(1)" })).toEqual(["/logo_uri"]);
	});

	test("keeps other RFC 7591 members under extensions, validated by a schema", () => {
		let document = JSON.stringify({ ...PUBLIC_CLIENT, id_token_signed_response_alg: "ES256" });
		let client = unwrap(
			parse(document, {
				clientId: CLIENT_ID,
				extensions: s.object({ id_token_signed_response_alg: s.string() }),
			}),
		);
		expect(client.extensions).toEqual({ id_token_signed_response_alg: "ES256" });
	});
});

describe(stringify, () => {
	test("round-trips a defined document, writing token_endpoint_auth_method", () => {
		let document = define({
			clientId: CLIENT_ID,
			redirectUris: ["https://example.com/callback"],
			scope: ["openid", "profile"],
		});
		let text = stringify(document);
		expect(JSON.parse(text)).toEqual({
			client_id: CLIENT_ID,
			redirect_uris: ["https://example.com/callback"],
			token_endpoint_auth_method: "none",
			scope: "openid profile",
		});
		expect(unwrap(parse(text, { clientId: CLIENT_ID }))).toEqual(document);
	});

	test("writes grant types that differ from the default, even an empty list", () => {
		let document = define({
			clientId: CLIENT_ID,
			grantTypes: ["client_credentials"],
			responseTypes: [],
		});
		expect(JSON.parse(stringify(document))).toMatchObject({
			grant_types: ["client_credentials"],
			response_types: [],
		});
	});

	test("publishes the public half of each key in jwks", () => {
		let document = define({
			clientId: CLIENT_ID,
			tokenEndpointAuthMethod: "private_key_jwt",
			jwks: { keys: [{ kty: "OKP", crv: "Ed25519", x: "public", d: "private", kid: "1" }] },
		});
		expect((JSON.parse(stringify(document)) as { jwks: unknown }).jwks).toEqual({
			keys: [{ kty: "OKP", crv: "Ed25519", x: "public", kid: "1" }],
		});
	});
});

describe("clientIdMetadataDocument", () => {
	test("serves the document as JSON with a cache policy and an ETag", async () => {
		let document = define({ clientId: CLIENT_ID, redirectUris: ["https://example.com/callback"] });
		let response = await respond(clientIdMetadataDocument, document);
		expect(response.headers.get("Content-Type")).toBe(MEDIA_TYPE);
		expect(response.headers.get("Cache-Control")).toContain("public");
		expect(response.headers.get("ETag")).not.toBeNull();
		expect(unwrap(parse(await response.text(), { clientId: CLIENT_ID }))).toEqual(document);
	});
});
