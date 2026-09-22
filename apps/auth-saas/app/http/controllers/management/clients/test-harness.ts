/**
 * A real management router mapping every clients and secrets route, wired
 * around the provisioned tenant and helpers {@link buildManagementTestCore}
 * builds, for driving the HTTP surface through real requests the way
 * `scim/test-harness.ts` drives the SCIM surface.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RateLimiterBinding } from "@sdxc/rate-limit";
import type { Database } from "remix/data-table";
import type { RequestContext } from "remix/router";

import { createRouter } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";
import type { ManagementTestCore } from "~/app/http/controllers/management/test-harness";
import type TenantObject from "~/database/tenant-do";

import { createClientsDeleteAction } from "~/app/http/controllers/management/clients/delete";
import { createClientsDisableAction } from "~/app/http/controllers/management/clients/disable";
import { createClientsListAction } from "~/app/http/controllers/management/clients/list";
import { createClientsReadAction } from "~/app/http/controllers/management/clients/read";
import { createClientsRegisterAction } from "~/app/http/controllers/management/clients/register";
import { createClientsRevokeSecretAction } from "~/app/http/controllers/management/clients/revoke-secret";
import { createClientsRotateSecretAction } from "~/app/http/controllers/management/clients/rotate-secret";
import { createClientsUpdateAction } from "~/app/http/controllers/management/clients/update";
import {
	buildManagementTestCore,
	fakeLimiter,
	grantMembership,
	ISSUER,
} from "~/app/http/controllers/management/test-harness";
import { database } from "~/app/http/middleware/database";
import routes from "~/routes/management";

export { fakeLimiter, grantMembership, ISSUER };

/** Builds the management router wired to constructed control-plane and tenant state. */
export function buildClientsRouter(
	db: Database,
	tenantDO: TenantObject,
	options: {
		resolveDashboardSubjectId?: (ctx: RequestContext) => Promise<string | null>;
		limiter?: RateLimiterBinding;
	} = {},
) {
	let controllerOptions: ManagementControllerOptions = {
		issuer: ISSUER,
		resolveDashboardSubjectId: options.resolveDashboardSubjectId ?? (async () => null),
		limiter: options.limiter ?? fakeLimiter(),
		resolveStub: () => tenantDO as unknown as DurableObjectStub<TenantObject>,
	};

	let router = createRouter({ middleware: [database(() => db)] });

	router.map(routes.clientsRegister, createClientsRegisterAction(controllerOptions));
	router.map(routes.clientsList, createClientsListAction(controllerOptions));
	router.map(routes.clientsRead, createClientsReadAction(controllerOptions));
	router.map(routes.clientsUpdate, createClientsUpdateAction(controllerOptions));
	router.map(routes.clientsRotateSecret, createClientsRotateSecretAction(controllerOptions));
	router.map(routes.clientsRevokeSecret, createClientsRevokeSecretAction(controllerOptions));
	router.map(routes.clientsDisable, createClientsDisableAction(controllerOptions));
	router.map(routes.clientsDelete, createClientsDeleteAction(controllerOptions));

	return router;
}

export interface ClientsHarness extends ManagementTestCore {
	router: ReturnType<typeof buildClientsRouter>;
}

export interface BuildClientsHarnessOptions {
	limiter?: RateLimiterBinding;
	resolveDashboardSubjectId?: (ctx: RequestContext) => Promise<string | null>;
}

/** Provisions a fresh tenant, its control-plane record, and the clients router, ready for an HTTP-surface test. */
export async function buildClientsHarness(
	options: BuildClientsHarnessOptions = {},
): Promise<ClientsHarness> {
	let core = await buildManagementTestCore({ defaultScope: "clients:write" });
	let router = buildClientsRouter(core.db, core.tenantDO, options);

	return { ...core, router };
}
