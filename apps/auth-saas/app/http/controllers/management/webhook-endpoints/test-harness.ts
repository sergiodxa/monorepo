/**
 * A real management router mapping every webhook endpoints and deliveries
 * route, wired around the provisioned tenant and helpers
 * {@link buildManagementTestCore} builds, for driving the HTTP surface through
 * real requests the way `clients/test-harness.ts` drives the clients and
 * secrets surface.
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

import {
	buildManagementTestCore,
	fakeLimiter,
	grantEntitlement,
	grantMembership,
	ISSUER,
} from "~/app/http/controllers/management/test-harness";
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
import { database } from "~/app/http/middleware/database";
import routes from "~/routes/management";

export { fakeLimiter, grantEntitlement, grantMembership, ISSUER };

/** Builds the management router wired to constructed control-plane and tenant state. */
export function buildWebhookEndpointsRouter(
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

	router.map(
		routes.webhookEndpointsRegister,
		createWebhookEndpointsRegisterAction(controllerOptions),
	);
	router.map(routes.webhookEndpointsList, createWebhookEndpointsListAction(controllerOptions));
	router.map(routes.webhookEndpointsRead, createWebhookEndpointsReadAction(controllerOptions));
	router.map(routes.webhookEndpointsUpdate, createWebhookEndpointsUpdateAction(controllerOptions));
	router.map(
		routes.webhookEndpointsRotateSecret,
		createWebhookEndpointsRotateSecretAction(controllerOptions),
	);
	router.map(routes.webhookEndpointsDelete, createWebhookEndpointsDeleteAction(controllerOptions));

	router.map(routes.webhookDeliveriesList, createWebhookDeliveriesListAction(controllerOptions));
	router.map(
		routes.webhookDeliveriesReplay,
		createWebhookDeliveriesReplayAction(controllerOptions),
	);

	return router;
}

export interface WebhookEndpointsHarness extends ManagementTestCore {
	router: ReturnType<typeof buildWebhookEndpointsRouter>;
}

export interface BuildWebhookEndpointsHarnessOptions {
	limiter?: RateLimiterBinding;
	resolveDashboardSubjectId?: (ctx: RequestContext) => Promise<string | null>;
}

/** Provisions a fresh tenant, its control-plane record, and the webhook endpoints router, ready for an HTTP-surface test. */
export async function buildWebhookEndpointsHarness(
	options: BuildWebhookEndpointsHarnessOptions = {},
): Promise<WebhookEndpointsHarness> {
	let core = await buildManagementTestCore({ defaultScope: "webhooks:write" });
	let router = buildWebhookEndpointsRouter(core.db, core.tenantDO, options);

	return { ...core, router };
}
