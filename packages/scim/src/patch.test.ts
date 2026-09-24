/**
 * Tests for PATCH: every request body RFC 7644 §3.5.2 prints parses and applies as the RFC
 * describes, plus the refusals (`noTarget`, `mutability`, `invalidPath`) and the
 * all-or-nothing guarantee.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { Patch } from "./patch.js";

import { ENTERPRISE_USER_DEFINITION, GROUP_DEFINITION, USER_DEFINITION } from "./discovery.js";
import { ENTERPRISE_USER, FULL_USER, GROUP } from "./fixtures/rfc7643-users.js";
import { applyPatch, parsePatch } from "./patch.js";

import type { ScimError } from "./index.js";

import { PATCH_OP_SCHEMA } from "./index.js";

const USERS = {
	[USER_DEFINITION.id]: USER_DEFINITION,
	[ENTERPRISE_USER_DEFINITION.id]: ENTERPRISE_USER_DEFINITION,
};

const GROUPS = { [GROUP_DEFINITION.id]: GROUP_DEFINITION };

const ENTERPRISE = "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User";

/**
 * A `PatchOp` body around the given operations.
 *
 * @param operations - The operations as sent
 * @returns The body
 */
function body(...operations: object[]): object {
	return { schemas: [PATCH_OP_SCHEMA], Operations: operations };
}

/**
 * Parses and applies a body, failing the test on error.
 *
 * @param resource - The resource to patch
 * @param operations - The operations as sent
 * @returns The patched resource
 */
function patch<Resource extends object>(resource: Resource, ...operations: object[]): Resource {
	let definitions = "members" in resource ? GROUPS : USERS;
	return unwrap(applyPatch(resource, unwrap(parsePatch(body(...operations))), { definitions }));
}

/**
 * Parses and applies a body that must fail, returning the error.
 *
 * @param resource - The resource to patch
 * @param operations - The operations as sent
 * @returns The error
 */
function refuse(resource: object, ...operations: object[]): ScimError {
	let definitions = "members" in resource ? GROUPS : USERS;
	let parsed = parsePatch(body(...operations));
	let result = isSuccess(parsed) ? applyPatch(resource, parsed.data, { definitions }) : parsed;
	if (!isFailure(result)) return expect.unreachable("expected the patch to fail");
	return result.error;
}

describe("parsePatch", () => {
	test.each([
		"members",
		"name.familyName",
		'addresses[type eq "work"]',
		'members[value eq "2819c223-7f76-453a-919d-413861904646"]',
		'members[value eq "2819c223-7f76-453a-919d-413861904646"].displayName',
	])("parses the RFC 7644 §3.5.2 path %s", (path) => {
		expect(isSuccess(parsePatch(body({ op: "remove", path })))).toBe(true);
	});

	test("reads a value path with a trailing sub-attribute", () => {
		let operations = unwrap(
			parsePatch(
				body({ op: "replace", path: 'addresses[type eq "work"].streetAddress', value: "x" }),
			),
		);
		expect(operations).toEqual<Patch.Operation[]>([
			{
				op: "replace",
				path: {
					attribute: { schema: null, attribute: "addresses", subAttribute: null },
					filter: {
						kind: "compare",
						path: { schema: null, attribute: "type", subAttribute: null },
						operator: "eq",
						value: "work",
					},
					subAttribute: "streetAddress",
				},
				value: "x",
			},
		]);
	});

	test("reads op case-insensitively, as Entra ID sends Replace", () => {
		let operations = unwrap(parsePatch(body({ op: "Replace", path: "active", value: "False" })));
		expect(operations[0]?.op).toBe("replace");
	});

	test.each<[string, unknown, string]>([
		["a body that is not an object", [], "invalidSyntax"],
		[
			"a body without the PatchOp schema",
			{ Operations: [{ op: "remove", path: "title" }] },
			"invalidSyntax",
		],
		["an empty Operations", body(), "invalidSyntax"],
		["an unknown op", body({ op: "move", path: "title" }), "invalidSyntax"],
		["a remove without a path", body({ op: "remove" }), "noTarget"],
		["an add without a value", body({ op: "add", path: "title" }), "invalidValue"],
		["a path-less replace of a non-object", body({ op: "replace", value: "x" }), "invalidValue"],
		["an unparseable path", body({ op: "remove", path: 'emails[type eq "work"' }), "invalidPath"],
		["a path that is not a string", body({ op: "remove", path: 42 }), "invalidPath"],
	])("refuses %s", (_, input, scimType) => {
		let result = parsePatch(input);
		expect(isFailure(result) && result.error.scimType).toBe(scimType);
		expect(isFailure(result) && result.error.status).toBe(400);
	});

	test("names the failing operation in the detail", () => {
		let result = parsePatch(body({ op: "remove", path: "title" }, { op: "remove" }));
		expect(isFailure(result) && result.error.message).toMatch(/^Operations\[1\]: /);
	});
});

