/**
 * The management API's operations for Permissions, roles, role assignments, access, and consent grants: the schemas each route's
 * handler parses with and the OpenAPI document publishes, so the two cannot drift.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "@sdxc/json-schema";
import { defineOperation } from "@sdxc/openapi";

import {
	AUTH_PROBLEMS,
	IDEMPOTENCY_DESCRIPTION,
	IDEMPOTENCY_PROBLEMS,
	LINK_HEADER,
	mergePatchBody,
	PAGING_PROBLEMS,
	PAGING_QUERY,
	requires,
	UNSUPPORTED_MEDIA_TYPE,
} from "~/app/http/openapi/shared";
import routes from "~/routes/management";

/** A tenant's own declared permission; `createdAt` is epoch milliseconds. */
export const PERMISSION = s
	.object({
		key: s.string(),
		name: s.string(),
		description: s.string(),
		createdAt: s.integer(),
	})
	.meta({ id: "Permission" });

/**
 * A role held at a scope. A system role holds no row, so its `id` is its key and its
 * timestamps are `null`; a custom role's are epoch milliseconds.
 */
export const ROLE = s
	.object({
		id: s.string(),
		scope: s.string(),
		key: s.string(),
		name: s.string(),
		description: s.string(),
		system: s.boolean(),
		createdAt: s.nullable(s.integer()),
		updatedAt: s.nullable(s.integer()),
	})
	.meta({ id: "Role" });

/** A client a subject consented to, with the scopes agreed to; `createdAt` is epoch milliseconds. */
export const GRANT = s
	.object({
		clientId: s.string(),
		clientName: s.string(),
		scopes: s.array(s.string()),
		createdAt: s.integer(),
	})
	.meta({ id: "Grant" });

/** `GET /tenants/:tenantId/permissions`: the whole tenant-wide permission catalog, unpaginated. */
export const PERMISSIONS_LIST = defineOperation("permissionsList", routes.permissionsList, {
	summary: "List permissions",
	tags: ["Roles"],
	params: s.object({ tenantId: s.string() }),
	responses: {
		200: { description: "Every permission the tenant declared", body: s.array(PERMISSION) },
	},
	problems: [...AUTH_PROBLEMS],
	security: requires("members:write"),
});

/** `POST /tenants/:tenantId/permissions`: declares a permission; `auth:` keys stay the platform's own. */
export const PERMISSIONS_DEFINE = defineOperation("permissionsDefine", routes.permissionsDefine, {
	summary: "Define a permission",
	tags: ["Roles"],
	params: s.object({ tenantId: s.string() }),
	body: s.object({ key: s.string(), name: s.string(), description: s.string() }),
	responses: { 201: { description: "The declared permission", body: PERMISSION } },
	problems: [
		...AUTH_PROBLEMS,
		"validationFailed",
		"entitlementRequired",
		"reservedKey",
		"duplicatePermission",
	],
	security: requires("members:write"),
});

/** `DELETE /tenants/:tenantId/permissions?key=`: removes a permission and every role's grant of it. */
export const PERMISSIONS_REMOVE = defineOperation("permissionsRemove", routes.permissionsRemove, {
	summary: "Remove a permission",
	description:
		"The key travels in the query string, since a permission key may carry a `.` a path segment cannot.",
	tags: ["Roles"],
	params: s.object({ tenantId: s.string() }),
	query: s.object({ key: s.string() }),
	responses: { 204: { description: "The permission was removed" } },
	problems: [...AUTH_PROBLEMS, "validationFailed", "notFound", "entitlementRequired"],
	security: requires("members:write"),
});

/** `GET /tenants/:tenantId/roles?scope=`: every role at a scope, the system roles first. */
export const ROLES_LIST = defineOperation("rolesList", routes.rolesList, {
	summary: "List roles",
	tags: ["Roles"],
	params: s.object({ tenantId: s.string() }),
	query: s.object({ scope: s.string() }),
	responses: { 200: { description: "Every role held at the scope", body: s.array(ROLE) } },
	problems: [...AUTH_PROBLEMS, "validationFailed"],
	security: requires("members:write"),
});

/** `POST /tenants/:tenantId/roles`: defines a custom role at a scope; the system role keys stay reserved. */
export const ROLES_DEFINE = defineOperation("rolesDefine", routes.rolesDefine, {
	summary: "Define a role",
	description: IDEMPOTENCY_DESCRIPTION,
	tags: ["Roles"],
	params: s.object({ tenantId: s.string() }),
	body: s.object({
		scope: s.string(),
		key: s.string(),
		name: s.string(),
		description: s.string(),
	}),
	responses: { 201: { description: "The defined role", body: ROLE } },
	problems: [
		...AUTH_PROBLEMS,
		...IDEMPOTENCY_PROBLEMS,
		"validationFailed",
		"entitlementRequired",
		"reservedKey",
		"duplicateRole",
	],
	security: requires("members:write"),
});

/**
 * The `rolesUpdate` merge patch: `scope` locates the role and is always required, while
 * a member left out keeps its current value.
 */
export const ROLE_PATCH = s.object({
	scope: s.string(),
	name: s.optional(s.string()),
	description: s.optional(s.string()),
});

