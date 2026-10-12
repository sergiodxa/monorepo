/**
 * The management API router for `routes/management.ts`, served on `api.{PLATFORM_DOMAIN}`:
 * the token endpoint, the OpenAPI document, and every subjects, clients, API keys, webhook,
 * roles, credentials, audit and tenant resource route, each imported on first use.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import { database } from "@sdxc/database-middleware";
import getClientIP from "@sdxc/get-client-ip/middleware";
import { lazy } from "@sdxc/lazy-route";
import { log } from "@sdxc/logger/middleware";
import { securityHeaders } from "@sdxc/security-headers/middleware";
import { trace } from "@sdxc/trace-context/middleware";
import { trailingSlash } from "@sdxc/trailing-slash-middleware";
import { wellKnown } from "@sdxc/well-known/middleware";
import { env } from "cloudflare:workers";
import { asyncContext } from "remix/middleware/async-context";
import { formData } from "remix/middleware/form-data";
import { createRouter } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";

import notFound from "~/app/http/controllers/not-found";
import { apiVersioning } from "~/app/http/middleware/api-version";
import { mail } from "~/app/http/middleware/mail";
import { managementWellKnown } from "~/app/http/middleware/management-well-known";
import { models } from "~/app/http/middleware/models";
import { requestOrigin } from "~/app/http/request-origin";
import { createDatabase } from "~/app/initializers/database";
import { createHostnameClient } from "~/app/initializers/hostnames";
import { logger } from "~/app/initializers/logger";
import { sessionCookie } from "~/app/initializers/session-cookie";
import { MANAGEMENT_SECURITY_POLICY } from "~/config/security-policy";
import { securityTxtEntry } from "~/config/security-txt";
import routes from "~/routes/management";

/**
 * Resolves a dashboard request's `__Host-session` cookie against the platform's own
 * identity tenant — the Durable Object addressed by the platform's own domain name,
 * the one hostname every deploy already names, so no separate provisioning step is
 * owed to reach it.
 */
async function resolveDashboardSubjectId(ctx: RequestContext): Promise<string | null> {
	let sessionToken = await sessionCookie.parse(ctx.request.headers.get("Cookie"));
	if (!sessionToken) return null;

	let stub = env.TENANT.getByName(env.PLATFORM_DOMAIN);
	let resolved = await stub.resolveSession({ token: sessionToken, ...requestOrigin(ctx.request) });

	return resolved.status === "active" ? resolved.subjectId : null;
}

/** The management API's own origin: its issuer, and its RFC 9728 resource identifier. */
let issuer = `https://api.${env.PLATFORM_DOMAIN}`;

/**
 * The management API's router, with a `404` default handler for any path no
 * resource route claims.
 *
 * @example
 * return await managementRouter.fetch(request);
 */
export const managementRouter = createRouter({
	middleware: [
		trailingSlash(),
		log(logger),
		getClientIP(),
		trace(),
		asyncContext(),
		securityHeaders(MANAGEMENT_SECURITY_POLICY),
		wellKnown({ "security.txt": securityTxtEntry }),
		database(createDatabase()),
		models(),
		managementWellKnown(issuer),
		formData(),
		apiVersioning(),
		mail(),
	],
	defaultHandler: notFound,
});

managementRouter.map(
	routes.token,
	lazy(() => import("~/app/http/controllers/management/token")),
);

managementRouter.map(
	routes.openapi,
	lazy(() => import("~/app/http/controllers/management/openapi")),
);

/**
 * Mounted with no `managementAuth` middleware: an invitation's own emailed
 * token is this route's entire credential, exactly like the subject import and
 * export download routes' own tickets.
 */
managementRouter.map(
	routes.invitationsAccept,
	lazy(() => import("~/app/http/controllers/management/invitations/accept")),
);

/**
 * The auth, rate-limit and tenant-stub options every resource controller factory
 * shares, assembled once here from the platform's own bindings.
 */
let controllerOptions: ManagementControllerOptions = {
	issuer,
	resolveDashboardSubjectId,
	limiter: env.MANAGEMENT_RATE_LIMITER,
	resolveStub: (tenantId) => env.TENANT.getByName(tenantId),
	hostnameClient: createHostnameClient,
	r2: env.R2,
};

