/**
 * Tests for route patterns as path templates, and for the security scheme builders
 * whose objects a document lists.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { RoutePattern } from "remix/route-pattern";
import { describe, expect, test } from "vitest";

import { toPathTemplate } from "./path.js";
import { apiKey, bearer, oauth2, openIdConnect } from "./security.js";

describe("toPathTemplate", () => {
	test("variables and named wildcards become template variables", () => {
		expect(unwrap(toPathTemplate(RoutePattern.parse("/teams/:teamId/files/*path")))).toEqual({
			path: "/teams/{teamId}/files/{path}",
			variables: ["teamId", "path"],
		});
		expect(unwrap(toPathTemplate(RoutePattern.parse("/")))).toEqual({ path: "/", variables: [] });
	});

	test("a variable followed by literal text keeps the text", () => {
		expect(unwrap(toPathTemplate(RoutePattern.parse("/feeds/:name.json"))).path).toBe(
			"/feeds/{name}.json",
		);
	});

	test("optional groups, unnamed wildcards and hostname variables are refused", () => {
		let messages = ["/posts(/:page)", "/files/*", "https://:tenant.example.com/a"].map((source) => {
			let result = toPathTemplate(RoutePattern.parse(source));
			return isFailure(result) ? result.error.message : null;
		});

		expect(messages).toEqual([
			'The optional segment in "/posts(/:page)" has no OpenAPI form',
			'The unnamed wildcard in "/files/*" has no OpenAPI form',
			'The hostname variable in "https://:tenant.example.com/a" has no OpenAPI form',
		]);
	});
});

describe("security schemes", () => {
	test("each builder writes its OpenAPI object", () => {
		expect(bearer({ bearerFormat: "JWT" })).toEqual({
			type: "http",
			scheme: "bearer",
			bearerFormat: "JWT",
		});
		expect(apiKey({ in: "header", name: "X-API-Key" })).toEqual({
			type: "apiKey",
			in: "header",
			name: "X-API-Key",
		});
		expect(
			oauth2({
				description: "Resource metadata at /.well-known/oauth-protected-resource",
				flows: {
					clientCredentials: { tokenUrl: "https://x.test/oauth/token", scopes: { read: "Read" } },
				},
			}),
		).toEqual({
			type: "oauth2",
			description: "Resource metadata at /.well-known/oauth-protected-resource",
			flows: {
				clientCredentials: { tokenUrl: "https://x.test/oauth/token", scopes: { read: "Read" } },
			},
		});
		expect(
			openIdConnect({ openIdConnectUrl: "https://x.test/.well-known/openid-configuration" }),
		).toEqual({
			type: "openIdConnect",
			openIdConnectUrl: "https://x.test/.well-known/openid-configuration",
		});
	});
});
