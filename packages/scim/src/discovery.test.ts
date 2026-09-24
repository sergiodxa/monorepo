/**
 * Tests for the discovery documents: the RFC 7643 §8.7 definitions, narrowing them to what
 * an app maps, and the `ServiceProviderConfig`, `ResourceTypes` and `Schemas` documents.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import {
	ENTERPRISE_USER_DEFINITION,
	GROUP_DEFINITION,
	pickAttributes,
	resourceTypes,
	schemas,
	serviceProviderConfig,
	USER_DEFINITION,
} from "./discovery.js";

import {
	ENTERPRISE_USER_SCHEMA,
	GROUP_SCHEMA,
	LIST_RESPONSE_SCHEMA,
	USER_SCHEMA,
} from "./index.js";

describe("definitions", () => {
	test("describe the RFC 7643 §8.7.1 characteristics that drive evaluation", () => {
		let userName = USER_DEFINITION.attributes.find((attribute) => attribute.name === "userName");
		expect(userName).toMatchObject({ required: true, caseExact: false, uniqueness: "server" });
		let password = USER_DEFINITION.attributes.find((attribute) => attribute.name === "password");
		expect(password).toMatchObject({ mutability: "writeOnly", returned: "never" });
		let groups = USER_DEFINITION.attributes.find((attribute) => attribute.name === "groups");
		expect(groups).toMatchObject({ mutability: "readOnly", multiValued: true });
		expect(USER_DEFINITION.attributes.map((attribute) => attribute.name)).toEqual([
			"userName",
			"name",
			"displayName",
			"nickName",
			"profileUrl",
			"title",
			"userType",
			"preferredLanguage",
			"locale",
			"timezone",
			"active",
			"password",
			"emails",
			"phoneNumbers",
			"ims",
			"photos",
			"addresses",
			"groups",
			"entitlements",
			"roles",
			"x509Certificates",
		]);
		expect(GROUP_DEFINITION.id).toBe(GROUP_SCHEMA);
		expect(ENTERPRISE_USER_DEFINITION.attributes.map((attribute) => attribute.name)).toEqual([
			"employeeNumber",
			"costCenter",
			"organization",
			"division",
			"department",
			"manager",
		]);
	});
});

describe("pickAttributes", () => {
	test("narrows to named attributes and sub-attributes, in definition order", () => {
		let picked = pickAttributes(USER_DEFINITION, [
			"emails.value",
			"active",
			"USERNAME",
			"emails.primary",
			"missing",
		]);
		expect(picked.attributes.map((attribute) => attribute.name)).toEqual([
			"userName",
			"active",
			"emails",
		]);
		expect(picked.attributes[2]?.subAttributes?.map((sub) => sub.name)).toEqual([
			"value",
			"primary",
		]);
		expect(picked.id).toBe(USER_SCHEMA);
	});

	test("keeps every sub-attribute when the attribute itself is named", () => {
		let picked = pickAttributes(USER_DEFINITION, ["name.givenName", "name"]);
		expect(picked.attributes[0]?.subAttributes).toHaveLength(6);
	});
});

describe("serviceProviderConfig", () => {
	test("advertises exactly what the options enable", () => {
		expect(
			serviceProviderConfig({
				patch: true,
				filter: { supported: true, maxResults: 200 },
				sort: false,
				etag: false,
				authenticationSchemes: [
					{
						type: "oauthbearertoken",
						name: "Bearer Token",
						description: "A per-connection bearer token.",
						specUri: "https://www.rfc-editor.org/rfc/rfc6750",
					},
				],
			}),
		).toEqual({
			schemas: ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
			patch: { supported: true },
			bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
			filter: { supported: true, maxResults: 200 },
			changePassword: { supported: false },
			sort: { supported: false },
			etag: { supported: false },
			authenticationSchemes: [
				{
					type: "oauthbearertoken",
					name: "Bearer Token",
					description: "A per-connection bearer token.",
					specUri: "https://www.rfc-editor.org/rfc/rfc6750",
				},
			],
		});
	});

	test("advertises bulk only with its limits", () => {
		let config = serviceProviderConfig({
			patch: true,
			filter: { supported: false, maxResults: 0 },
			sort: true,
			etag: true,
			bulk: { maxOperations: 1000, maxPayloadSize: 1048576 },
			authenticationSchemes: [],
			documentationUri: "https://example.com/help/scim.html",
		});
		expect(config).toMatchObject({
			bulk: { supported: true, maxOperations: 1000, maxPayloadSize: 1048576 },
			documentationUri: "https://example.com/help/scim.html",
		});
	});
});

describe("resourceTypes and schemas", () => {
	test("list the resource types with their extensions", () => {
		expect(
			resourceTypes([
				{
					id: "User",
					endpoint: "/Users",
					schema: USER_SCHEMA,
					extensions: [{ schema: ENTERPRISE_USER_SCHEMA, required: false }],
				},
				{ id: "Group", endpoint: "/Groups", schema: GROUP_SCHEMA },
			]),
		).toEqual({
			schemas: [LIST_RESPONSE_SCHEMA],
			totalResults: 2,
			startIndex: 1,
			itemsPerPage: 2,
			Resources: [
				{
					schemas: ["urn:ietf:params:scim:schemas:core:2.0:ResourceType"],
					id: "User",
					name: "User",
					endpoint: "/Users",
					schema: USER_SCHEMA,
					schemaExtensions: [{ schema: ENTERPRISE_USER_SCHEMA, required: false }],
				},
				{
					schemas: ["urn:ietf:params:scim:schemas:core:2.0:ResourceType"],
					id: "Group",
					name: "Group",
					endpoint: "/Groups",
					schema: GROUP_SCHEMA,
				},
			],
		});
	});

	test("list the schema definitions as Schema documents", () => {
		let document = schemas([USER_DEFINITION, GROUP_DEFINITION]) as {
			Resources: { schemas: string[]; id: string }[];
		};
		expect(document.Resources.map((resource) => resource.id)).toEqual([USER_SCHEMA, GROUP_SCHEMA]);
		expect(document.Resources[0]?.schemas).toEqual([
			"urn:ietf:params:scim:schemas:core:2.0:Schema",
		]);
	});
});
