/**
 * Exercises RFC 8414 metadata against the §3.2 example response: the issuer check,
 * extension members kept and validated, and the writer omitting what `define`
 * defaulted, so a round trip reproduces the document an app would write by hand.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import * as s from "@remix-run/data-schema";
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import {
	authorizationServerMetadata,
	define,
	MEDIA_TYPE,
	NAME,
	parse,
	stringify,
} from "./oauth-authorization-server.js";

/** The example response of RFC 8414 §3.2. */
const RFC_EXAMPLE = JSON.stringify({
	issuer: "https://server.example.com",
	authorization_endpoint: "https://server.example.com/authorize",
	token_endpoint: "https://server.example.com/token",
	token_endpoint_auth_methods_supported: ["client_secret_basic", "private_key_jwt"],
	token_endpoint_auth_signing_alg_values_supported: ["RS256", "ES256"],
	userinfo_endpoint: "https://server.example.com/userinfo",
	jwks_uri: "https://server.example.com/jwks.json",
	registration_endpoint: "https://server.example.com/register",
	scopes_supported: ["openid", "profile", "email", "address", "phone", "offline_access"],
	response_types_supported: ["code", "code token"],
	service_documentation: "http://server.example.com/service_documentation.html",
	ui_locales_supported: ["en-US", "en-GB", "en-CA", "fr-FR", "fr-CA"],
});

describe(parse, () => {
	test("reads the RFC 8414 §3.2 example into camelCase fields", () => {
		let metadata = unwrap(parse(RFC_EXAMPLE, { issuer: "https://server.example.com" }));
		expect(metadata.issuer).toBe("https://server.example.com");
		expect(metadata.tokenEndpoint).toEqual(new URL("https://server.example.com/token"));
		expect(metadata.tokenEndpointAuthMethodsSupported).toEqual([
			"client_secret_basic",
			"private_key_jwt",
		]);
		expect(metadata.responseTypesSupported).toEqual(["code", "code token"]);
		expect(metadata.revocationEndpoint).toBeNull();
		expect(metadata.grantTypesSupported).toEqual([]);
		expect(metadata.authorizationResponseIssParameterSupported).toBe(false);
	});

	test("keeps members outside RFC 8414 under extensions", () => {
		let metadata = unwrap(parse(RFC_EXAMPLE));
		expect(metadata.extensions).toEqual({
			userinfo_endpoint: "https://server.example.com/userinfo",
		});
	});

	test("validates extensions through a Standard Schema", () => {
		let schema = s.object({ userinfo_endpoint: s.string() });
		let metadata = unwrap(parse(RFC_EXAMPLE, { extensions: schema }));
		expect(metadata.extensions.userinfo_endpoint).toBe("https://server.example.com/userinfo");

		let result = parse(RFC_EXAMPLE, { extensions: s.object({ device_endpoint: s.string() }) });
		expect(isFailure(result) && result.error.issues[0]?.at).toBe("/device_endpoint");
	});

	test("fails when the document names another issuer (§3.3)", () => {
		let result = parse(RFC_EXAMPLE, { issuer: "https://attacker.example" });
		expect(isFailure(result)).toBe(true);
		if (isFailure(result)) {
			expect(result.error.format).toBe(NAME);
			expect(result.error.issues).toEqual([
				{ at: "/issuer", message: expect.stringContaining("attacker") },
			]);
		}
	});

	test("compares a URL issuer ignoring a trailing slash, and any other issuer byte for byte", () => {
		expect(isFailure(parse(RFC_EXAMPLE, { issuer: new URL("https://server.example.com/") }))).toBe(
			false,
		);

		let bare = JSON.stringify({ issuer: "auth.example.com", response_types_supported: ["code"] });
		expect(unwrap(parse(bare, { issuer: "auth.example.com" })).issuer).toBe("auth.example.com");
		expect(isFailure(parse(bare, { issuer: "Auth.example.com" }))).toBe(true);
	});

	test("reports every malformed or missing member with its JSON Pointer", () => {
		let result = parse(
			JSON.stringify({
				token_endpoint: "not a url",
				scopes_supported: ["a", 1],
				protected_resources: "x",
			}),
		);
		expect(isFailure(result) && result.error.issues.map((issue) => issue.at)).toEqual([
			"/issuer",
			"/token_endpoint",
			"/scopes_supported/1",
			"/response_types_supported",
			"/protected_resources",
		]);
	});

	test("fails on text that is not a JSON object", () => {
		expect(isFailure(parse("[]"))).toBe(true);
		expect(isFailure(parse("{"))).toBe(true);
	});
});

describe(define, () => {
	test("defaults lists to empty, URLs to null and flags to false", () => {
		let metadata = define({ issuer: "https://as.example", responseTypesSupported: ["code"] });
		expect(metadata.tokenEndpoint).toBeNull();
		expect(metadata.scopesSupported).toEqual([]);
		expect(metadata.authorizationResponseIssParameterSupported).toBe(false);
		expect(metadata.extensions).toEqual({});
	});
});

describe(stringify, () => {
	test("writes only the members an app set, under their registered names", () => {
		let metadata = define({
			issuer: "https://as.example",
			tokenEndpoint: new URL("https://as.example/token"),
			responseTypesSupported: ["code"],
			authorizationResponseIssParameterSupported: true,
			protectedResources: [new URL("https://as.example/userinfo")],
		});
		expect(JSON.parse(stringify(metadata))).toEqual({
			issuer: "https://as.example",
			token_endpoint: "https://as.example/token",
			response_types_supported: ["code"],
			authorization_response_iss_parameter_supported: true,
			protected_resources: ["https://as.example/userinfo"],
		});
	});

	test("writes extensions without letting one replace a standard member", () => {
		let metadata = define({
			issuer: "https://as.example",
			responseTypesSupported: ["code"],
			extensions: {
				issuer: "https://attacker.example",
				token_endpoint: "https://attacker.example",
				custom: 1,
			},
		});
		expect(JSON.parse(stringify(metadata))).toEqual({
			issuer: "https://as.example",
			response_types_supported: ["code"],
			custom: 1,
		});
	});

	test("writes the required response_types_supported even when it lists nothing", () => {
		let metadata = define({ issuer: "https://as.example", responseTypesSupported: [] });
		expect(JSON.parse(stringify(metadata))).toEqual({
			issuer: "https://as.example",
			response_types_supported: [],
		});
		expect(unwrap(parse(stringify(metadata)))).toEqual(metadata);
	});

	test("round-trips through parse", () => {
		let metadata = unwrap(parse(RFC_EXAMPLE));
		expect(unwrap(parse(stringify(metadata)))).toEqual(metadata);
	});
});

describe("authorizationServerMetadata", () => {
	test("describes the document for serving", () => {
		expect(authorizationServerMetadata).toMatchObject({
			name: NAME,
			mediaType: MEDIA_TYPE,
			placement: "insert",
			cors: false,
		});
		expect(unwrap(authorizationServerMetadata.parse(RFC_EXAMPLE)).issuer).toBe(
			"https://server.example.com",
		);
	});
});