managementRouter.map(
	routes.subjectsCreate,
	lazy(() =>
		import("~/app/http/controllers/management/subjects/create").then((it) =>
			it.createSubjectsCreateAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.subjectsList,
	lazy(() =>
		import("~/app/http/controllers/management/subjects/list").then((it) =>
			it.createSubjectsListAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.subjectsRead,
	lazy(() =>
		import("~/app/http/controllers/management/subjects/read").then((it) =>
			it.createSubjectsReadAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.subjectsUpdate,
	lazy(() =>
		import("~/app/http/controllers/management/subjects/update").then((it) =>
			it.createSubjectsUpdateAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.subjectsBlock,
	lazy(() =>
		import("~/app/http/controllers/management/subjects/block").then((it) =>
			it.createSubjectsBlockAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.subjectsUnblock,
	lazy(() =>
		import("~/app/http/controllers/management/subjects/unblock").then((it) =>
			it.createSubjectsUnblockAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.subjectsDelete,
	lazy(() =>
		import("~/app/http/controllers/management/subjects/delete").then((it) =>
			it.createSubjectsDeleteAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.subjectIdentifiersAdd,
	lazy(() =>
		import("~/app/http/controllers/management/subjects/identifiers").then((it) =>
			it.createSubjectIdentifiersAddAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.subjectIdentifiersVerify,
	lazy(() =>
		import("~/app/http/controllers/management/subjects/identifiers").then((it) =>
			it.createSubjectIdentifiersVerifyAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.subjectIdentifiersSetPrimary,
	lazy(() =>
		import("~/app/http/controllers/management/subjects/identifiers").then((it) =>
			it.createSubjectIdentifiersSetPrimaryAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.subjectIdentifiersRemove,
	lazy(() =>
		import("~/app/http/controllers/management/subjects/identifiers").then((it) =>
			it.createSubjectIdentifiersRemoveAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.subjectsImportBegin,
	lazy(() =>
		import("~/app/http/controllers/management/subjects/import").then((it) =>
			it.createSubjectsImportBeginAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.subjectsImportStatus,
	lazy(() =>
		import("~/app/http/controllers/management/subjects/import-status").then((it) =>
			it.createSubjectsImportStatusAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.subjectsImportDownload,
	lazy(() =>
		import("~/app/http/controllers/management/subjects/import-download").then((it) =>
			it.createSubjectsImportDownloadAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.subjectsExportBegin,
	lazy(() =>
		import("~/app/http/controllers/management/subjects/export").then((it) =>
			it.createSubjectsExportBeginAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.subjectsExportStatus,
	lazy(() =>
		import("~/app/http/controllers/management/subjects/export-status").then((it) =>
			it.createSubjectsExportStatusAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.subjectsExportDownload,
	lazy(() =>
		import("~/app/http/controllers/management/subjects/export-download").then((it) =>
			it.createSubjectsExportDownloadAction(controllerOptions),
		),
	),
);

managementRouter.map(
	routes.agentClientsRegister,
	lazy(() =>
		import("~/app/http/controllers/management/agent-clients/register").then((it) =>
			it.createAgentClientsRegisterAction(controllerOptions),
		),
	),
);

managementRouter.map(
	routes.clientsRegister,
	lazy(() =>
		import("~/app/http/controllers/management/clients/register").then((it) =>
			it.createClientsRegisterAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.clientsList,
	lazy(() =>
		import("~/app/http/controllers/management/clients/list").then((it) =>
			it.createClientsListAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.clientsRead,
	lazy(() =>
		import("~/app/http/controllers/management/clients/read").then((it) =>
			it.createClientsReadAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.clientsUpdate,
	lazy(() =>
		import("~/app/http/controllers/management/clients/update").then((it) =>
			it.createClientsUpdateAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.clientsRotateSecret,
	lazy(() =>
		import("~/app/http/controllers/management/clients/rotate-secret").then((it) =>
			it.createClientsRotateSecretAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.clientsRevokeSecret,
	lazy(() =>
		import("~/app/http/controllers/management/clients/revoke-secret").then((it) =>
			it.createClientsRevokeSecretAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.clientsDisable,
	lazy(() =>
		import("~/app/http/controllers/management/clients/disable").then((it) =>
			it.createClientsDisableAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.clientsDelete,
	lazy(() =>
		import("~/app/http/controllers/management/clients/delete").then((it) =>
			it.createClientsDeleteAction(controllerOptions),
		),
	),
);

managementRouter.map(
	routes.apiKeysCreate,
	lazy(() =>
		import("~/app/http/controllers/management/api-keys/create").then((it) =>
			it.createApiKeysCreateAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.apiKeysList,
	lazy(() =>
		import("~/app/http/controllers/management/api-keys/list").then((it) =>
			it.createApiKeysListAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.apiKeysRead,
	lazy(() =>
		import("~/app/http/controllers/management/api-keys/read").then((it) =>
			it.createApiKeysReadAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.apiKeysRotate,
	lazy(() =>
		import("~/app/http/controllers/management/api-keys/rotate").then((it) =>
			it.createApiKeysRotateAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.apiKeysRevoke,
	lazy(() =>
		import("~/app/http/controllers/management/api-keys/revoke").then((it) =>
			it.createApiKeysRevokeAction(controllerOptions),
		),
	),
);

managementRouter.map(
	routes.webhookEndpointsRegister,
	lazy(() =>
		import("~/app/http/controllers/management/webhook-endpoints/register").then((it) =>
			it.createWebhookEndpointsRegisterAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.webhookEndpointsList,
	lazy(() =>
		import("~/app/http/controllers/management/webhook-endpoints/list").then((it) =>
			it.createWebhookEndpointsListAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.webhookEndpointsRead,
	lazy(() =>
		import("~/app/http/controllers/management/webhook-endpoints/read").then((it) =>
			it.createWebhookEndpointsReadAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.webhookEndpointsUpdate,
	lazy(() =>
		import("~/app/http/controllers/management/webhook-endpoints/update").then((it) =>
			it.createWebhookEndpointsUpdateAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.webhookEndpointsRotateSecret,
	lazy(() =>
		import("~/app/http/controllers/management/webhook-endpoints/rotate-secret").then((it) =>
			it.createWebhookEndpointsRotateSecretAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.webhookEndpointsDelete,
	lazy(() =>
		import("~/app/http/controllers/management/webhook-endpoints/delete").then((it) =>
			it.createWebhookEndpointsDeleteAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.webhookDeliveriesList,
	lazy(() =>
		import("~/app/http/controllers/management/webhook-endpoints/deliveries").then((it) =>
			it.createWebhookDeliveriesListAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.webhookDeliveriesReplay,
	lazy(() =>
		import("~/app/http/controllers/management/webhook-endpoints/deliveries").then((it) =>
			it.createWebhookDeliveriesReplayAction(controllerOptions),
		),
	),
);

managementRouter.map(
	routes.permissionsList,
	lazy(() =>
		import("~/app/http/controllers/management/roles/permissions").then((it) =>
			it.createPermissionsListAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.permissionsDefine,
	lazy(() =>
		import("~/app/http/controllers/management/roles/permissions").then((it) =>
			it.createPermissionsDefineAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.permissionsRemove,
	lazy(() =>
		import("~/app/http/controllers/management/roles/permissions").then((it) =>
			it.createPermissionsRemoveAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.rolesList,
	lazy(() =>
		import("~/app/http/controllers/management/roles/list").then((it) =>
			it.createRolesListAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.rolesDefine,
	lazy(() =>
		import("~/app/http/controllers/management/roles/define").then((it) =>
			it.createRolesDefineAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.rolesUpdate,
	lazy(() =>
		import("~/app/http/controllers/management/roles/update").then((it) =>
			it.createRolesUpdateAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.rolesDelete,
	lazy(() =>
		import("~/app/http/controllers/management/roles/delete").then((it) =>
			it.createRolesDeleteAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.rolesSetPermissions,
	lazy(() =>
		import("~/app/http/controllers/management/roles/set-permissions").then((it) =>
			it.createRolesSetPermissionsAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.subjectRolesAssign,
	lazy(() =>
		import("~/app/http/controllers/management/roles/assign").then((it) =>
			it.createSubjectRolesAssignAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.subjectAccessRead,
	lazy(() =>
		import("~/app/http/controllers/management/roles/access").then((it) =>
			it.createSubjectAccessReadAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.subjectGrantsList,
	lazy(() =>
		import("~/app/http/controllers/management/roles/grants").then((it) =>
			it.createSubjectGrantsListAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.subjectGrantsRevoke,
	lazy(() =>
		import("~/app/http/controllers/management/roles/grants").then((it) =>
			it.createSubjectGrantsRevokeAction(controllerOptions),
		),
	),
);

managementRouter.map(
	routes.passkeysList,
	lazy(() =>
		import("~/app/http/controllers/management/credentials/passkeys").then((it) =>
			it.createPasskeysListAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.passkeysRename,
	lazy(() =>
		import("~/app/http/controllers/management/credentials/passkeys").then((it) =>
			it.createPasskeysRenameAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.passkeysRevoke,
	lazy(() =>
		import("~/app/http/controllers/management/credentials/passkeys").then((it) =>
			it.createPasskeysRevokeAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.passwordForceReset,
	lazy(() =>
		import("~/app/http/controllers/management/credentials/passwords").then((it) =>
			it.createPasswordForceResetAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.secondFactorReset,
	lazy(() =>
		import("~/app/http/controllers/management/credentials/second-factor").then((it) =>
			it.createSecondFactorResetAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.secondFactorTrustedDevicesRevoke,
	lazy(() =>
		import("~/app/http/controllers/management/credentials/second-factor").then((it) =>
			it.createSecondFactorTrustedDevicesRevokeAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.sessionsList,
	lazy(() =>
		import("~/app/http/controllers/management/credentials/sessions").then((it) =>
			it.createSessionsListAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.sessionsRevoke,
	lazy(() =>
		import("~/app/http/controllers/management/credentials/sessions").then((it) =>
			it.createSessionsRevokeAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.sessionsRevokeAll,
	lazy(() =>
		import("~/app/http/controllers/management/credentials/sessions").then((it) =>
			it.createSessionsRevokeAllAction(controllerOptions),
		),
	),
);

managementRouter.map(
	routes.auditEventsList,
	lazy(() =>
		import("~/app/http/controllers/management/audit/list").then((it) =>
			it.createAuditEventsListAction(controllerOptions),
		),
	),
);

managementRouter.map(
	routes.tenantRead,
	lazy(() =>
		import("~/app/http/controllers/management/tenants/read").then((it) =>
			it.createTenantReadAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.tenantMembersList,
	lazy(() =>
		import("~/app/http/controllers/management/tenants/members").then((it) =>
			it.createTenantMembersListAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.tenantMembersCreate,
	lazy(() =>
		import("~/app/http/controllers/management/tenants/members").then((it) =>
			it.createTenantMembersCreateAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.tenantMembersInvite,
	lazy(() =>
		import("~/app/http/controllers/management/tenants/members-invite").then((it) =>
			it.createTenantMembersInviteAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.tenantMembersUpdateRole,
	lazy(() =>
		import("~/app/http/controllers/management/tenants/members").then((it) =>
			it.createTenantMembersUpdateRoleAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.tenantMembersRemove,
	lazy(() =>
		import("~/app/http/controllers/management/tenants/members").then((it) =>
			it.createTenantMembersRemoveAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.tenantDomainsList,
	lazy(() =>
		import("~/app/http/controllers/management/tenants/domains").then((it) =>
			it.createTenantDomainsListAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.tenantDomainsAttach,
	lazy(() =>
		import("~/app/http/controllers/management/tenants/domains").then((it) =>
			it.createTenantDomainsAttachAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.tenantDomainsVerification,
	lazy(() =>
		import("~/app/http/controllers/management/tenants/domains").then((it) =>
			it.createTenantDomainsVerificationAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.tenantDomainsRemove,
	lazy(() =>
		import("~/app/http/controllers/management/tenants/domains").then((it) =>
			it.createTenantDomainsRemoveAction(controllerOptions),
		),
	),
);
managementRouter.map(
	routes.tenantMfaPolicySet,
	lazy(() =>
		import("~/app/http/controllers/management/tenants/mfa-policy").then((it) =>
			it.createTenantMfaPolicySetAction(controllerOptions),
		),
	),
);
