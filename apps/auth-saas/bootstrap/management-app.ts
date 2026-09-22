/**
 * Builds the management API router's fetch-router: the administrative surface
 * served on `api.{PLATFORM_DOMAIN}`. This pass wires the shared plumbing, the
 * token endpoint, the subjects and identifiers resource area, the clients and
 * secrets resource area, the API keys and webhook endpoints and deliveries
 * resource areas, the roles, permissions and consent grants resource areas,
 * and the passkeys, password, second-factor and session resource areas;
 * every other resource route (audit events, import and export runs, and the
 * rest of the administrative surface) is a later pass's own addition to
 * `routes/management.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware, RequestContext } from "remix/router";

import { log } from "@sdxc/logger/middleware";
import { env } from "cloudflare:workers";
import { asyncContext } from "remix/middleware/async-context";
import { formData } from "remix/middleware/form-data";
import { createRouter } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";

import { createApiKeysCreateAction } from "~/app/http/controllers/management/api-keys/create";
import { createApiKeysListAction } from "~/app/http/controllers/management/api-keys/list";
import { createApiKeysReadAction } from "~/app/http/controllers/management/api-keys/read";
import { createApiKeysRevokeAction } from "~/app/http/controllers/management/api-keys/revoke";
import { createApiKeysRotateAction } from "~/app/http/controllers/management/api-keys/rotate";
import { createClientsDeleteAction } from "~/app/http/controllers/management/clients/delete";
import { createClientsDisableAction } from "~/app/http/controllers/management/clients/disable";
import { createClientsListAction } from "~/app/http/controllers/management/clients/list";
import { createClientsReadAction } from "~/app/http/controllers/management/clients/read";
import { createClientsRegisterAction } from "~/app/http/controllers/management/clients/register";
import { createClientsRevokeSecretAction } from "~/app/http/controllers/management/clients/revoke-secret";
import { createClientsRotateSecretAction } from "~/app/http/controllers/management/clients/rotate-secret";
import { createClientsUpdateAction } from "~/app/http/controllers/management/clients/update";
import {
	createPasskeysListAction,
	createPasskeysRenameAction,
	createPasskeysRevokeAction,
} from "~/app/http/controllers/management/credentials/passkeys";
import { createPasswordForceResetAction } from "~/app/http/controllers/management/credentials/passwords";
import {
	createSecondFactorResetAction,
	createSecondFactorTrustedDevicesRevokeAction,
} from "~/app/http/controllers/management/credentials/second-factor";
import {
	createSessionsListAction,
	createSessionsRevokeAction,
	createSessionsRevokeAllAction,
} from "~/app/http/controllers/management/credentials/sessions";
import { createSubjectAccessReadAction } from "~/app/http/controllers/management/roles/access";
import { createSubjectRolesAssignAction } from "~/app/http/controllers/management/roles/assign";
import { createRolesDefineAction } from "~/app/http/controllers/management/roles/define";
import { createRolesDeleteAction } from "~/app/http/controllers/management/roles/delete";
import {
	createSubjectGrantsListAction,
	createSubjectGrantsRevokeAction,
} from "~/app/http/controllers/management/roles/grants";
import { createRolesListAction } from "~/app/http/controllers/management/roles/list";
import {
	createPermissionsDefineAction,
	createPermissionsListAction,
	createPermissionsRemoveAction,
} from "~/app/http/controllers/management/roles/permissions";
import { createRolesSetPermissionsAction } from "~/app/http/controllers/management/roles/set-permissions";
import { createRolesUpdateAction } from "~/app/http/controllers/management/roles/update";
import { createSubjectsBlockAction } from "~/app/http/controllers/management/subjects/block";
import { createSubjectsCreateAction } from "~/app/http/controllers/management/subjects/create";
import { createSubjectsDeleteAction } from "~/app/http/controllers/management/subjects/delete";
import {
	createSubjectIdentifiersAddAction,
	createSubjectIdentifiersRemoveAction,
	createSubjectIdentifiersSetPrimaryAction,
	createSubjectIdentifiersVerifyAction,
} from "~/app/http/controllers/management/subjects/identifiers";
import { createSubjectsListAction } from "~/app/http/controllers/management/subjects/list";
import { createSubjectsReadAction } from "~/app/http/controllers/management/subjects/read";
import { createSubjectsUnblockAction } from "~/app/http/controllers/management/subjects/unblock";
import { createSubjectsUpdateAction } from "~/app/http/controllers/management/subjects/update";
import token from "~/app/http/controllers/management/token";
import { createWebhookEndpointsDeleteAction } from "~/app/http/controllers/management/webhook-endpoints/delete";
import {
	createWebhookDeliveriesListAction,
	createWebhookDeliveriesReplayAction,
} from "~/app/http/controllers/management/webhook-endpoints/deliveries";
import { createWebhookEndpointsListAction } from "~/app/http/controllers/management/webhook-endpoints/list";
import { createWebhookEndpointsReadAction } from "~/app/http/controllers/management/webhook-endpoints/read";
import { createWebhookEndpointsRegisterAction } from "~/app/http/controllers/management/webhook-endpoints/register";
import { createWebhookEndpointsRotateSecretAction } from "~/app/http/controllers/management/webhook-endpoints/rotate-secret";
import { createWebhookEndpointsUpdateAction } from "~/app/http/controllers/management/webhook-endpoints/update";
import notFound from "~/app/http/controllers/not-found";
import { apiVersioning } from "~/app/http/lib/api-version";
import { database } from "~/app/http/middleware/database";
import trailingSlash from "~/app/http/middleware/trailing-slash";
import { createDatabase } from "~/app/lib/database";
import { requestOrigin } from "~/app/lib/request-origin";
import { sessionCookie } from "~/app/lib/session-cookie";
import routes from "~/routes/management";

import { logger } from "./logger";

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

/** Kept as a non-tuple `Middleware[]` so the router context stays the base `RequestContext`. */
let globalMiddleware: Middleware[] = [
	trailingSlash,
	log(logger) as Middleware,
	asyncContext(),
	database(createDatabase),
	formData() as Middleware,
	apiVersioning(),
];

