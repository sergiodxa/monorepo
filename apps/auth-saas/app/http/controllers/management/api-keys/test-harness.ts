/**
 * A real management router mapping every API keys route, wired around the
 * provisioned tenant and helpers {@link buildManagementTestCore} builds, for
 * driving the HTTP surface through real requests the way `clients/test-harness.ts`
 * drives the clients and secrets surface.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RateLimiterBinding } from "@sdxc/rate-limit";
import type { Database } from "remix/data-table";
import type { RequestContext } from "remix/router";

import { createR2Bucket } from "@sdxc/cloudflare-mocks";
import { createRouter } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";
import type { ManagementTestCore } from "~/app/http/controllers/management/test-harness";
import type TenantObject from "~/database/tenant-do";

import { createApiKeysCreateAction } from "~/app/http/controllers/management/api-keys/create";
import { createApiKeysListAction } from "~/app/http/controllers/management/api-keys/list";
import { createApiKeysReadAction } from "~/app/http/controllers/management/api-keys/read";
import { createApiKeysRevokeAction } from "~/app/http/controllers/management/api-keys/revoke";
import { createApiKeysRotateAction } from "~/app/http/controllers/management/api-keys/rotate";
import {
	buildManagementTestCore,
	conformance,
	fakeHostnameClient,
	fakeLimiter,
	grantEntitlement,
	grantMembership,
	ISSUER,
} from "~/app/http/controllers/management/test-harness";
import { database } from "~/app/http/middleware/database";
import { models as modelsMiddleware } from "~/app/http/middleware/models";
import routes from "~/routes/management";

export { fakeHostnameClient, fakeLimiter, grantEntitlement, grantMembership, ISSUER };

/** Builds the management router wired to constructed control-plane and tenant state. */
export function buildApiKeysRouter(
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
		hostnameClient: fakeHostnameClient,
		r2: createR2Bucket(),
	};

	let router = createRouter({ middleware: [conformance, database(() => db), modelsMiddleware()] });

	router.map(routes.apiKeysCreate, createApiKeysCreateAction(controllerOptions));
	router.map(routes.apiKeysList, createApiKeysListAction(controllerOptions));
	router.map(routes.apiKeysRead, createApiKeysReadAction(controllerOptions));
	router.map(routes.apiKeysRotate, createApiKeysRotateAction(controllerOptions));
	router.map(routes.apiKeysRevoke, createApiKeysRevokeAction(controllerOptions));

	return router;
}

export interface ApiKeysHarness extends ManagementTestCore {
	router: ReturnType<typeof buildApiKeysRouter>;
}

export interface BuildApiKeysHarnessOptions {
	limiter?: RateLimiterBinding;
	resolveDashboardSubjectId?: (ctx: RequestContext) => Promise<string | null>;
}

/** Provisions a fresh tenant, its control-plane record, and the API keys router, ready for an HTTP-surface test. */
export async function buildApiKeysHarness(
	options: BuildApiKeysHarnessOptions = {},
): Promise<ApiKeysHarness> {
	let core = await buildManagementTestCore({ defaultScope: "keys:write" });
	let router = buildApiKeysRouter(core.db, core.tenantDO, options);

	return { ...core, router };
}