/** `PATCH /tenants/:tenantId/roles/:roleId`: renames or redescribes a custom role. */
export const ROLES_UPDATE = defineOperation("rolesUpdate", routes.rolesUpdate, {
	summary: "Update a role",
	tags: ["Roles"],
	params: s.object({ tenantId: s.string(), roleId: s.string() }),
	body: mergePatchBody(ROLE_PATCH),
	responses: {
		200: { description: "The updated role", body: ROLE },
		415: UNSUPPORTED_MEDIA_TYPE,
	},
	problems: [...AUTH_PROBLEMS, "validationFailed", "notFound", "entitlementRequired", "systemRole"],
	security: requires("members:write"),
});

/** `DELETE /tenants/:tenantId/roles/:roleId`: deletes a custom role, moving its holders to `reassignTo`. */
export const ROLES_DELETE = defineOperation("rolesDelete", routes.rolesDelete, {
	summary: "Delete a role",
	tags: ["Roles"],
	params: s.object({ tenantId: s.string(), roleId: s.string() }),
	query: s.object({ scope: s.string(), reassignTo: s.string() }),
	responses: {
		200: {
			description: "How many holders moved to the reassignment role",
			body: s.object({ reassigned: s.integer() }),
		},
	},
	problems: [
		...AUTH_PROBLEMS,
		"validationFailed",
		"notFound",
		"entitlementRequired",
		"invalidReassignment",
		"systemRole",
	],
	security: requires("members:write"),
});

/** `PUT /tenants/:tenantId/roles/:roleId/permissions`: replaces a custom role's whole granted set. */
export const ROLES_SET_PERMISSIONS = defineOperation(
	"rolesSetPermissions",
	routes.rolesSetPermissions,
	{
		summary: "Set a role's permissions",
		tags: ["Roles"],
		params: s.object({ tenantId: s.string(), roleId: s.string() }),
		body: s.object({ permissionKeys: s.array(s.string()) }),
		responses: {
			200: {
				description: "The set now granted",
				body: s.object({ permissionKeys: s.array(s.string()) }),
			},
		},
		problems: [
			...AUTH_PROBLEMS,
			"validationFailed",
			"notFound",
			"entitlementRequired",
			"unknownPermission",
			"permissionSetTooLarge",
			"systemRole",
		],
		security: requires("members:write"),
	},
);

/** `POST /tenants/:tenantId/subjects/:subjectId/roles`: assigns a role at a scope, replacing the one held there. */
export const SUBJECT_ROLES_ASSIGN = defineOperation(
	"subjectRolesAssign",
	routes.subjectRolesAssign,
	{
		summary: "Assign a role to a subject",
		tags: ["Roles"],
		params: s.object({ tenantId: s.string(), subjectId: s.string() }),
		body: s.object({ scope: s.string(), roleKey: s.string() }),
		responses: {
			200: { description: "The role now held", body: s.object({ roleKey: s.string() }) },
		},
		problems: [...AUTH_PROBLEMS, "validationFailed", "notFound", "notMember", "lastOwner"],
		security: requires("members:write"),
	},
);

/** `GET /tenants/:tenantId/subjects/:subjectId/access?scope=`: the held role and what it resolves to. */
export const SUBJECT_ACCESS_READ = defineOperation("subjectAccessRead", routes.subjectAccessRead, {
	summary: "Read a subject's access",
	tags: ["Roles"],
	params: s.object({ tenantId: s.string(), subjectId: s.string() }),
	query: s.object({ scope: s.string() }),
	responses: {
		200: {
			description: "The roles held at the scope (empty when none) and their permission keys",
			body: s.object({ roles: s.array(ROLE), permissions: s.array(s.string()) }),
		},
	},
	problems: [...AUTH_PROBLEMS, "validationFailed"],
	security: requires("members:write"),
});

/** `GET /tenants/:tenantId/subjects/:subjectId/grants`: a keyset page of consent grants, newest first. */
export const SUBJECT_GRANTS_LIST = defineOperation("subjectGrantsList", routes.subjectGrantsList, {
	summary: "List a subject's consent grants",
	tags: ["Roles"],
	params: s.object({ tenantId: s.string(), subjectId: s.string() }),
	query: s.object({ ...PAGING_QUERY }),
	responses: {
		200: { description: "The page of grants", body: s.array(GRANT), headers: LINK_HEADER },
	},
	problems: [...AUTH_PROBLEMS, ...PAGING_PROBLEMS],
	security: requires("subjects:read"),
});

/** `POST /tenants/:tenantId/subjects/:subjectId/grants/:clientId/revoke`: ends one client's standing consent. */
export const SUBJECT_GRANTS_REVOKE = defineOperation(
	"subjectGrantsRevoke",
	routes.subjectGrantsRevoke,
	{
		summary: "Revoke a consent grant",
		tags: ["Roles"],
		params: s.object({ tenantId: s.string(), subjectId: s.string(), clientId: s.string() }),
		responses: { 204: { description: "The grant was revoked" } },
		problems: [...AUTH_PROBLEMS, "notFound"],
		security: requires("subjects:write"),
	},
);

/** Every operation in this area, in route-map order, for the document to list. */
export const ROLES_OPERATIONS = [
	PERMISSIONS_LIST,
	PERMISSIONS_DEFINE,
	PERMISSIONS_REMOVE,
	ROLES_LIST,
	ROLES_DEFINE,
	ROLES_UPDATE,
	ROLES_DELETE,
	ROLES_SET_PERMISSIONS,
	SUBJECT_ROLES_ASSIGN,
	SUBJECT_ACCESS_READ,
	SUBJECT_GRANTS_LIST,
	SUBJECT_GRANTS_REVOKE,
] as const;