/**
 * The management API's router, configured with the global middleware chain and a
 * `404` default handler — this pass answers `404` for everything but the token
 * endpoint until later passes populate it.
 *
 * @example
 * return await managementRouter.fetch(request);
 */
export const managementRouter = createRouter({
	middleware: globalMiddleware,
	defaultHandler: notFound,
});

managementRouter.map(routes.token, token);

/**
 * The auth, rate-limit and tenant-stub options every subjects-area controller
 * factory shares, assembled once here from the platform's own bindings.
 */
let controllerOptions: ManagementControllerOptions = {
	issuer: `https://api.${env.PLATFORM_DOMAIN}`,
	resolveDashboardSubjectId,
	limiter: env.MANAGEMENT_RATE_LIMITER,
	resolveStub: (tenantId) => env.TENANT.getByName(tenantId),
};

managementRouter.map(routes.subjectsCreate, createSubjectsCreateAction(controllerOptions));
managementRouter.map(routes.subjectsList, createSubjectsListAction(controllerOptions));
managementRouter.map(routes.subjectsRead, createSubjectsReadAction(controllerOptions));
managementRouter.map(routes.subjectsUpdate, createSubjectsUpdateAction(controllerOptions));
managementRouter.map(routes.subjectsBlock, createSubjectsBlockAction(controllerOptions));
managementRouter.map(routes.subjectsUnblock, createSubjectsUnblockAction(controllerOptions));
managementRouter.map(routes.subjectsDelete, createSubjectsDeleteAction(controllerOptions));

managementRouter.map(
	routes.subjectIdentifiersAdd,
	createSubjectIdentifiersAddAction(controllerOptions),
);
managementRouter.map(
	routes.subjectIdentifiersVerify,
	createSubjectIdentifiersVerifyAction(controllerOptions),
);
managementRouter.map(
	routes.subjectIdentifiersSetPrimary,
	createSubjectIdentifiersSetPrimaryAction(controllerOptions),
);
managementRouter.map(
	routes.subjectIdentifiersRemove,
	createSubjectIdentifiersRemoveAction(controllerOptions),
);

