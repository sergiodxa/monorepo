/**
 * Exercises RFC 9728 metadata against the §3.2 example: the §3.3 resource check in
 * both its exact and prefix forms, localized names, the `["header"]` default, and the
 * metadata URL built by inserting the suffix.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import {
	define,
	metadataUrl,
	parse,
	protectedResourceMetadata,
	stringify,
} from "./oauth-protected-resource.js";

/** The example response of RFC 9728 §3.2. */
const RFC_EXAMPLE = JSON.stringify({
	resource: "https://resource.example.com",
	authorization_servers: ["https://as1.example.com", "https://as2.example.net"],
	bearer_methods_supported: ["header", "body"],
	scopes_supported: ["profile", "email", "phone"],
	resource_documentation: "https://resource.example.com/resource_documentation.html",
});

describe(parse, () => {
	test("reads the RFC 9728 §3.2 example", () => {
		let metadata = unwrap(parse(RFC_EXAMPLE, { resource: "https://resource.example.com" }));
		expect(metadata.resource).toEqual(new URL("https://resource.example.com"));
		expect(metadata.authorizationServers.map((url) => url.href)).toEqual([
			"https://as1.example.com/",
			"https://as2.example.net/",
		]);
		expect(metadata.bearerMethodsSupported).toEqual(["header", "body"]);
		expect(metadata.resourceDocumentation?.href).toBe(
			"https://resource.example.com/resource_documentation.html",
		);
		expect(metadata.jwksUri).toBeNull();
		expect(metadata.dpopBoundAccessTokensRequired).toBe(false);
		expect(metadata.extensions).toEqual({});
	});

	test("fails when the document names another resource (§3.3)", () => {
		let result = parse(RFC_EXAMPLE, { resource: "https://other.example.com" });
		expect(isFailure(result) && result.error.issues[0]?.at).toBe("/resource");
	});

	test("requires an exact match unless prefix matching is asked for", () => {
		let document = JSON.stringify({ resource: "https://api.example/v1" });
		expect(isFailure(parse(document, { resource: "https://api.example/v1/items" }))).toBe(true);
		expect(
			isFailure(parse(document, { resource: "https://api.example/v1/items", match: "prefix" })),
		).toBe(false);
	});

	test("matches a prefix only on a segment boundary and the same origin", () => {
		let document = JSON.stringify({ resource: "https://api.example/v1" });
		expect(
			isFailure(parse(document, { resource: "https://api.example/v10", match: "prefix" })),
		).toBe(true);
		expect(
			isFailure(parse(document, { resource: "https://evil.example/v1/items", match: "prefix" })),
		).toBe(true);
		expect(
			isFailure(parse(document, { resource: "https://api.example/v1", match: "prefix" })),
		).toBe(false);
	});

	test("fails on a missing resource and an unregistered bearer method", () => {
		let result = parse(JSON.stringify({ bearer_methods_supported: ["cookie"] }), {
			resource: "https://api.example",
		});
		expect(isFailure(result) && result.error.issues.map((issue) => issue.at)).toEqual([
			"/resource",
			"/bearer_methods_supported/0",
		]);
	});

	test("reads a localized resource name with its tagged variants (§2.1)", () => {
		let document = JSON.stringify({
			resource: "https://api.example",
			resource_name: "Reader",
			"resource_name#es": "Lector",
			custom: true,
		});
		let metadata = unwrap(parse(document, { resource: "https://api.example" }));
		expect(metadata.resourceName).toEqual({ value: "Reader", translations: { es: "Lector" } });
		expect(metadata.extensions).toEqual({ custom: true });
	});
});

describe(define, () => {
	test("defaults bearer methods to the header alone", () => {
		let metadata = define({ resource: new URL("https://api.example/v1") });
		expect(metadata.bearerMethodsSupported).toEqual(["header"]);
		expect(metadata.authorizationServers).toEqual([]);
		expect(metadata.resourceName).toBeNull();
	});
});

describe(stringify, () => {
	test("writes registered names, a localized name's variants, and nothing defaulted", () => {
		let metadata = define({
			resource: new URL("https://api.example/mcp"),
			authorizationServers: [new URL("https://auth.example")],
			scopesSupported: ["read"],
			resourceName: { value: "Reader", translations: { es: "Lector" } },
		});
		expect(JSON.parse(stringify(metadata))).toEqual({
			resource: "https://api.example/mcp",
			authorization_servers: ["https://auth.example/"],
			scopes_supported: ["read"],
			bearer_methods_supported: ["header"],
			resource_name: "Reader",
			"resource_name#es": "Lector",
		});
	});

	test("round-trips through parse", () => {
		let metadata = unwrap(parse(RFC_EXAMPLE, { resource: "https://resource.example.com" }));
		expect(unwrap(parse(stringify(metadata), { resource: metadata.resource }))).toEqual(metadata);
	});
});

describe(metadataUrl, () => {
	test("inserts the suffix before the resource's path (§3.1)", () => {
		expect(metadataUrl("https://api.example.com/v1").href).toBe(
			"https://api.example.com/.well-known/oauth-protected-resource/v1",
		);
		expect(metadataUrl(new URL("https://resource.example.com")).href).toBe(
			"https://resource.example.com/.well-known/oauth-protected-resource",
		);
	});
});

describe("protectedResourceMetadata", () => {
	test("reads structure alone through the descriptor", () => {
		expect(protectedResourceMetadata.name).toBe("oauth-protected-resource");
		expect(unwrap(protectedResourceMetadata.parse(RFC_EXAMPLE)).scopesSupported).toHaveLength(3);
	});
});