describe("applyPatch with the RFC 7644 §3.5.2 examples", () => {
	test("§3.5.2.1 adds a member to a group", () => {
		let patched = patch(GROUP, {
			op: "add",
			path: "members",
			value: [
				{
					display: "Babs Jensen",
					$ref: "https://example.com/v2/Users/2819c223...413861904646",
					value: "2819c223-7f76-453a-919d-413861904646",
				},
			],
		});
		expect(patched.members).toHaveLength(3);
		expect(patched.members[2]).toMatchObject({ display: "Babs Jensen" });
	});

	test("§3.5.2.1 merges a path-less add, reading nickname as nickName", () => {
		let user = {
			schemas: [USER_DEFINITION.id],
			userName: "bjensen",
			emails: [{ value: "bjensen@example.com", type: "work", primary: true }],
		};
		let patched = patch(user, {
			op: "add",
			value: { emails: [{ value: "babs@jensen.org", type: "home" }], nickname: "Babs" },
		});
		expect(patched).toEqual({
			...user,
			emails: [...user.emails, { value: "babs@jensen.org", type: "home" }],
			nickName: "Babs",
		});
	});

	test("§3.5.2.1 adds nothing when the value is already present", () => {
		let patched = patch(FULL_USER, {
			op: "add",
			path: "emails",
			value: [{ value: "babs@jensen.org", type: "home" }],
		});
		expect(patched.emails).toEqual(FULL_USER.emails);
	});

	test("§3.5.2.2 removes a single member", () => {
		let patched = patch(GROUP, {
			op: "remove",
			path: 'members[value eq "2819c223-7f76-453a-919d-413861904646"]',
		});
		expect(patched.members.map((member) => member.value)).toEqual([
			"902c246b-6245-4190-8e05-00816be7344a",
		]);
	});

	test("§3.5.2.2 removes all members", () => {
		let patched = patch(GROUP, { op: "remove", path: "members" });
		expect("members" in patched).toBe(false);
	});

	test("§3.5.2.2 removes the values a complex filter selects", () => {
		let patched = patch(FULL_USER, {
			op: "remove",
			path: 'emails[type eq "work" and value ew "example.com"]',
		});
		expect(patched.emails).toEqual([{ value: "babs@jensen.org", type: "home" }]);
	});

	test("§3.5.2.2 removes one member and adds another in one request", () => {
		let patched = patch(
			GROUP,
			{ op: "remove", path: 'members[value eq "2819c223-7f76-453a-919d-413861904646"]' },
			{
				op: "add",
				path: "members",
				value: [
					{
						display: "James Smith",
						$ref: "https://example.com/v2/Users/08e1d05d...473d93df9210",
						value: "08e1d05d...473d93df9210",
					},
				],
			},
		);
		expect(patched.members.map((member) => member.value)).toEqual([
			"902c246b-6245-4190-8e05-00816be7344a",
			"08e1d05d...473d93df9210",
		]);
	});

	test("§3.5.2.3 replaces all members", () => {
		let members = [
			{
				display: "Babs Jensen",
				$ref: "https://example.com/v2/Users/2819c223...413861904646",
				value: "2819c223...413861904646",
			},
			{
				display: "James Smith",
				$ref: "https://example.com/v2/Users/08e1d05d...473d93df9210",
				value: "08e1d05d...473d93df9210",
			},
		];
		expect(patch(GROUP, { op: "replace", path: "members", value: members }).members).toEqual(
			members,
		);
	});

	test("§3.5.2.3 replaces the work address", () => {
		let address = {
			type: "work",
			streetAddress: "911 Universal City Plaza",
			locality: "Hollywood",
			region: "CA",
			postalCode: "91608",
			country: "US",
			formatted: "911 Universal City Plaza\nHollywood, CA 91608 US",
			primary: true,
		};
		let patched = patch(FULL_USER, {
			op: "replace",
			path: 'addresses[type eq "work"]',
			value: address,
		});
		expect(patched.addresses).toEqual([address, FULL_USER.addresses[1]]);
	});

	test("§3.5.2.3 replaces a sub-attribute of the work address", () => {
		let patched = patch(FULL_USER, {
			op: "replace",
			path: 'addresses[type eq "work"].streetAddress',
			value: "1010 Broadway Ave",
		});
		expect(patched.addresses[0]?.streetAddress).toBe("1010 Broadway Ave");
		expect(patched.addresses[1]).toEqual(FULL_USER.addresses[1]);
	});

	test("§3.5.2.3 replaces several attributes without a path", () => {
		let emails = [
			{ value: "bjensen@example.com", type: "work", primary: true },
			{ value: "babs@jensen.org", type: "home" },
		];
		let patched = patch(
			{ ...FULL_USER, emails: [{ value: "old@example.com" }], nickName: "B" },
			{ op: "replace", value: { emails, nickname: "Babs" } },
		);
		expect(patched.emails).toEqual(emails);
		expect(patched.nickName).toBe("Babs");
		expect("nickname" in patched).toBe(false);
	});

	test("§3.5.2 refuses members[...].displayName, since members has display, not displayName", () => {
		let error = refuse(GROUP, {
			op: "replace",
			path: 'members[value eq "2819c223-7f76-453a-919d-413861904646"].displayName',
			value: "Babs",
		});
		expect(error.scimType).toBe("invalidPath");
	});
});

