/**
 * Exercises OpenID Connect provider metadata: the members §3 requires, the §4.3
 * issuer check, the `request_uri_parameter_supported` default of `true`, and a
 * provider publishing ES256 alone still reading.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { define, openIdConfiguration, parse, stringify } from "./openid-configuration.js";

/** A provider document with the §3 required members and a few optional ones. */
const PROVIDER = JSON.stringify({
	issuer: "https://op.example",
	authorization_endpoint: "https://op.example/authorize",
	token_endpoint: "https://op.example/token",
	userinfo_endpoint: "https://op.example/userinfo",
	jwks_uri: "https://op.example/.well-known/jwks.json",
	response_types_supported: ["code"],
	subject_types_supported: ["public"],
	id_token_signing_alg_values_supported: ["ES256"],
	claims_supported: ["sub", "email"],
	backchannel_logout_supported: true,
	claims_parameter_supported: false,
});

describe(parse, () => {
	test("reads the OIDC members beside the RFC 8414 ones", () => {
		let metadata = unwrap(parse(PROVIDER, { issuer: "https://op.example" }));
		expect(metadata.authorizationEndpoint).toEqual(new URL("https://op.example/authorize"));
		expect(metadata.userinfoEndpoint).toEqual(new URL("https://op.example/userinfo"));
		expect(metadata.idTokenSigningAlgValuesSupported).toEqual(["ES256"]);
		expect(metadata.backchannelLogoutSupported).toBe(true);
		expect(metadata.extensions).toEqual({ claims_parameter_supported: false });
	});

	test("reads an absent request_uri_parameter_supported as true (§3)", () => {
		expect(unwrap(parse(PROVIDER)).requestUriParameterSupported).toBe(true);
		expect(unwrap(parse(PROVIDER)).requestParameterSupported).toBe(false);
	});

	test("fails when a member §3 requires is missing", () => {
		let result = parse(
			JSON.stringify({ issuer: "https://op.example", response_types_supported: ["code"] }),
		);
		expect(isFailure(result) && result.error.issues.map((issue) => issue.at)).toEqual([
			"/authorization_endpoint",
			"/jwks_uri",
			"/subject_types_supported",
			"/id_token_signing_alg_values_supported",
		]);
	});

	test("fails when the document names another issuer (§4.3)", () => {
		expect(isFailure(parse(PROVIDER, { issuer: "https://other.example" }))).toBe(true);
	});
});

describe(stringify, () => {
	test("writes a define'd document with only what the provider set, keeping a false request_uri flag", () => {
		let metadata = define({
			issuer: "https://op.example",
			authorizationEndpoint: new URL("https://op.example/authorize"),
			jwksUri: new URL("https://op.example/jwks.json"),
			responseTypesSupported: ["code"],
			subjectTypesSupported: ["public"],
			idTokenSigningAlgValuesSupported: ["ES256"],
			requestUriParameterSupported: false,
		});
		expect(JSON.parse(stringify(metadata))).toEqual({
			issuer: "https://op.example",
			authorization_endpoint: "https://op.example/authorize",
			jwks_uri: "https://op.example/jwks.json",
			response_types_supported: ["code"],
			subject_types_supported: ["public"],
			id_token_signing_alg_values_supported: ["ES256"],
			request_uri_parameter_supported: false,
		});
	});

	test("writes every required list even when it lists nothing", () => {
		let metadata = define({
			issuer: "https://op.example",
			authorizationEndpoint: new URL("https://op.example/authorize"),
			jwksUri: new URL("https://op.example/jwks.json"),
			responseTypesSupported: [],
			subjectTypesSupported: [],
			idTokenSigningAlgValuesSupported: [],
		});
		expect(JSON.parse(stringify(metadata))).toEqual({
			issuer: "https://op.example",
			authorization_endpoint: "https://op.example/authorize",
			jwks_uri: "https://op.example/jwks.json",
			response_types_supported: [],
			subject_types_supported: [],
			id_token_signing_alg_values_supported: [],
		});
		expect(unwrap(parse(stringify(metadata)))).toEqual(metadata);
	});

	test("round-trips through parse", () => {
		let metadata = unwrap(parse(PROVIDER));
		expect(unwrap(parse(stringify(metadata)))).toEqual(metadata);
	});
});

describe("openIdConfiguration", () => {
	test("appends its name to the issuer", () => {
		expect(openIdConfiguration.placement).toBe("append");
		expect(openIdConfiguration.name).toBe("openid-configuration");
	});
});
