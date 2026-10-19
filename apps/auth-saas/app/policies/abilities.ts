/**
 * Everything a management caller can do to a tenant, one ability per management operation,
 * each carrying the OAuth scope a token needs for it and the operation it guards. The scope
 * vocabulary stays the public contract; the policy grants these abilities through it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { abilities, ability } from "@sdxc/authz";

/**
 * An ability a token reaches through `scope`, guarding the management operation named
 * `operation`; the policy's scope roles and the refusal's challenge both read `scope` back.
 */
function scoped(scope: string, operation?: string) {
	return ability({ metadata: operation === undefined ? { scope } : { scope, operation } });
}

export default abilities({
	subjects: {
		create: scoped("subjects:write", "subjectsCreate"),
		list: scoped("subjects:read", "subjectsList"),
		read: scoped("subjects:read", "subjectsRead"),
		update: scoped("subjects:write", "subjectsUpdate"),
		block: scoped("subjects:write", "subjectsBlock"),
		unblock: scoped("subjects:write", "subjectsUnblock"),
		delete: scoped("subjects:write", "subjectsDelete"),
		identifiers: {
			add: scoped("subjects:write", "subjectIdentifiersAdd"),
			verify: scoped("subjects:write", "subjectIdentifiersVerify"),
			setPrimary: scoped("subjects:write", "subjectIdentifiersSetPrimary"),
			remove: scoped("subjects:write", "subjectIdentifiersRemove"),
		},
		import: {
			begin: scoped("subjects:write", "subjectsImportBegin"),
			status: scoped("subjects:read", "subjectsImportStatus"),
		},
		export: {
			begin: scoped("export:read", "subjectsExportBegin"),
			status: scoped("export:read", "subjectsExportStatus"),
			/** Password hashes in an export run, checked beside `begin` and `status`. */
			credentials: scoped("export:credentials"),
		},
		grants: {
			list: scoped("subjects:read", "subjectGrantsList"),
			revoke: scoped("subjects:write", "subjectGrantsRevoke"),
		},
		access: { read: scoped("members:write", "subjectAccessRead") },
		roles: { assign: scoped("members:write", "subjectRolesAssign") },
		passkeys: {
			list: scoped("subjects:write", "passkeysList"),
			rename: scoped("subjects:write", "passkeysRename"),
			revoke: scoped("subjects:write", "passkeysRevoke"),
		},
		password: { forceReset: scoped("subjects:write", "passwordForceReset") },
		secondFactor: {
			reset: scoped("subjects:write", "secondFactorReset"),
			revokeTrustedDevices: scoped("subjects:write", "secondFactorTrustedDevicesRevoke"),
		},
		sessions: {
			list: scoped("sessions:write", "sessionsList"),
			revoke: scoped("sessions:write", "sessionsRevoke"),
			revokeAll: scoped("sessions:write", "sessionsRevokeAll"),
		},
	},
	agentClients: { register: scoped("clients:write", "agentClientsRegister") },
	clients: {
		register: scoped("clients:write", "clientsRegister"),
		list: scoped("clients:write", "clientsList"),
		read: scoped("clients:write", "clientsRead"),
		update: scoped("clients:write", "clientsUpdate"),
		rotateSecret: scoped("clients:write", "clientsRotateSecret"),
		revokeSecret: scoped("clients:write", "clientsRevokeSecret"),
		disable: scoped("clients:write", "clientsDisable"),
		delete: scoped("clients:write", "clientsDelete"),
	},
	apiKeys: {
		create: scoped("keys:write", "apiKeysCreate"),
		list: scoped("keys:write", "apiKeysList"),
		read: scoped("keys:write", "apiKeysRead"),
		revoke: scoped("keys:write", "apiKeysRevoke"),
		rotate: scoped("keys:write", "apiKeysRotate"),
	},
	webhookEndpoints: {
		register: scoped("webhooks:write", "webhookEndpointsRegister"),
		list: scoped("webhooks:write", "webhookEndpointsList"),
		read: scoped("webhooks:write", "webhookEndpointsRead"),
		update: scoped("webhooks:write", "webhookEndpointsUpdate"),
		rotateSecret: scoped("webhooks:write", "webhookEndpointsRotateSecret"),
		delete: scoped("webhooks:write", "webhookEndpointsDelete"),
		deliveries: {
			list: scoped("webhooks:write", "webhookDeliveriesList"),
			replay: scoped("webhooks:write", "webhookDeliveriesReplay"),
		},
	},
	roles: {
		define: scoped("members:write", "rolesDefine"),
		list: scoped("members:write", "rolesList"),
		update: scoped("members:write", "rolesUpdate"),
		delete: scoped("members:write", "rolesDelete"),
		setPermissions: scoped("members:write", "rolesSetPermissions"),
		permissions: {
			list: scoped("members:write", "permissionsList"),
			define: scoped("members:write", "permissionsDefine"),
			remove: scoped("members:write", "permissionsRemove"),
		},
	},
	audit: { list: scoped("audit:read", "auditEventsList") },
	tenant: {
		read: scoped("tenant:write", "tenantRead"),
		domains: {
			list: scoped("tenant:write", "tenantDomainsList"),
			attach: scoped("tenant:write", "tenantDomainsAttach"),
			verification: scoped("tenant:write", "tenantDomainsVerification"),
			remove: scoped("tenant:write", "tenantDomainsRemove"),
		},
		mfaPolicy: { set: scoped("tenant:write", "tenantMfaPolicySet") },
		sessionPolicy: {
			describe: scoped("tenant:write", "tenantSessionPolicyDescribe"),
			set: scoped("tenant:write", "tenantSessionPolicySet"),
		},
		members: {
			list: scoped("members:write", "tenantMembersList"),
			create: scoped("members:write", "tenantMembersCreate"),
			updateRole: scoped("members:write", "tenantMembersUpdateRole"),
			remove: scoped("members:write", "tenantMembersRemove"),
			invite: scoped("members:write", "tenantMembersInvite"),
		},
	},
	billing: {
		manage: ability({
			description: "Start a checkout or open the billing portal from the dashboard",
		}),
	},
});
