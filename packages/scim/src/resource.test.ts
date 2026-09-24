/**
 * Tests for resources: parsing the RFC 7643 §8 examples into typed users and groups with
 * extensions, writing them back to the wire, and the refusals a malformed body gets.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import * as s from "remix/data-schema";
import { describe, expect, expectTypeOf, test } from "vitest";

import { ENTERPRISE_USER, FULL_USER, GROUP } from "./fixtures/rfc7643-users.js";

import type { Scim } from "./index.js";

import {
	ENTERPRISE_USER_SCHEMA,
	GROUP_SCHEMA,
	groupResource,
	parseGroup,
	parseUser,
	USER_SCHEMA,
	userResource,
} from "./index.js";

describe("parseUser", () => {
	test("reads the RFC 7643 §8.2 user into camelCase fields with typed meta", () => {
		let user = unwrap(parseUser(FULL_USER));
		expect(user.userName).toBe("bjensen@example.com");
		expect(user.name?.honorificSuffix).toBe("III");
		expect(user.emails).toEqual(FULL_USER.emails);
		expect(user.password).toBe("t1meMa$heen");
		expect(user.meta?.created).toEqual(new Date("2010-01-23T04:56:22Z"));
		expect(user.meta?.version).toBe('W/"a330bc54f0671c9"');
		expect(user.extensions).toEqual({});
	});

	test("reads the Enterprise User extension under extensions.enterprise by default", () => {
		let user = unwrap(parseUser(ENTERPRISE_USER));
		expectTypeOf(user.extensions.enterprise).toEqualTypeOf<Scim.EnterpriseUser | undefined>();
		expect(user.extensions.enterprise).toEqual({
			employeeNumber: "701984",
			costCenter: "4130",
			organization: "Universal Studios",
			division: "Theme Park",
			department: "Tour Operations",
			manager: {
				value: "26118915-6090-4610-87e4-49d8ca9f808d",
				ref: "../Users/26118915-6090-4610-87e4-49d8ca9f808d",
				displayName: "John Smith",
			},
		});
	});

	test("types and validates extensions with the caller's schemas", () => {
		let schema = s.object({ badge: s.string() });
		let urn = "urn:example:params:scim:schemas:extension:badge:2.0:User";
		let user = unwrap(
			parseUser(
				{ userName: "a", [urn]: { badge: "B-1" } },
				{ extensions: { badge: { urn, schema } } },
			),
		);
		expectTypeOf(user.extensions).toEqualTypeOf<{ badge?: { badge: string } }>();
		expect(user.extensions).toEqual({ badge: { badge: "B-1" } });

		let invalid = parseUser(
			{ userName: "a", [urn]: { badge: 1 } },
			{ extensions: { badge: { urn, schema } } },
		);
		expect(isFailure(invalid) && invalid.error.scimType).toBe("invalidValue");
		expect(isFailure(invalid) && invalid.error.message).toContain(`${urn}.badge`);
	});

	test("matches attribute names and the extension URN case-insensitively", () => {
		let user = unwrap(
			parseUser({
				UserName: "a",
				NAME: { GivenName: "Ana" },
				Emails: [{ Value: "a@example.com", Primary: true }],
				[ENTERPRISE_USER_SCHEMA.toLowerCase()]: { Department: "Sales" },
			}),
		);
		expect(user).toMatchObject({
			userName: "a",
			name: { givenName: "Ana" },
			emails: [{ value: "a@example.com", primary: true }],
			extensions: { enterprise: { department: "Sales" } },
		});
	});

	test("treats null members as unassigned", () => {
		let user = unwrap(parseUser({ userName: "a", displayName: null, name: { givenName: null } }));
		expect(user).toEqual({ userName: "a", name: {}, extensions: {} });
	});

	test("drops an incomplete meta, which is read-only on write", () => {
		expect(
			unwrap(parseUser({ userName: "a", meta: { resourceType: "User" } })).meta,
		).toBeUndefined();
	});

	test.each<[string, unknown, string]>([
		["a missing userName", { displayName: "A" }, "invalidValue"],
		["a mistyped active", { userName: "a", active: "yes" }, "invalidValue"],
		["an email without value", { userName: "a", emails: [{ type: "work" }] }, "invalidValue"],
		["a body that is not an object", "user", "invalidSyntax"],
	])("refuses %s", (_, body, scimType) => {
		let result = parseUser(body);
		expect(isFailure(result) && result.error.scimType).toBe(scimType);
		expect(isFailure(result) && result.error.status).toBe(400);
	});
});

describe("parseGroup", () => {
	test("reads the RFC 7643 §8.4 group, $ref as ref", () => {
		let group = unwrap(parseGroup(GROUP));
		expect(group.displayName).toBe("Tour Guides");
		expect(group.members?.[0]).toEqual({
			value: "2819c223-7f76-453a-919d-413861904646",
			ref: "https://example.com/v2/Users/2819c223-7f76-453a-919d-413861904646",
			display: "Babs Jensen",
		});
	});

	test("reads member type in any case", () => {
		let group = unwrap(parseGroup({ displayName: "G", members: [{ value: "1", type: "user" }] }));
		expect(group.members).toEqual([{ value: "1", type: "User" }]);
	});

	test("refuses a group without displayName", () => {
		let result = parseGroup({ members: [] });
		expect(isFailure(result) && result.error.scimType).toBe("invalidValue");
	});
});

describe("userResource", () => {
	test("round-trips the RFC 7643 users, leaving password out", () => {
		let { password: _password, ...withoutPassword } = FULL_USER;
		expect(userResource(unwrap(parseUser(FULL_USER)))).toEqual({
			...withoutPassword,
			meta: {
				...FULL_USER.meta,
				created: "2010-01-23T04:56:22.000Z",
				lastModified: "2011-05-13T04:42:34.000Z",
			},
		});
		expect(userResource(unwrap(parseUser(ENTERPRISE_USER)))).toEqual({
			...ENTERPRISE_USER,
			meta: {
				...ENTERPRISE_USER.meta,
				created: "2010-01-23T04:56:22.000Z",
				lastModified: "2011-05-13T04:42:34.000Z",
			},
		});
	});

	test("declares only the extensions present and drops empty members", () => {
		let resource = userResource({
			userName: "a",
			name: {},
			emails: [],
			displayName: undefined,
			extensions: { enterprise: {} },
		});
		expect(resource).toEqual({ schemas: [USER_SCHEMA], userName: "a" });
	});

	test("writes custom extensions under the URN the options name", () => {
		let urn = "urn:example:badge";
		let resource = userResource(
			{ userName: "a", extensions: { badge: { badge: "B-1" } } },
			{ extensions: { badge: { urn, schema: s.object({ badge: s.string() }) } } },
		);
		expect(resource).toEqual({
			schemas: [USER_SCHEMA, urn],
			userName: "a",
			[urn]: { badge: "B-1" },
		});
	});
});

describe("groupResource", () => {
	test("round-trips the RFC 7643 group", () => {
		expect(groupResource(unwrap(parseGroup(GROUP)))).toEqual({
			...GROUP,
			meta: {
				...GROUP.meta,
				created: "2010-01-23T04:56:22.000Z",
				lastModified: "2011-05-13T04:42:34.000Z",
			},
		});
	});

	test("omits an empty members list", () => {
		expect(groupResource({ id: "1", displayName: "G", members: [] })).toEqual({
			schemas: [GROUP_SCHEMA],
			id: "1",
			displayName: "G",
		});
	});
});