describe("applyPatch semantics", () => {
	test("replaces a sub-attribute of a single complex attribute, merging the rest", () => {
		let patched = patch(FULL_USER, { op: "replace", path: "NAME.FAMILYNAME", value: "Smith" });
		expect(patched.name).toEqual({ ...FULL_USER.name, familyName: "Smith" });
	});

	test("merges an object into a single complex attribute on replace", () => {
		let patched = patch(FULL_USER, { op: "replace", path: "name", value: { givenName: "Babs" } });
		expect(patched.name).toEqual({ ...FULL_USER.name, givenName: "Babs" });
	});

	test("answers noTarget when a value filter matches nothing on replace or remove", () => {
		for (let op of ["replace", "remove"]) {
			let error = refuse(FULL_USER, { op, path: 'emails[type eq "other"].value', value: "x" });
			expect(error.scimType).toBe("noTarget");
			expect(error.status).toBe(400);
		}
	});

	test("creates the value an add targets through an eq filter, as Entra ID sends", () => {
		let patched = patch(
			{ schemas: [USER_DEFINITION.id], userName: "a" },
			{ op: "add", path: 'emails[type eq "work"].value', value: "a@example.com" },
		);
		expect(patched).toMatchObject({ emails: [{ type: "work", value: "a@example.com" }] });
	});

	test("refuses changes to read-only attributes but accepts them written back unchanged", () => {
		expect(refuse(FULL_USER, { op: "replace", path: "id", value: "other" }).scimType).toBe(
			"mutability",
		);
		expect(refuse(FULL_USER, { op: "add", path: "groups", value: [{ value: "x" }] }).scimType).toBe(
			"mutability",
		);
		expect(refuse(FULL_USER, { op: "remove", path: "meta" }).scimType).toBe("mutability");
		expect(
			patch(FULL_USER, { op: "replace", value: { id: FULL_USER.id, title: "Guide" } }).title,
		).toBe("Guide");
	});

	test("refuses changing an immutable sub-attribute that has a value", () => {
		let error = refuse(GROUP, {
			op: "replace",
			path: 'members[value eq "902c246b-6245-4190-8e05-00816be7344a"].value',
			value: "other",
		});
		expect(error.scimType).toBe("mutability");
	});

	test('reads "True" and "False" as booleans where the attribute is boolean', () => {
		expect(patch(FULL_USER, { op: "replace", path: "active", value: "False" }).active).toBe(false);
		expect(patch(FULL_USER, { op: "replace", value: { active: "True" } }).active).toBe(true);
		expect(patch(FULL_USER, { op: "replace", path: "title", value: "False" }).title).toBe("False");
	});

	test("writes enterprise attributes under their URN and declares the schema", () => {
		let patched = patch(FULL_USER, {
			op: "add",
			path: `${ENTERPRISE}:department`,
			value: "Sales",
		}) as Record<string, unknown>;
		expect(patched[ENTERPRISE]).toEqual({ department: "Sales" });
		expect(patched.schemas).toEqual([USER_DEFINITION.id, ENTERPRISE]);
	});

	test("reads URN-keyed objects and path-shaped keys in a path-less value", () => {
		let patched = patch(ENTERPRISE_USER, {
			op: "replace",
			value: {
				[ENTERPRISE]: { department: "Sales", "manager.value": "boss" },
				"name.givenName": "Barbara",
			},
		}) as Record<string, unknown>;
		expect(patched[ENTERPRISE]).toMatchObject({
			department: "Sales",
			manager: { value: "boss", displayName: "John Smith" },
		});
		expect(patched.name).toEqual({ givenName: "Barbara" });
	});

	test("drops an emptied extension and its URN from schemas", () => {
		let user = {
			schemas: [USER_DEFINITION.id, ENTERPRISE],
			userName: "a",
			[ENTERPRISE]: { department: "Sales" },
		};
		let patched = patch(user, { op: "remove", path: `${ENTERPRISE}:department` });
		expect(patched).toEqual({ schemas: [USER_DEFINITION.id], userName: "a" });
	});

	test("keeps at most one primary value", () => {
		let patched = patch(FULL_USER, {
			op: "add",
			path: "emails",
			value: { value: "new@example.com", type: "other", primary: true },
		});
		expect(patched.emails.filter((email) => "primary" in email && email.primary)).toEqual([
			{ value: "new@example.com", type: "other", primary: true },
		]);
	});

	test("removes the members a value list names, as Entra ID sends", () => {
		let patched = patch(GROUP, {
			op: "remove",
			path: "members",
			value: [{ value: "2819c223-7f76-453a-919d-413861904646" }],
		});
		expect(patched.members).toHaveLength(1);
	});

	test("refuses a path to an undefined attribute", () => {
		expect(refuse(FULL_USER, { op: "replace", path: "favoriteColor", value: "red" }).scimType).toBe(
			"invalidPath",
		);
		expect(
			refuse(FULL_USER, { op: "replace", path: 'title[value eq "x"]', value: "red" }).scimType,
		).toBe("invalidPath");
	});

	test("applies all operations or none, leaving the input untouched", () => {
		let before = structuredClone(FULL_USER);
		let error = refuse(
			FULL_USER,
			{ op: "replace", path: "title", value: "Changed" },
			{ op: "remove", path: 'emails[type eq "other"]' },
		);
		expect(error.message).toMatch(/^Operations\[1\]: /);
		expect(FULL_USER).toEqual(before);
	});
});
