/**
 * The centralized, type-safe route table for the management API, served on
 * `api.{PLATFORM_DOMAIN}`. This pass adds the passkeys, password and
 * second-factor administration and session routes onto the subjects,
 * clients, API keys, webhook endpoints, roles and permissions routes
 * earlier passes already mapped; each later resource-area pass extends this
 * same table with its own routes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { del, get, patch, post, put, route } from "remix/routes";

/**
 * The management API's route map.
 *
 * @example
 * routes.token.href();
 */
export default route({
	token: post("/oauth/token"),

	subjectsCreate: post("/tenants/:tenantId/subjects"),
	subjectsList: get("/tenants/:tenantId/subjects"),
	subjectsRead: get("/tenants/:tenantId/subjects/:subjectId"),
	subjectsUpdate: patch("/tenants/:tenantId/subjects/:subjectId"),
	subjectsBlock: post("/tenants/:tenantId/subjects/:subjectId/block"),
	subjectsUnblock: post("/tenants/:tenantId/subjects/:subjectId/unblock"),
	subjectsDelete: del("/tenants/:tenantId/subjects/:subjectId"),

	subjectIdentifiersAdd: post("/tenants/:tenantId/subjects/:subjectId/identifiers"),
	subjectIdentifiersVerify: post("/tenants/:tenantId/subjects/identifiers/verify"),
	subjectIdentifiersSetPrimary: post("/tenants/:tenantId/subjects/:subjectId/identifiers/primary"),
	subjectIdentifiersRemove: del("/tenants/:tenantId/subjects/:subjectId/identifiers"),

	clientsRegister: post("/tenants/:tenantId/clients"),
	clientsList: get("/tenants/:tenantId/clients"),
	clientsRead: get("/tenants/:tenantId/clients/:clientId"),
	clientsUpdate: patch("/tenants/:tenantId/clients/:clientId"),
	clientsRotateSecret: post("/tenants/:tenantId/clients/:clientId/rotate-secret"),
	clientsRevokeSecret: post("/tenants/:tenantId/clients/:clientId/secrets/:secretId/revoke"),
	clientsDisable: post("/tenants/:tenantId/clients/:clientId/disable"),
	clientsDelete: del("/tenants/:tenantId/clients/:clientId"),

	apiKeysCreate: post("/tenants/:tenantId/api-keys"),
	apiKeysList: get("/tenants/:tenantId/api-keys"),
	apiKeysRead: get("/tenants/:tenantId/api-keys/:keyId"),
	apiKeysRotate: post("/tenants/:tenantId/api-keys/:keyId/rotate"),
	apiKeysRevoke: post("/tenants/:tenantId/api-keys/:keyId/revoke"),

	webhookEndpointsRegister: post("/tenants/:tenantId/webhook-endpoints"),
	webhookEndpointsList: get("/tenants/:tenantId/webhook-endpoints"),
	webhookEndpointsRead: get("/tenants/:tenantId/webhook-endpoints/:endpointId"),
	webhookEndpointsUpdate: patch("/tenants/:tenantId/webhook-endpoints/:endpointId"),
	webhookEndpointsRotateSecret: post(
		"/tenants/:tenantId/webhook-endpoints/:endpointId/rotate-secret",
	),
	webhookEndpointsDelete: del("/tenants/:tenantId/webhook-endpoints/:endpointId"),

	webhookDeliveriesList: get("/tenants/:tenantId/webhook-endpoints/:endpointId/deliveries"),
	webhookDeliveriesReplay: post(
		"/tenants/:tenantId/webhook-endpoints/:endpointId/deliveries/:deliveryId/replay",
	),

	permissionsList: get("/tenants/:tenantId/permissions"),
	permissionsDefine: post("/tenants/:tenantId/permissions"),
	permissionsRemove: del("/tenants/:tenantId/permissions"),

	rolesList: get("/tenants/:tenantId/roles"),
	rolesDefine: post("/tenants/:tenantId/roles"),
	rolesUpdate: patch("/tenants/:tenantId/roles/:roleId"),
	rolesDelete: del("/tenants/:tenantId/roles/:roleId"),
	rolesSetPermissions: put("/tenants/:tenantId/roles/:roleId/permissions"),

	subjectRolesAssign: post("/tenants/:tenantId/subjects/:subjectId/roles"),
	subjectAccessRead: get("/tenants/:tenantId/subjects/:subjectId/access"),

	subjectGrantsList: get("/tenants/:tenantId/subjects/:subjectId/grants"),
	subjectGrantsRevoke: post("/tenants/:tenantId/subjects/:subjectId/grants/:clientId/revoke"),

	passkeysList: get("/tenants/:tenantId/subjects/:subjectId/passkeys"),
	passkeysRename: patch("/tenants/:tenantId/subjects/:subjectId/passkeys/:credentialId"),
	passkeysRevoke: del("/tenants/:tenantId/subjects/:subjectId/passkeys/:credentialId"),

	passwordForceReset: post("/tenants/:tenantId/subjects/:subjectId/password/force-reset"),

	secondFactorReset: post("/tenants/:tenantId/subjects/:subjectId/second-factor/reset"),
	secondFactorTrustedDevicesRevoke: post(
		"/tenants/:tenantId/subjects/:subjectId/second-factor/trusted-devices/:deviceId/revoke",
	),

	sessionsList: get("/tenants/:tenantId/subjects/:subjectId/sessions"),
	sessionsRevoke: del("/tenants/:tenantId/subjects/:subjectId/sessions/:sessionId"),
	sessionsRevokeAll: post("/tenants/:tenantId/subjects/:subjectId/sessions/revoke-all"),
});
