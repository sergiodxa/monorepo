/**
 * Request bodies in the shapes Okta and Microsoft Entra ID send when provisioning, taken
 * from their published SCIM 2.0 integration guides and the provisioning traffic a service
 * provider receives, with identifiers replaced by stable test values.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Okta's create-user body: `groups` sent empty, a password, and a primary work email. */
export const OKTA_CREATE_USER = {
	schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
	userName: "isaac.brock@example.com",
	name: { givenName: "Isaac", familyName: "Brock" },
	emails: [{ primary: true, value: "isaac.brock@example.com", type: "work" }],
	displayName: "Isaac Brock",
	locale: "en-US",
	externalId: "00ujl29u0le5T6Aj10h7",
	groups: [],
	password: "1mz050nq",
	active: true,
};

/** Okta's deactivation: a path-less replace of `active`. */
export const OKTA_DEACTIVATE_USER = {
	schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
	Operations: [{ op: "replace", value: { active: false } }],
};

/** Okta's group rename: a path-less replace that repeats the read-only `id`. */
export const OKTA_RENAME_GROUP = {
	schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
	Operations: [
		{
			op: "replace",
			value: { id: "abf4dd94-a4c0-4f67-89c9-76b03340cb9b", displayName: "Test SCIMv2" },
		},
	],
};

/** Okta's membership changes: add with a value list, remove through a value filter. */
export const OKTA_GROUP_MEMBERS = {
	schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
	Operations: [
		{
			op: "add",
			path: "members",
			value: [{ value: "23a35c27-23d3-4c03-b4c5-6443c09e7173", display: "test.user@okta.local" }],
		},
		{ op: "remove", path: 'members[value eq "89bb1940-b905-4575-9e7f-6f887cfb368e"]' },
	],
};

/** Entra ID's create-user body: both schemas declared, a partial `meta`, and an empty `roles`. */
export const ENTRA_CREATE_USER = {
	schemas: [
		"urn:ietf:params:scim:schemas:core:2.0:User",
		"urn:ietf:params:scim:schemas:extension:enterprise:2.0:User",
	],
	externalId: "0a21f0f2-8d2a-4f8e-bf98-7363c4aed4ef",
	userName: "Test_User_ab6490ee-1e48-479e-a20b-2d77186b5dd1",
	active: true,
	emails: [{ primary: true, type: "work", value: "Test_User_fd0ea19b@testuser.com" }],
	meta: { resourceType: "User" },
	name: { formatted: "givenName familyName", familyName: "familyName", givenName: "givenName" },
	roles: [],
	"urn:ietf:params:scim:schemas:extension:enterprise:2.0:User": { department: "Engineering" },
};

/** Entra ID's attribute update: capitalized ops and a value-filtered email path. */
export const ENTRA_UPDATE_USER = {
	schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
	Operations: [
		{ op: "Replace", path: 'emails[type eq "work"].value', value: "updatedEmail@microsoft.com" },
		{ op: "Replace", path: "name.familyName", value: "updatedFamilyName" },
	],
};

/** Entra ID's deactivation: `active` sent as the string `"False"`. */
export const ENTRA_DISABLE_USER = {
	schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
	Operations: [{ op: "Replace", path: "active", value: "False" }],
};

/** Entra ID's manager assignment: the complex `manager` set to a bare id. */
export const ENTRA_ADD_MANAGER = {
	schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
	Operations: [
		{
			op: "Add",
			path: "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User:manager",
			value: "2819c223-7f76-453a-919d-413861904646",
		},
	],
};

/** Entra ID's manager removal. */
export const ENTRA_REMOVE_MANAGER = {
	schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
	Operations: [
		{ op: "Remove", path: "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User:manager" },
	],
};

/** Entra ID's membership changes: remove names members through a value list, not a filter. */
export const ENTRA_GROUP_MEMBERS = {
	schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
	Operations: [
		{ op: "Add", path: "members", value: [{ value: "23a35c27-23d3-4c03-b4c5-6443c09e7173" }] },
		{ op: "Remove", path: "members", value: [{ value: "89bb1940-b905-4575-9e7f-6f887cfb368e" }] },
	],
};

/** Filters both providers send to look a resource up before creating it. */
export const PROVIDER_FILTERS = [
	'userName eq "test.user@okta.local"',
	'userName eq "Test_User_dfeef4c5-5681-4387-b016-bdf221e82081"',
	'externalId eq "0a21f0f2-8d2a-4f8e-bf98-7363c4aed4ef"',
	'displayName eq "Test SCIMv2"',
];