managementRouter.map(routes.clientsRegister, createClientsRegisterAction(controllerOptions));
managementRouter.map(routes.clientsList, createClientsListAction(controllerOptions));
managementRouter.map(routes.clientsRead, createClientsReadAction(controllerOptions));
managementRouter.map(routes.clientsUpdate, createClientsUpdateAction(controllerOptions));
managementRouter.map(
	routes.clientsRotateSecret,
	createClientsRotateSecretAction(controllerOptions),
);
managementRouter.map(
	routes.clientsRevokeSecret,
	createClientsRevokeSecretAction(controllerOptions),
);
managementRouter.map(routes.clientsDisable, createClientsDisableAction(controllerOptions));
managementRouter.map(routes.clientsDelete, createClientsDeleteAction(controllerOptions));

managementRouter.map(routes.apiKeysCreate, createApiKeysCreateAction(controllerOptions));
managementRouter.map(routes.apiKeysList, createApiKeysListAction(controllerOptions));
managementRouter.map(routes.apiKeysRead, createApiKeysReadAction(controllerOptions));
managementRouter.map(routes.apiKeysRotate, createApiKeysRotateAction(controllerOptions));
managementRouter.map(routes.apiKeysRevoke, createApiKeysRevokeAction(controllerOptions));

managementRouter.map(
	routes.webhookEndpointsRegister,
	createWebhookEndpointsRegisterAction(controllerOptions),
);
managementRouter.map(
	routes.webhookEndpointsList,
	createWebhookEndpointsListAction(controllerOptions),
);
managementRouter.map(
	routes.webhookEndpointsRead,
	createWebhookEndpointsReadAction(controllerOptions),
);
managementRouter.map(
	routes.webhookEndpointsUpdate,
	createWebhookEndpointsUpdateAction(controllerOptions),
);
managementRouter.map(
	routes.webhookEndpointsRotateSecret,
	createWebhookEndpointsRotateSecretAction(controllerOptions),
);
managementRouter.map(
	routes.webhookEndpointsDelete,
	createWebhookEndpointsDeleteAction(controllerOptions),
);

managementRouter.map(
	routes.webhookDeliveriesList,
	createWebhookDeliveriesListAction(controllerOptions),
);
managementRouter.map(
	routes.webhookDeliveriesReplay,
	createWebhookDeliveriesReplayAction(controllerOptions),
);

managementRouter.map(routes.permissionsList, createPermissionsListAction(controllerOptions));
managementRouter.map(routes.permissionsDefine, createPermissionsDefineAction(controllerOptions));
managementRouter.map(routes.permissionsRemove, createPermissionsRemoveAction(controllerOptions));

managementRouter.map(routes.rolesList, createRolesListAction(controllerOptions));
managementRouter.map(routes.rolesDefine, createRolesDefineAction(controllerOptions));
managementRouter.map(routes.rolesUpdate, createRolesUpdateAction(controllerOptions));
managementRouter.map(routes.rolesDelete, createRolesDeleteAction(controllerOptions));
managementRouter.map(
	routes.rolesSetPermissions,
	createRolesSetPermissionsAction(controllerOptions),
);

managementRouter.map(routes.subjectRolesAssign, createSubjectRolesAssignAction(controllerOptions));
managementRouter.map(routes.subjectAccessRead, createSubjectAccessReadAction(controllerOptions));

managementRouter.map(routes.subjectGrantsList, createSubjectGrantsListAction(controllerOptions));
managementRouter.map(
	routes.subjectGrantsRevoke,
	createSubjectGrantsRevokeAction(controllerOptions),
);

managementRouter.map(routes.passkeysList, createPasskeysListAction(controllerOptions));
managementRouter.map(routes.passkeysRename, createPasskeysRenameAction(controllerOptions));
managementRouter.map(routes.passkeysRevoke, createPasskeysRevokeAction(controllerOptions));

managementRouter.map(routes.passwordForceReset, createPasswordForceResetAction(controllerOptions));

managementRouter.map(routes.secondFactorReset, createSecondFactorResetAction(controllerOptions));
managementRouter.map(
	routes.secondFactorTrustedDevicesRevoke,
	createSecondFactorTrustedDevicesRevokeAction(controllerOptions),
);

managementRouter.map(routes.sessionsList, createSessionsListAction(controllerOptions));
managementRouter.map(routes.sessionsRevoke, createSessionsRevokeAction(controllerOptions));
managementRouter.map(routes.sessionsRevokeAll, createSessionsRevokeAllAction(controllerOptions));

export { resolveDashboardSubjectId };
