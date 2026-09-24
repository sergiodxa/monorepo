/**
 * Tests over the request shapes Okta and Microsoft Entra ID send: every body parses, and
 * every PATCH applies with the effect the provider intends.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isSuccess, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { ENTERPRISE_USER_DEFINITION, GROUP_DEFINITION, USER_DEFINITION } from "./discovery.js";
import { parseFilter } from "./filter.js";
import {
	ENTRA_ADD_MANAGER,
	ENTRA_CREATE_USER,
	ENTRA_DISABLE_USER,
	ENTRA_GROUP_MEMBERS,
	ENTRA_REMOVE_MANAGER,
	ENTRA_UPDATE_USER,
	OKTA_CREATE_USER,
	OKTA_DEACTIVATE_USER,
	OKTA_GROUP_MEMBERS,
	OKTA_RENAME_GROUP,
	PROVIDER_FILTERS,
} from "./fixtures/providers.js";
import { applyPatch, parsePatch } from "./patch.js";

import { ENTERPRISE_USER_SCHEMA, groupResource, parseUser, userResource } from "./index.js";

const USERS = {
	[USER_DEFINITION.id]: USER_DEFINITION,
	[ENTERPRISE_USER_DEFINITION.id]: ENTERPRISE_USER_DEFINITION,
};

const GROUPS = { [GROUP_DEFINITION.id]: GROUP_DEFINITION };

const GROUP = groupResource({
	id: "abf4dd94-a4c0-4f67-89c9-76b03340cb9b",
	displayName: "Old Name",
	members: [{ value: "89bb1940-b905-4575-9e7f-6f887cfb368e" }],
});

/**
 * Applies a provider's PATCH body, failing the test on error.
 *
 * @param resource - The current wire resource
 * @param body - The PATCH body
 * @param definitions - The definitions to apply against
 * @returns The patched resource
 */
function apply(resource: object, body: object, definitions = USERS): Record<string, unknown> {
	return unwrap(applyPatch(resource, unwrap(parsePatch(body)), { definitions })) as Record<
		string,
		unknown
	>;
}

describe("Okta", () => {
	test("creates a user from Okta's body", () => {
		let user = unwrap(parseUser(OKTA_CREATE_USER));
		expect(user).toMatchObject({ userName: "isaac.brock@example.com", groups: [], active: true });
		expect(userResource(user)).not.toHaveProperty("groups");
		expect(userResource(user)).not.toHaveProperty("password");
	});

	test("deactivates through a path-less replace", () => {
		let resource = userResource(unwrap(parseUser(OKTA_CREATE_USER)));
		expect(apply(resource, OKTA_DEACTIVATE_USER).active).toBe(false);
	});

	test("renames a group while repeating its read-only id", () => {
		expect(apply(GROUP, OKTA_RENAME_GROUP, GROUPS).displayName).toBe("Test SCIMv2");
	});

	test("adds and removes group members", () => {
		expect(apply(GROUP, OKTA_GROUP_MEMBERS, GROUPS).members).toEqual([
			{ value: "23a35c27-23d3-4c03-b4c5-6443c09e7173", display: "test.user@okta.local" },
		]);
	});
});

describe("Entra ID", () => {
	test("creates a user from Entra ID's body, ignoring its partial meta", () => {
		let user = unwrap(parseUser(ENTRA_CREATE_USER));
		expect(user.meta).toBeUndefined();
		expect(user.extensions.enterprise).toEqual({ department: "Engineering" });
		expect(userResource(user)).not.toHaveProperty("roles");
	});

	test("updates the work email and family name with capitalized ops", () => {
		let resource = userResource(unwrap(parseUser(ENTRA_CREATE_USER)));
		let patched = apply(resource, ENTRA_UPDATE_USER);
		expect(patched.emails).toEqual([
			{ primary: true, type: "work", value: "updatedEmail@microsoft.com" },
		]);
		expect(patched.name).toMatchObject({ familyName: "updatedFamilyName" });
	});

	test('disables a user whose active arrives as "False"', () => {
		let resource = userResource(unwrap(parseUser(ENTRA_CREATE_USER)));
		expect(apply(resource, ENTRA_DISABLE_USER).active).toBe(false);
	});

	test("sets the manager from a bare id and removes it again", () => {
		let resource = userResource(unwrap(parseUser(ENTRA_CREATE_USER)));
		let managed = apply(resource, ENTRA_ADD_MANAGER);
		expect(managed[ENTERPRISE_USER_SCHEMA]).toEqual({
			department: "Engineering",
			manager: { value: "2819c223-7f76-453a-919d-413861904646" },
		});
		expect(apply(managed, ENTRA_REMOVE_MANAGER)[ENTERPRISE_USER_SCHEMA]).toEqual({
			department: "Engineering",
		});
	});

	test("adds members and removes those a value list names", () => {
		expect(apply(GROUP, ENTRA_GROUP_MEMBERS, GROUPS).members).toEqual([
			{ value: "23a35c27-23d3-4c03-b4c5-6443c09e7173" },
		]);
	});
});

test.each(PROVIDER_FILTERS)("parses the lookup filter %s", (text) => {
	expect(isSuccess(parseFilter(text))).toBe(true);
});
